import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.schemas.message import BrowseItem, BrowseResponse
from src.app.services.embedding import EmbeddingService
from src.app.services.tagger import extract_tags


class UpdateTitleRequest(BaseModel):
    title: str


class MergeConversationsRequest(BaseModel):
    source_ids: list[str]
    target_id: str
    new_title: str | None = None


# Only allow alphanumeric, hyphens, and underscores in conversation_id
CONVERSATION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9\-_]+$")

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/thread/{conversation_id}", response_model=BrowseResponse)
async def get_thread(conversation_id: str):
    """
    Return all messages for a given conversation_id, sorted by timestamp
    ascending (oldest first) for conversation display.
    """
    # 1. Sanitize conversation_id to prevent injection
    if not CONVERSATION_ID_PATTERN.match(conversation_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation_id: only alphanumeric characters, hyphens, and underscores are allowed",
        )

    # 2. Query LanceDB table
    try:
        table = db_client.get_table("messages")

        def query_table():
            # Use a dummy vector to scan with vector search
            dummy_vector = [0.0] * db_client.get_vector_dim()  # Match the vector dimensions from Message model

            query_builder = table.search(dummy_vector, query_type="vector")
            query_builder = query_builder.where(f"conversation_id = '{conversation_id}'")

            # Select only needed columns (exclude vector to reduce memory)
            query_builder = query_builder.select(
                ["id", "conversation_id", "timestamp", "platform", "title", "content", "url", "role"]
            )

            results = query_builder.limit(10000).to_list()
            return results

        results_list = await run_in_threadpool(query_table)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Thread query failed: {str(e)}")

    # 3. Sort by timestamp ascending (oldest first for conversation display)
    def sort_key(item):
        timestamp_value = item.get("timestamp")
        if isinstance(timestamp_value, str):
            return timestamp_value
        else:
            return timestamp_value.isoformat()

    results_list.sort(key=sort_key, reverse=False)

    # 4. Build response
    items = []
    for r in results_list:
        # Convert timestamp to Unix timestamp
        timestamp_value = r.get("timestamp")
        if isinstance(timestamp_value, str):
            timestamp_value = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
        unix_timestamp = int(timestamp_value.timestamp()) if timestamp_value else 0

        items.append(
            BrowseItem(
                id=r.get("id", ""),
                conversation_id=r.get("conversation_id", ""),
                timestamp=unix_timestamp,
                platform=r.get("platform", ""),
                title=r.get("title", ""),
                content=r.get("content", ""),
                url=r.get("url", ""),
                role=r.get("role", "user"),
            )
        )

    return BrowseResponse(
        items=items,
        nextCursor=None,
        hasMore=False,
        total=len(items),
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """
    Delete all messages for a given conversation_id.
    Returns the number of messages deleted.
    """
    if not CONVERSATION_ID_PATTERN.match(conversation_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation_id: only alphanumeric characters, hyphens, and underscores are allowed",
        )

    try:
        table = db_client.get_table("messages")

        # Count messages before deletion
        def count_and_delete():
            results = (
                table.search([0.0] * db_client.get_vector_dim(), query_type="vector")
                .where(f"conversation_id = '{conversation_id}'")
                .select(["id"])
                .limit(10000)
                .to_list()
            )
            count = len(results)
            if count > 0:
                table.delete(f"conversation_id = '{conversation_id}'")
            return count

        deleted_count = await run_in_threadpool(count_and_delete)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"deleted": deleted_count, "conversation_id": conversation_id}


@router.patch("/conversations/{conversation_id}/title")
async def update_conversation_title(conversation_id: str, request: UpdateTitleRequest):
    """
    Update the title for all messages in a conversation.
    """
    if not CONVERSATION_ID_PATTERN.match(conversation_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation_id: only alphanumeric characters, hyphens, and underscores are allowed",
        )

    title = request.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    if len(title) > 500:
        raise HTTPException(status_code=400, detail="Title must be 500 characters or less")

    try:
        table = db_client.get_table("messages")

        def do_update():
            # First verify the conversation exists
            results = (
                table.search([0.0] * db_client.get_vector_dim(), query_type="vector")
                .where(f"conversation_id = '{conversation_id}'")
                .select(["id"])
                .limit(1)
                .to_list()
            )
            if not results:
                return 0
            table.update(
                where=f"conversation_id = '{conversation_id}'",
                values={"title": title},
            )
            return 1

        found = await run_in_threadpool(do_update)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Title update failed: {str(e)}")

    if found == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"conversation_id": conversation_id, "title": title}


