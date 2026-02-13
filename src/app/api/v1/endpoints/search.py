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

# Whitelist of allowed platforms for security validation
ALLOWED_PLATFORMS = ['chatgpt', 'claude', 'claude-code', 'gemini', 'perplexity', 'cursor']

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/search", response_model=SearchResponse)
async def search_documents(request: SearchRequest):
    """
    Search for documents using hybrid search (vector + keyword).
    Results are grouped by conversation.
    """
    embedding_service = EmbeddingService()

    # 1. Embed query (CPU intensive)
    try:
        query_vector = await run_in_threadpool(embedding_service.embed_text, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

    # 2. Execute LanceDB Search
    try:
        table = db_client.get_table("messages")

        # Use vector search primarily
        search_builder = table.search(query_vector)

        # Apply limit and offset
        search_builder = search_builder.limit(request.limit).offset(request.offset)

        # Apply filters if any
        filters = []

        # Conversation filter (existing)
        if request.conversation_id:
            filters.append(f"conversation_id = '{request.conversation_id}'")

        # Platform filter (NEW - supports multiple values with OR logic)
        if request.platform:
            if isinstance(request.platform, str):
                # Single platform: convert to list for uniform handling
                platforms_to_filter = [request.platform]
            else:
                # Already a list: validate each platform
                platforms_to_filter = []

                for p in request.platform:
                    if p in ALLOWED_PLATFORMS:
                        platforms_to_filter.append(p)

            if platforms_to_filter:
                platform_list = "', '".join(platforms_to_filter)
                filters.append(f"platform IN ('{platform_list}')")

        # Combine all filters with AND logic
        if filters:
            where_clause = " AND ".join(filters)
            search_builder = search_builder.where(where_clause)

        # Execute
        # Use to_list() to avoid pandas dependency and handle score mapping manually
        results_list = await run_in_threadpool(search_builder.to_list)

        results: list[SearchResult] = []
        for r in results_list:
            # map _distance to score if present
            # LanceDB returns _distance (lower is better) for euclidean/cosine?
            # Actually for cosine similarity default, it might be distance.
            # Let's just use it as score for now.
            score = r.pop("_distance", 0.0)

            # Ensure vector is removed if it's returned (we don't want it in response payload usually)
            if "vector" in r:
                del r["vector"]

            # Transform flat database structure to nested frontend structure
            from src.app.schemas.message import SearchResultMeta

            # Convert timestamp to unix timestamp
            timestamp_value = r.get("timestamp")
            if isinstance(timestamp_value, str):
                from datetime import datetime

                timestamp_value = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
            created_at = int(timestamp_value.timestamp()) if timestamp_value else 0

            meta = SearchResultMeta(
                source=r.get("platform", ""),
                adapter=r.get("platform", ""),
                created_at=created_at,
                title=r.get("title", ""),
                url=r.get("url", ""),
                conversation_id=r.get("conversation_id", ""),
            )

            results.append(
                SearchResult(
                    id=r.get("id", ""),
                    score=score,
                    content=r.get("content", ""),
                    meta=meta,
                )
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search execution failed: {str(e)}")

    # 3. Group by conversation
    grouped_map: dict[str, list[SearchResult]] = {}

    for res in results:
        # TODO: Add score threshold check here if needed
        conv_id = res.meta.conversation_id
        if conv_id not in grouped_map:
            grouped_map[conv_id] = []
        grouped_map[conv_id].append(res)

    # 4. Construct response
    groups: list[SearchResultGroup] = []
    total_count = 0

    for conv_id, items in grouped_map.items():
        # Sort items by timestamp or score? Usually score is already sorted by search.
        # But within a conversation, chronological might be better for reading?
        # Search returns relevance. Let's keep relevance for now.
        groups.append(SearchResultGroup(conversation_id=conv_id, results=items))
        total_count += len(items)

    # If we want to strictly limit the number of ITEMS returned to request.limit:
    # We might need to trim. But let's return what we found for now.

    return SearchResponse(groups=groups, count=total_count)
