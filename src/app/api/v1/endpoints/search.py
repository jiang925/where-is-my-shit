from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.schemas.message import (
    SearchRequest,
    SearchResponse,
    SearchResult,
    SearchResultGroup,
)
from src.app.services.embedding import EmbeddingService
from src.app.services.reranker import UnifiedReranker

# Whitelist of allowed platforms for security validation
ALLOWED_PLATFORMS = ["chatgpt", "claude", "claude-code", "gemini", "perplexity", "cursor"]

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/search", response_model=SearchResponse)
async def search_documents(request: SearchRequest):
    """
    Search for documents using hybrid search (vector + FTS).
    Results are processed through unified reranker and grouped by conversation.
    """
    embedding_service = EmbeddingService()
    reranker = UnifiedReranker()

    # 1. Embed query (CPU intensive)
    try:
        query_vector = await run_in_threadpool(embedding_service.embed_text, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

    # 2. Execute Hybrid Search (vector + FTS)
    try:
        table = db_client.get_table("messages")

        # Build filters
        filters = []

        # Conversation filter (existing)
        if request.conversation_id:
            filters.append(f"conversation_id = '{request.conversation_id}'")

        # Platform filter (supports multiple values with OR logic)
        if request.platform:
            if isinstance(request.platform, str):
                platforms_to_filter = [request.platform]
            else:
                platforms_to_filter = []
                for p in request.platform:
                    if p in ALLOWED_PLATFORMS:
                        platforms_to_filter.append(p)

            if platforms_to_filter:
                platform_list = "', '".join(platforms_to_filter)
                filters.append(f"platform IN ('{platform_list}')")

        # Date range filter
        if request.date_range:
            now = datetime.now(UTC)
            if request.date_range == "today":
                start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif request.date_range == "this_week":
                start = (now - timedelta(days=now.weekday())).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
            elif request.date_range == "this_month":
                start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                start = None

            if start:
                # LanceDB stores naive timestamps, strip tzinfo
                naive_start = start.replace(tzinfo=None).isoformat()
                filters.append(f"timestamp >= '{naive_start}'")

        where_clause = " AND ".join(filters) if filters else None

        # Request more candidates than the limit to give reranker enough options
        candidate_limit = max(request.limit * 3, 100)

        # Execute vector search
        vector_search = table.search(query_vector, query_type="vector")
        if where_clause:
            vector_search = vector_search.where(where_clause)
        vector_results_list = await run_in_threadpool(vector_search.limit(candidate_limit).to_list)

        # Execute FTS search
        fts_search = table.search(request.query, query_type="fts")
        if where_clause:
            fts_search = fts_search.where(where_clause)
        fts_results_list = await run_in_threadpool(fts_search.limit(candidate_limit).to_list)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search execution failed: {str(e)}")

    # 3. Prepare results for reranker
    # Vector results: map _distance to vector_score (invert for cosine: 1 - distance)
    vector_results = []
    for r in vector_results_list:
        distance = r.pop("_distance", 0.0)
        # For cosine distance, closer is better, so invert: similarity = 1 - distance
        vector_score = 1.0 - distance if distance < 1.0 else 0.0

        # Remove vector field to reduce payload size
        if "vector" in r:
            del r["vector"]

        r["vector_score"] = vector_score
        r["id"] = r.get("id", "")
        r["content"] = r.get("content", "")
        vector_results.append(r)

    # FTS results: _score field (higher = better)
    text_results = []
    for r in fts_results_list:
        text_score = r.pop("_score", 0.0)

        # Remove vector field
        if "vector" in r:
            del r["vector"]

        r["text_score"] = text_score
        r["id"] = r.get("id", "")
        r["content"] = r.get("content", "")
        text_results.append(r)

    # 4. Run unified reranker
    ranked = reranker.rerank(vector_results, text_results, request.query)

    # 5. Gather conversation context for search results
    #    Look up message counts and first user messages for each conversation
    conv_ids = set()
    for r in ranked.primary + ranked.secondary:
        cid = r.get("conversation_id", "")
        if cid:
            conv_ids.add(cid)

    conv_context: dict[str, dict] = {}  # conv_id -> {count, first_user_message}
    if conv_ids:
        try:

            def fetch_conv_context():
                # Query all messages for these conversations
                cid_list = "', '".join(conv_ids)
                where = f"conversation_id IN ('{cid_list}')"
                dummy_vector = [0.0] * len(query_vector)
                rows = (
                    table.search(dummy_vector, query_type="vector")
                    .where(where)
                    .select(["conversation_id", "role", "content", "timestamp"])
                    .limit(10000)
                    .to_list()
                )
                return rows

            ctx_rows = await run_in_threadpool(fetch_conv_context)

            # Group by conversation
            from collections import defaultdict

            by_conv: dict[str, list] = defaultdict(list)
            for row in ctx_rows:
                by_conv[row.get("conversation_id", "")].append(row)

            for cid, msgs in by_conv.items():
                count = len(msgs)
                # Find first user message by timestamp
                user_msgs = [m for m in msgs if m.get("role") == "user"]
                first_user = ""
                if user_msgs:
                    user_msgs.sort(key=lambda m: str(m.get("timestamp", "")))
                    first_user = user_msgs[0].get("content", "")
                    if len(first_user) > 300:
                        first_user = first_user[:300] + "..."
                conv_context[cid] = {
                    "count": count,
                    "first_user_message": first_user,
                }
        except Exception:
            pass  # Graceful degradation: context is optional

    # 6. Build two-tier response
    def build_search_result(result_dict: dict) -> SearchResult:
        """Convert reranker result dict to SearchResult."""
        from datetime import datetime

        from src.app.schemas.message import SearchResultMeta

        # Convert timestamp to unix timestamp
        timestamp_value = result_dict.get("timestamp")
        if isinstance(timestamp_value, str):
            timestamp_value = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
        created_at = int(timestamp_value.timestamp()) if timestamp_value else 0

        cid = result_dict.get("conversation_id", "")
        ctx = conv_context.get(cid, {})

        meta = SearchResultMeta(
            source=result_dict.get("platform", ""),
            adapter=result_dict.get("platform", ""),
            created_at=created_at,
            title=result_dict.get("title", ""),
            url=result_dict.get("url", ""),
            conversation_id=cid,
            message_count=ctx.get("count", 0),
            first_user_message=ctx.get("first_user_message", ""),
        )

        return SearchResult(
            id=result_dict.get("id", ""),
            score=result_dict.get("vector_score", 0.0),  # Keep raw score for backward compat
            content=result_dict.get("content", ""),
            meta=meta,
            relevance_score=result_dict.get("final_score", 0.0),
            quality_score=result_dict.get("quality_score", 1.0),
            exact_match=result_dict.get("exact_match", False),
        )

    # Group primary results by conversation
    primary_grouped_map: dict[str, list[SearchResult]] = {}
    for res_dict in ranked.primary:
        search_result = build_search_result(res_dict)
        conv_id = search_result.meta.conversation_id
        if conv_id not in primary_grouped_map:
            primary_grouped_map[conv_id] = []
        primary_grouped_map[conv_id].append(search_result)

    # Group secondary results by conversation
    secondary_grouped_map: dict[str, list[SearchResult]] = {}
    for res_dict in ranked.secondary:
        search_result = build_search_result(res_dict)
        conv_id = search_result.meta.conversation_id
        if conv_id not in secondary_grouped_map:
            secondary_grouped_map[conv_id] = []
        secondary_grouped_map[conv_id].append(search_result)

    # Build response groups
    primary_groups: list[SearchResultGroup] = []
    primary_count = 0
    for conv_id, items in primary_grouped_map.items():
        primary_groups.append(SearchResultGroup(conversation_id=conv_id, results=items))
        primary_count += len(items)

    secondary_groups: list[SearchResultGroup] = []
    secondary_count = 0
    for conv_id, items in secondary_grouped_map.items():
        secondary_groups.append(SearchResultGroup(conversation_id=conv_id, results=items))
        secondary_count += len(items)

    return SearchResponse(
        groups=primary_groups,
        count=primary_count,
        secondary_groups=secondary_groups,
        secondary_count=secondary_count,
        total_considered=ranked.total_considered,
    )
