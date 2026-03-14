"""Import endpoints for WIMS JSON archives and platform-native exports."""

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.db.compaction import compaction_manager
from src.app.services.embedding import EmbeddingService

router = APIRouter(dependencies=[Depends(verify_api_key)])

ALLOWED_PLATFORMS = [
    "aider", "antigravity", "chatgpt", "claude", "claude-code", "cline",
    "continue", "copilot", "cursor", "deepseek", "doubao", "gemini",
    "grok", "huggingchat", "jan", "kimi", "lechat", "perplexity", "poe", "qwen",
]
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB


async def _read_json_upload(file: UploadFile) -> dict | list:
    """Read and parse a JSON file upload with size limit."""
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 500MB)")
    try:
        return json.loads(contents)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")


def _parse_timestamp(val) -> datetime:
    """Parse a timestamp value into a naive UTC datetime for LanceDB."""
    if isinstance(val, datetime):
        # Strip timezone info (LanceDB uses naive timestamps)
        return val.replace(tzinfo=None)
    if isinstance(val, (int, float)):
        return datetime.fromtimestamp(val, tz=UTC).replace(tzinfo=None)
    if isinstance(val, str):
        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    return datetime.now(UTC).replace(tzinfo=None)


def _get_existing_ids(table, conversation_ids: set[str]) -> set[str]:
    """Look up which message IDs already exist for the given conversations."""
    if not conversation_ids:
        return set()
    try:
        cid_list = "', '".join(conversation_ids)
        where = f"conversation_id IN ('{cid_list}')"
        dim = db_client.get_vector_dim()
        dummy_vector = [0.0] * dim
        rows = (
            table.search(dummy_vector, query_type="vector")
            .where(where)
            .select(["id"])
            .limit(100000)
            .to_list()
        )
        return {r["id"] for r in rows}
    except Exception:
        return set()


def _embed_and_insert(messages: list[dict]) -> tuple[int, int]:
    """Generate embeddings and insert messages into LanceDB.

    Returns (inserted_count, skipped_duplicates).
    """
    if not messages:
        return 0, 0

    embedding_service = EmbeddingService()
    table = db_client.get_table("messages")

    # Dedup: check which messages already exist
    conv_ids = {m["conversation_id"] for m in messages}
    existing_ids = _get_existing_ids(table, conv_ids)

    # Build records with embeddings, skipping duplicates
    records = []
    skipped = 0
    model_name = embedding_service.get_model_name()
    for msg in messages:
        if msg["id"] in existing_ids:
            skipped += 1
            continue
        vector = embedding_service.embed_text(msg["content"])
        if not vector:
            continue
        records.append(
            {
                "id": msg["id"],
                "conversation_id": msg["conversation_id"],
                "platform": msg["platform"],
                "title": msg.get("title", ""),
                "content": msg["content"],
                "role": msg.get("role", "user"),
                "timestamp": _parse_timestamp(msg.get("timestamp")),
                "url": msg.get("url", ""),
                "vector": vector,
                "embedding_model": model_name,
            }
        )

    if records:
        table.add(records)
        compaction_manager.record_write()

    return len(records), skipped


@router.post("/import")
async def import_wims_archive(file: UploadFile):
    """Import a WIMS JSON archive (exported via /api/v1/export?format=json).

    Re-generates embeddings on this machine for all imported messages.
    """
    data = await _read_json_upload(file)

    if not isinstance(data, dict) or "conversations" not in data:
        raise HTTPException(status_code=400, detail="Invalid WIMS archive format: missing 'conversations' key")

    archive_version = data.get("version", "1.0")
    conversations = data["conversations"]

    if not isinstance(conversations, list):
        raise HTTPException(status_code=400, detail="Invalid WIMS archive: 'conversations' must be a list")

    # Flatten all messages
    messages = []
    for conv in conversations:
        conv_id = conv.get("conversation_id", str(uuid.uuid4()))
        platform = conv.get("platform", "unknown")
        title = conv.get("title", "")
        url = conv.get("url", "")

        for msg in conv.get("messages", []):
            content = msg.get("content", "")
            if not content or not content.strip():
                continue
            messages.append(
                {
                    "id": msg.get("id", str(uuid.uuid4())),
                    "conversation_id": conv_id,
                    "platform": platform,
                    "title": title,
                    "url": url,
                    "role": msg.get("role", "user"),
                    "content": content,
                    "timestamp": msg.get("timestamp", datetime.now(UTC).isoformat()),
                }
            )

    imported, skipped = await run_in_threadpool(_embed_and_insert, messages)

    return {
        "imported": imported,
        "skipped_duplicates": skipped,
        "conversations": len(conversations),
        "archive_version": archive_version,
    }


