import io
import zipfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client

router = APIRouter(dependencies=[Depends(verify_api_key)])

ALLOWED_PLATFORMS = ["chatgpt", "claude", "claude-code", "gemini", "perplexity", "cursor"]


class ExportRequest(BaseModel):
    platforms: Optional[list[str]] = None


def _to_unix_ms(val) -> int:
    if isinstance(val, str):
        val = datetime.fromisoformat(val.replace("Z", "+00:00"))
    return int(val.timestamp() * 1000) if val else 0


def _format_date(val) -> str:
    if isinstance(val, str):
        val = datetime.fromisoformat(val.replace("Z", "+00:00"))
    return val.strftime("%B %d, %Y") if val else ""


def _format_time(val) -> str:
    if isinstance(val, str):
        val = datetime.fromisoformat(val.replace("Z", "+00:00"))
    return val.strftime("%-I:%M %p") if val else ""


def _is_user_role(role: str) -> bool:
    return role.lower() in ("user", "human")


def _safe_filename(title: str, conv_id: str) -> str:
    import re
    safe = re.sub(r"[^a-zA-Z0-9\-_ ]", "", title).strip().replace(" ", "-")[:60]
    if not safe:
        safe = conv_id[:20]
    return safe


def _conversation_to_markdown(messages: list[dict], title: str, platform: str) -> str:
    lines = [f"# {title}", ""]
    lines.append(f"**Platform:** {platform}")
    if messages:
        lines.append(f"**Date:** {_format_date(messages[0].get('timestamp'))}")
        lines.append(f"**Messages:** {len(messages)}")
    lines.extend(["", "---", ""])

    for msg in messages:
        role = "User" if _is_user_role(msg.get("role", "user")) else "Assistant"
        time_str = _format_time(msg.get("timestamp"))
        lines.append(f"## {role} *({time_str})*")
        lines.append("")
        lines.append(msg.get("content", ""))
        lines.append("")

    return "\n".join(lines)


@router.post("/export")
async def export_conversations(request: ExportRequest):
    """Export all conversations as a zip of markdown files."""

    platforms_filter = []
    if request.platforms:
        platforms_filter = [p for p in request.platforms if p in ALLOWED_PLATFORMS]

    def query_all():
        table = db_client.get_table("messages")
        dummy_vector = [0.0] * 384

        filters = []
        if platforms_filter:
            platform_list = "', '".join(platforms_filter)
            filters.append(f"platform IN ('{platform_list}')")

        where_clause = " AND ".join(filters) if filters else None
        query_builder = table.search(dummy_vector, query_type="vector")
        if where_clause:
            query_builder = query_builder.where(where_clause)

        query_builder = query_builder.select(
            ["id", "conversation_id", "timestamp", "platform", "title", "content", "url", "role"]
        )
        return query_builder.limit(100000).to_list()

    results = await run_in_threadpool(query_all)

    # Group by conversation_id
    conversations: dict[str, list[dict]] = {}
    for r in results:
        conv_id = r.get("conversation_id", "unknown")
        conversations.setdefault(conv_id, []).append(r)

    # Sort messages within each conversation by timestamp
    for messages in conversations.values():
        messages.sort(key=lambda m: _to_unix_ms(m.get("timestamp")))

    # Build zip in memory
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        used_names: set[str] = set()
        for conv_id, messages in conversations.items():
            title = messages[0].get("title", "") or conv_id
            platform = messages[0].get("platform", "unknown")
            md = _conversation_to_markdown(messages, title, platform)

            basename = _safe_filename(title, conv_id)
            filename = basename
            counter = 1
            while filename in used_names:
                filename = f"{basename}-{counter}"
                counter += 1
            used_names.add(filename)

            zf.writestr(f"{filename}.md", md)

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="wims-export-{datetime.now().strftime("%Y%m%d")}.zip"'
        },
    )