@router.get("/related/{conversation_id}")
async def get_related_conversations(conversation_id: str, limit: int = 5):
    """Find conversations related to the given one via vector similarity."""
    if not CONVERSATION_ID_PATTERN.match(conversation_id):
        raise HTTPException(status_code=400, detail="Invalid conversation_id")

    try:
        table = db_client.get_table("messages")
        embedding_service = EmbeddingService()

        def find_related():
            # Get a representative message from this conversation (first user message)
            dim = db_client.get_vector_dim()
            rows = (
                table.search([0.0] * dim, query_type="vector")
                .where(f"conversation_id = '{conversation_id}' AND role = 'user'")
                .select(["content"])
                .limit(1)
                .to_list()
            )
            if not rows:
                return []

            # Embed that message and search for similar ones
            query_vector = embedding_service.embed_text(rows[0]["content"])
            if not query_vector:
                return []

            # Search excluding the source conversation
            similar = (
                table.search(query_vector, query_type="vector")
                .where(f"conversation_id != '{conversation_id}'")
                .select(["id", "conversation_id", "platform", "title", "content", "timestamp", "url", "role"])
                .limit(limit * 3)
                .to_list()
            )

            # Deduplicate by conversation_id, keep best match per conversation
            seen = {}
            for r in similar:
                cid = r.get("conversation_id", "")
                if cid and cid not in seen:
                    seen[cid] = r
                if len(seen) >= limit:
                    break
            return list(seen.values())

        results = await run_in_threadpool(find_related)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Related query failed: {str(e)}")

    items = []
    for r in results:
        ts = r.get("timestamp")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        unix_ts = int(ts.timestamp()) if ts else 0

        items.append(
            BrowseItem(
                id=r.get("id", ""),
                conversation_id=r.get("conversation_id", ""),
                timestamp=unix_ts,
                platform=r.get("platform", ""),
                title=r.get("title", ""),
                content=r.get("content", ""),
                url=r.get("url", ""),
                role=r.get("role", "user"),
            )
        )

    return {"items": items, "total": len(items)}


@router.post("/conversations/merge")
async def merge_conversations(request: MergeConversationsRequest):
    """
    Merge multiple conversations into one. All messages from source_ids
    are reassigned to target_id. Source conversations are effectively
    absorbed into the target.
    """
    all_ids = set(request.source_ids) | {request.target_id}
    for cid in all_ids:
        if not CONVERSATION_ID_PATTERN.match(cid):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid conversation_id: {cid}",
            )

    if not request.source_ids:
        raise HTTPException(status_code=400, detail="source_ids must not be empty")

    if request.target_id in request.source_ids:
        raise HTTPException(
            status_code=400,
            detail="target_id must not be in source_ids",
        )

    try:
        table = db_client.get_table("messages")
        new_title = request.new_title

        def do_merge():
            moved = 0
            for src_id in request.source_ids:
                update_vals: dict = {"conversation_id": request.target_id}
                if new_title:
                    update_vals["title"] = new_title
                table.update(
                    where=f"conversation_id = '{src_id}'",
                    values=update_vals,
                )
                # Count how many were moved
                rows = (
                    table.search(
                        [0.0] * db_client.get_vector_dim(),
                        query_type="vector",
                    )
                    .where(f"conversation_id = '{request.target_id}'")
                    .select(["id"])
                    .limit(10000)
                    .to_list()
                )
                moved = len(rows)

            # Update title on target if specified
            if new_title:
                table.update(
                    where=f"conversation_id = '{request.target_id}'",
                    values={"title": new_title},
                )
            return moved

        total = await run_in_threadpool(do_merge)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(e)}")

    return {
        "target_id": request.target_id,
        "merged_sources": request.source_ids,
        "total_messages": total,
    }


@router.get("/tags/{conversation_id}")
async def get_conversation_tags(conversation_id: str):
    """Auto-extract tags from a conversation's content."""
    if not CONVERSATION_ID_PATTERN.match(conversation_id):
        raise HTTPException(status_code=400, detail="Invalid conversation_id")

    try:
        table = db_client.get_table("messages")

        def fetch_content():
            dim = db_client.get_vector_dim()
            rows = (
                table.search([0.0] * dim, query_type="vector")
                .where(f"conversation_id = '{conversation_id}'")
                .select(["content"])
                .limit(10000)
                .to_list()
            )
            return " ".join(r.get("content", "") for r in rows)

        combined = await run_in_threadpool(fetch_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tag extraction failed: {str(e)}")

    if not combined.strip():
        raise HTTPException(status_code=404, detail="Conversation not found")

    tags = extract_tags(combined)
    return {"conversation_id": conversation_id, "tags": tags}