def _parse_chatgpt_export(data: list) -> list[dict]:
    """Parse ChatGPT conversations.json into flat message list."""
    messages = []
    for conv in data:
        if not isinstance(conv, dict):
            continue
        title = conv.get("title", "Untitled")
        conv_id = conv.get("id", str(uuid.uuid4()))
        create_time = conv.get("create_time")

        mapping = conv.get("mapping", {})
        if not isinstance(mapping, dict):
            continue

        for node_id, node in mapping.items():
            if not isinstance(node, dict):
                continue
            msg = node.get("message")
            if not msg or not isinstance(msg, dict):
                continue

            author = msg.get("author", {})
            role = author.get("role", "user") if isinstance(author, dict) else "user"
            if role == "system":
                continue

            content_obj = msg.get("content", {})
            if isinstance(content_obj, dict):
                parts = content_obj.get("parts", [])
                content = "\n".join(str(p) for p in parts if isinstance(p, str) and p.strip())
            elif isinstance(content_obj, str):
                content = content_obj
            else:
                continue

            if not content or not content.strip():
                continue

            msg_time = msg.get("create_time") or create_time
            if isinstance(msg_time, (int, float)):
                ts = datetime.fromtimestamp(msg_time, tz=UTC).isoformat()
            else:
                ts = datetime.now(UTC).isoformat()

            messages.append(
                {
                    "id": msg.get("id", str(uuid.uuid4())),
                    "conversation_id": conv_id,
                    "platform": "chatgpt",
                    "title": title,
                    "url": f"https://chat.openai.com/c/{conv_id}",
                    "role": "user" if role in ("user", "human") else "assistant",
                    "content": content,
                    "timestamp": ts,
                }
            )
    return messages


def _parse_claude_export(data: list | dict) -> list[dict]:
    """Parse Claude data export into flat message list.

    Claude exports come as a list of conversation objects with chat_messages arrays.
    """
    conversations = data if isinstance(data, list) else data.get("conversations", data.get("chats", []))
    if not isinstance(conversations, list):
        return []

    messages = []
    for conv in conversations:
        if not isinstance(conv, dict):
            continue
        conv_id = conv.get("uuid", conv.get("id", str(uuid.uuid4())))
        title = conv.get("name", conv.get("title", "Untitled"))

        chat_messages = conv.get("chat_messages", conv.get("messages", []))
        if not isinstance(chat_messages, list):
            continue

        for msg in chat_messages:
            if not isinstance(msg, dict):
                continue
            role = msg.get("sender", msg.get("role", "user"))
            if role == "system":
                continue

            # Claude exports may nest content in text field or content array
            content = ""
            if isinstance(msg.get("text"), str):
                content = msg["text"]
            elif isinstance(msg.get("content"), str):
                content = msg["content"]
            elif isinstance(msg.get("content"), list):
                parts = []
                for part in msg["content"]:
                    if isinstance(part, str):
                        parts.append(part)
                    elif isinstance(part, dict) and part.get("type") == "text":
                        parts.append(part.get("text", ""))
                content = "\n".join(parts)

            if not content or not content.strip():
                continue

            ts_raw = msg.get("created_at", msg.get("timestamp", msg.get("created")))
            if isinstance(ts_raw, (int, float)):
                ts = datetime.fromtimestamp(ts_raw, tz=UTC).isoformat()
            elif isinstance(ts_raw, str):
                ts = ts_raw
            else:
                ts = datetime.now(UTC).isoformat()

            messages.append(
                {
                    "id": msg.get("uuid", msg.get("id", str(uuid.uuid4()))),
                    "conversation_id": conv_id,
                    "platform": "claude",
                    "title": title,
                    "url": "",
                    "role": "user" if role in ("user", "human") else "assistant",
                    "content": content,
                    "timestamp": ts,
                }
            )
    return messages


@router.post("/import/chatgpt")
async def import_chatgpt(file: UploadFile):
    """Import conversations from a ChatGPT data export (conversations.json)."""
    data = await _read_json_upload(file)

    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="Expected a JSON array of conversations")

    messages = _parse_chatgpt_export(data)
    if not messages:
        raise HTTPException(status_code=400, detail="No valid messages found in ChatGPT export")

    imported, skipped = await run_in_threadpool(_embed_and_insert, messages)
    return {
        "imported": imported,
        "skipped_duplicates": skipped,
        "conversations": len({m["conversation_id"] for m in messages}),
        "platform": "chatgpt",
    }


@router.post("/import/claude")
async def import_claude(file: UploadFile):
    """Import conversations from a Claude data export."""
    data = await _read_json_upload(file)

    messages = _parse_claude_export(data)
    if not messages:
        raise HTTPException(status_code=400, detail="No valid messages found in Claude export")

    imported, skipped = await run_in_threadpool(_embed_and_insert, messages)
    return {
        "imported": imported,
        "skipped_duplicates": skipped,
        "conversations": len({m["conversation_id"] for m in messages}),
        "platform": "claude",
    }
