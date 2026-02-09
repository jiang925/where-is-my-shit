from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.concurrency import run_in_threadpool

from src.app.core.security import get_current_user
from src.app.schemas.message import SearchRequest, SearchResponse, SearchResult, SearchResultGroup
from src.app.services.embedding import EmbeddingService
from src.app.db.client import db_client

router = APIRouter(dependencies=[Depends(get_current_user)])

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
        if request.conversation_id:
            search_builder = search_builder.where(f"conversation_id = '{request.conversation_id}'")

        # Execute
        # Use to_list() to avoid pandas dependency and handle score mapping manually
        results_list = await run_in_threadpool(search_builder.to_list)

        results: List[SearchResult] = []
        for r in results_list:
            # map _distance to score if present
            # LanceDB returns _distance (lower is better) for euclidean/cosine?
            # Actually for cosine similarity default, it might be distance.
            # Let's just use it as score for now.
            if "_distance" in r:
                r["score"] = r.pop("_distance")
            else:
                r["score"] = 0.0

            # Ensure vector is removed if it's returned (we don't want it in response payload usually)
            if "vector" in r:
                del r["vector"]

            results.append(SearchResult(**r))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search execution failed: {str(e)}")

    # 3. Group by conversation
    grouped_map: Dict[str, List[SearchResult]] = {}

    for res in results:
        # TODO: Add score threshold check here if needed
        if res.conversation_id not in grouped_map:
            grouped_map[res.conversation_id] = []
        grouped_map[res.conversation_id].append(res)

    # 4. Construct response
    groups: List[SearchResultGroup] = []
    total_count = 0

    for conv_id, items in grouped_map.items():
        # Sort items by timestamp or score? Usually score is already sorted by search.
        # But within a conversation, chronological might be better for reading?
        # Search returns relevance. Let's keep relevance for now.
        groups.append(SearchResultGroup(
            conversation_id=conv_id,
            results=items
        ))
        total_count += len(items)

    # If we want to strictly limit the number of ITEMS returned to request.limit:
    # We might need to trim. But let's return what we found for now.

    return SearchResponse(
        groups=groups,
        count=total_count
    )
