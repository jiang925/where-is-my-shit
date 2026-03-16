"""Sync endpoints for multi-device WIMS instances.

Enables two WIMS instances to synchronize conversation data:
- GET /sync/changes?since=<unix_timestamp> — Pull changes since a timestamp
- POST /sync/push — Push a batch of messages (with dedup)
- GET /sync/status — Current instance stats for sync coordination
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.services.embedding import EmbeddingService

router = APIRouter(dependencies=[Depends(verify_api_key)])


class SyncMessage(BaseModel):
    id: str | None = None
    conversation_id: str
    platform: str
    title: str
    content: str
    role: str
    timestamp: str
    url: str = ""


class SyncPushRequest(BaseModel):
    messages: list[SyncMessage]
    source_instance: str = ""


class SyncPushResponse(BaseModel):
    received: int
    inserted: int
    skipped_duplicates: int


class SyncChangesResponse(BaseModel):
    messages: list[dict]
    total: int
    server_time: str


@router.get("/sync/status")
async def sync_status():
    """Return current instance stats for sync coordination."""
    try:
        table = db_client.get_table("messages")

        def get_stats():
            dim = db_client.get_vector_dim()
            all_rows = (
                table.search([0.0] * dim, query_type="vector")
                .select(["id", "timestamp", "platform", "conversation_id"])
                .limit(100000)
                .to_list()
            )
            if not all_rows:
                return {
                    "total_messages": 0,
                    "total_conversations": 0,
                    "platforms": [],
                    "latest_timestamp": None,
                }

            conv_ids = set()
            platforms = set()
            latest = None
            for r in all_rows:
                conv_ids.add(r.get("conversation_id", ""))
                platforms.add(r.get("platform", ""))
                ts = r.get("timestamp")
                if ts and (latest is None or str(ts) > str(latest)):
                    latest = ts

            return {
                "total_messages": len(all_rows),
                "total_conversations": len(conv_ids),
                "platforms": sorted(platforms),
                "latest_timestamp": str(latest) if latest else None,
            }

        stats = await run_in_threadpool(get_stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync status failed: {str(e)}")

    return {
        **stats,
        "server_time": datetime.now(UTC).isoformat(),
    }


@router.get("/sync/changes", response_model=SyncChangesResponse)
async def sync_changes(
    since: float = Query(0, description="Unix timestamp to fetch changes after"),
    limit: int = Query(10000, le=50000),
):
    """Pull all messages modified/created after a timestamp."""
    try:
        table = db_client.get_table("messages")
        since_dt = datetime.fromtimestamp(since, tz=UTC).replace(tzinfo=None)

        def fetch_changes():
            dim = db_client.get_vector_dim()
            ts_filter = f"timestamp > timestamp '{since_dt.isoformat()}'"
            rows = (
                table.search([0.0] * dim, query_type="vector")
                .where(ts_filter)
                .select(
                    [
                        "id",
                        "conversation_id",
                        "platform",
                        "title",
                        "content",
                        "role",
                        "timestamp",
                        "url",
                    ]
                )
                .limit(limit)
                .to_list()
            )
            results = []
            for r in rows:
                ts = r.get("timestamp")
                if isinstance(ts, datetime):
                    ts = ts.isoformat()
                results.append(
                    {
                        "id": r.get("id", ""),
                        "conversation_id": r.get("conversation_id", ""),
                        "platform": r.get("platform", ""),
                        "title": r.get("title", ""),
                        "content": r.get("content", ""),
                        "role": r.get("role", "user"),
                        "timestamp": str(ts),
                        "url": r.get("url", ""),
                    }
                )
            return results

        messages = await run_in_threadpool(fetch_changes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync changes failed: {str(e)}")

    return SyncChangesResponse(
        messages=messages,
        total=len(messages),
        server_time=datetime.now(UTC).isoformat(),
    )


@router.post("/sync/push", response_model=SyncPushResponse)
async def sync_push(request: SyncPushRequest):
    """Push messages from a remote WIMS instance. Deduplicates by message ID."""
    if not request.messages:
        return SyncPushResponse(received=0, inserted=0, skipped_duplicates=0)

    try:
        table = db_client.get_table("messages")
        embedding_service = EmbeddingService()
        dim = db_client.get_vector_dim()

        # Get existing IDs for dedup
        def get_existing():
            rows = table.search([0.0] * dim, query_type="vector").select(["id"]).limit(100000).to_list()
            return {r["id"] for r in rows}

        existing_ids = await run_in_threadpool(get_existing)

        to_insert = []
        skipped = 0

        for msg in request.messages:
            msg_id = msg.id or str(uuid.uuid4())
            if msg_id in existing_ids:
                skipped += 1
                continue

            # Parse timestamp
            try:
                if "T" in msg.timestamp:
                    ts = datetime.fromisoformat(msg.timestamp.replace("Z", "+00:00")).replace(tzinfo=None)
                else:
                    ts = datetime.fromtimestamp(float(msg.timestamp), tz=UTC).replace(tzinfo=None)
            except (ValueError, TypeError):
                ts = datetime.now(UTC).replace(tzinfo=None)

            # Generate embedding
            vector = await run_in_threadpool(embedding_service.embed_text, msg.content)
            if not vector:
                vector = [0.0] * dim

            to_insert.append(
                {
                    "id": msg_id,
                    "conversation_id": msg.conversation_id,
                    "platform": msg.platform,
                    "title": msg.title,
                    "content": msg.content,
                    "role": msg.role,
                    "timestamp": ts,
                    "url": msg.url,
                    "vector": vector,
                    "embedding_model": embedding_service.get_model_name(),
                }
            )

        if to_insert:
            await run_in_threadpool(table.add, to_insert)

        inserted = len(to_insert)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync push failed: {str(e)}")

    return SyncPushResponse(
        received=len(request.messages),
        inserted=inserted,
        skipped_duplicates=skipped,
    )
