import io
import zipfile
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client

router = APIRouter(dependencies=[Depends(verify_api_key)])

ALLOWED_PLATFORMS = [
    "aider",
    "antigravity",
    "chatgpt",
    "claude",
    "claude-code",
    "cline",
    "continue",
    "copilot",
    "cursor",
    "deepseek",
    "doubao",
    "gemini",
    "grok",
    "huggingchat",
    "jan",
    "kimi",
    "lechat",
    "open-webui",
    "perplexity",
    "poe",
    "qwen",
]


class ExportRequest(BaseModel):
    platforms: list[str] | None = None
    # "markdown" (zip), "json" (wims-archive), "obsidian", or "html"
    format: str = "markdown"
    conversation_id: str | None = None


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


def _conversation_to_obsidian(messages: list[dict], title: str, platform: str, conv_id: str) -> str:
    """Convert conversation to Obsidian-compatible markdown with YAML frontmatter."""
    date_str = ""
    if messages:
        ts = messages[0].get("timestamp")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts:
            date_str = ts.strftime("%Y-%m-%d")

    safe_title = title.replace('"', "'")
    lines = [
        "---",
        f'title: "{safe_title}"',
        f"platform: {platform}",
        f"conversation_id: {conv_id}",
        f"date: {date_str}",
        f"messages: {len(messages)}",
        "tags:",
        "  - wims",
        f"  - {platform}",
        "---",
        "",
        f"# {title}",
        "",
    ]

    for msg in messages:
        role = "User" if _is_user_role(msg.get("role", "user")) else "Assistant"
        time_str = _format_time(msg.get("timestamp"))
        lines.append(f"## {role} *({time_str})*")
        lines.append("")
        lines.append(msg.get("content", ""))
        lines.append("")

    return "\n".join(lines)


def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _conversation_to_html(messages: list[dict], title: str, platform: str) -> str:
    """Convert a conversation to a self-contained HTML file."""
    safe_title = _escape_html(title)
    rows = []
    for msg in messages:
        role = "User" if _is_user_role(msg.get("role", "user")) else "Assistant"
        time_str = _format_time(msg.get("timestamp"))
        content = _escape_html(msg.get("content", "")).replace("\n", "<br>")
        bg = "#e3f2fd" if role == "User" else "#f5f5f5"
        rows.append(
            f'<div style="background:{bg};border-radius:8px;padding:12px;margin:8px 0;">'
            f'<div style="font-size:12px;color:#666;margin-bottom:4px;">'
            f"<strong>{role}</strong> &mdash; {time_str}</div>"
            f'<div style="white-space:pre-wrap;font-size:14px;">{content}</div></div>'
        )
    body = "\n".join(rows)
    css = (
        "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
        "max-width:800px;margin:0 auto;padding:20px;background:#fff;color:#333}"
        "h1{font-size:1.5em;border-bottom:2px solid #eee;padding-bottom:8px}"
        ".meta{color:#888;font-size:13px;margin-bottom:16px}"
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{safe_title}</title>
<style>{css}</style>
</head>
<body>
<h1>{safe_title}</h1>
<div class="meta">Platform: {_escape_html(platform)} &bull; {len(messages)} messages</div>
{body}
<footer style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:12px;color:#999;">
Exported from WIMS on {datetime.now().strftime("%Y-%m-%d %H:%M")}
</footer>
</body>
</html>"""


def _to_iso(val) -> str:
    if isinstance(val, str):
        return val
    if isinstance(val, datetime):
        return val.isoformat()
    return ""


@router.post("/export")
async def export_conversations(request: ExportRequest):
    """Export all conversations as a zip of markdown files or WIMS JSON archive.

    Set format to "json" to get a WIMS archive that can be re-imported via POST /api/v1/import.
    """

    platforms_filter = []
    if request.platforms:
        platforms_filter = [p for p in request.platforms if p in ALLOWED_PLATFORMS]

    def query_all():
        table = db_client.get_table("messages")
        dummy_vector = [0.0] * db_client.get_vector_dim()

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

    # JSON format: return WIMS archive
    if request.format == "json":
        archive = {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "source": "wims",
            "conversations": [],
        }
        for conv_id, messages in conversations.items():
            conv_data = {
                "conversation_id": conv_id,
                "platform": messages[0].get("platform", "unknown"),
                "title": messages[0].get("title", ""),
                "url": messages[0].get("url", ""),
                "messages": [
                    {
                        "id": m.get("id", ""),
                        "role": m.get("role", "user"),
                        "content": m.get("content", ""),
                        "timestamp": _to_iso(m.get("timestamp")),
                    }
                    for m in messages
                ],
            }
            archive["conversations"].append(conv_data)

        import json

        json_bytes = json.dumps(archive, ensure_ascii=False, indent=2).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="wims-archive-{datetime.now().strftime("%Y%m%d")}.json"'
            },
        )

    # Obsidian format: markdown with YAML frontmatter, organized by platform
    if request.format == "obsidian":
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            used_names: set[str] = set()
            for conv_id, messages in conversations.items():
                title = messages[0].get("title", "") or conv_id
                platform = messages[0].get("platform", "unknown")
                md = _conversation_to_obsidian(messages, title, platform, conv_id)

                basename = _safe_filename(title, conv_id)
                filename = f"{platform}/{basename}"
                full = filename
                counter = 1
                while full in used_names:
                    full = f"{filename}-{counter}"
                    counter += 1
                used_names.add(full)

                zf.writestr(f"{full}.md", md)

        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="wims-obsidian-{datetime.now().strftime("%Y%m%d")}.zip"'
            },
        )

    # HTML format: self-contained HTML file(s)
    if request.format == "html":
        if request.conversation_id and request.conversation_id in conversations:
            # Single conversation as HTML
            messages = conversations[request.conversation_id]
            title = messages[0].get("title", "") or request.conversation_id
            platform = messages[0].get("platform", "unknown")
            html = _conversation_to_html(messages, title, platform)
            safe = _safe_filename(title, request.conversation_id)
            return StreamingResponse(
                io.BytesIO(html.encode("utf-8")),
                media_type="text/html",
                headers={"Content-Disposition": f'attachment; filename="{safe}.html"'},
            )
        # Multiple conversations: zip of HTML files
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            used_names_html: set[str] = set()
            for conv_id, messages in conversations.items():
                title = messages[0].get("title", "") or conv_id
                platform = messages[0].get("platform", "unknown")
                html = _conversation_to_html(messages, title, platform)
                basename = _safe_filename(title, conv_id)
                filename = basename
                counter = 1
                while filename in used_names_html:
                    filename = f"{basename}-{counter}"
                    counter += 1
                used_names_html.add(filename)
                zf.writestr(f"{filename}.html", html)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="wims-html-{datetime.now().strftime("%Y%m%d")}.zip"'
            },
        )

    # Markdown format (default): return zip
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        used_names_md: set[str] = set()
        for conv_id, messages in conversations.items():
            title = messages[0].get("title", "") or conv_id
            platform = messages[0].get("platform", "unknown")
            md = _conversation_to_markdown(messages, title, platform)

            basename = _safe_filename(title, conv_id)
            filename = basename
            counter = 1
            while filename in used_names_md:
                filename = f"{basename}-{counter}"
                counter += 1
            used_names_md.add(filename)

            zf.writestr(f"{filename}.md", md)

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="wims-export-{datetime.now().strftime("%Y%m%d")}.zip"'},
    )
