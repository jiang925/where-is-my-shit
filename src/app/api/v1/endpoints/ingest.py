import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.db.compaction import compaction_manager
from src.app.api.v1.endpoints.import_data import _get_existing_ids, _parse_timestamp
from src.app.schemas.message import IngestRequest
from src.app.services.embedding import EmbeddingService

router = APIRouter(dependencies=[Depends(verify_api_key)])

ALLOWED_PLATFORMS = [
    "aider", "antigravity", "chatgpt", "claude", "claude-code", "cline",
    "continue", "copilot", "cursor", "deepseek", "doubao", "gemini",
    "grok", "huggingchat", "jan", "kimi", "lechat", "open-webui",
    "perplexity", "poe", "qwen",
]
CONV_ID_RE = re.compile(r"^[a-zA-Z0-9\-_]+$")
MAX_BATCH_SIZE = 100


class BatchMessage(BaseModel):
    id: str | None = None
    conversation_id: str
    platform: str
    title: str = ""
    content: str
    role: str = "user"
    timestamp: str | datetime
    url: str = ""


class BatchIngestRequest(BaseModel):
    messages: list[BatchMessage]


class BatchIngestResponse(BaseModel):
    received: int
    imported: int
    skipped_duplicates: int


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_document(request: IngestRequest):
    """
    Ingest a document into the knowledge base.
    Generates an ID if not provided.
    Generates embedding for the content.
    Stores the document and vector in LanceDB.
    """
    # 1. Generate ID if missing
    if not request.id:
        request.id = str(uuid.uuid4())

    # 2. Embed content (CPU intensive, run in threadpool)
    embedding_service = EmbeddingService()
    try:
        # embed_text returns a list of floats
        vector = await run_in_threadpool(embedding_service.embed_text, request.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

    # 3. Build record dict (avoids hardcoded Vector(384) in Message model)
    record = {
        "id": request.id,
        "conversation_id": request.conversation_id,
        "platform": request.platform,
        "title": request.title,
        "content": request.content,
        "role": request.role,
        "timestamp": request.timestamp,
        "url": request.url,
        "vector": vector,
        "embedding_model": embedding_service.get_model_name(),
    }

    # 4. Insert into LanceDB
    try:
        table = db_client.get_table("messages")
        await run_in_threadpool(table.add, [record])

        # Record write for compaction tracking
        compaction_manager.record_write()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")

    return {"id": request.id, "status": "created"}


@router.post("/ingest/batch", response_model=BatchIngestResponse)
async def ingest_batch(request: BatchIngestRequest):
    """Ingest a batch of messages in one request.

    Designed for extension bulk-import of hundreds of conversations.
    Deduplicates by message ID against existing records.
    Max 100 messages per request.
    """
    # 1. Validate batch size
    if len(request.messages) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size {len(request.messages)} exceeds maximum of {MAX_BATCH_SIZE}",
        )

    if not request.messages:
        return BatchIngestResponse(received=0, imported=0, skipped_duplicates=0)

    # 2. Validate each message
    for i, msg in enumerate(request.messages):
        if not CONV_ID_RE.match(msg.conversation_id):
            raise HTTPException(
                status_code=400,
                detail=f"Message {i}: invalid conversation_id '{msg.conversation_id}' "
                       f"(must match ^[a-zA-Z0-9\\-_]+$)",
            )
        if msg.platform not in ALLOWED_PLATFORMS:
            raise HTTPException(
                status_code=400,
                detail=f"Message {i}: invalid platform '{msg.platform}' "
                       f"(allowed: {', '.join(ALLOWED_PLATFORMS)})",
            )
        if not msg.content or not msg.content.strip():
            raise HTTPException(
                status_code=400,
                detail=f"Message {i}: content must not be empty",
            )

    # 3. Assign IDs where missing
    messages_with_ids = []
    for msg in request.messages:
        messages_with_ids.append({
            "id": msg.id or str(uuid.uuid4()),
            "conversation_id": msg.conversation_id,
            "platform": msg.platform,
            "title": msg.title,
            "content": msg.content,
            "role": msg.role,
            "timestamp": msg.timestamp,
            "url": msg.url,
        })

    # 4. Deduplicate, embed, and insert (CPU/IO bound)
    def _process_batch(msgs: list[dict]) -> tuple[int, int]:
        embedding_service = EmbeddingService()
        table = db_client.get_table("messages")

        # Dedup against existing records
        conv_ids = {m["conversation_id"] for m in msgs}
        existing_ids = _get_existing_ids(table, conv_ids)

        records = []
        skipped = 0
        model_name = embedding_service.get_model_name()

        for msg in msgs:
            if msg["id"] in existing_ids:
                skipped += 1
                continue

            vector = embedding_service.embed_text(msg["content"])
            if not vector:
                skipped += 1
                continue

            records.append({
                "id": msg["id"],
                "conversation_id": msg["conversation_id"],
                "platform": msg["platform"],
                "title": msg["title"],
                "content": msg["content"],
                "role": msg["role"],
                "timestamp": _parse_timestamp(msg["timestamp"]),
                "url": msg["url"],
                "vector": vector,
                "embedding_model": model_name,
            })

        if records:
            table.add(records)
            compaction_manager.record_write()

        return len(records), skipped

    try:
        imported, skipped = await run_in_threadpool(_process_batch, messages_with_ids)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Batch ingest failed: {str(e)}",
        )

    return BatchIngestResponse(
        received=len(request.messages),
        imported=imported,
        skipped_duplicates=skipped,
    )
