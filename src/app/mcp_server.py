"""
WIMS MCP Server — Expose conversation search as MCP tools for AI assistants.

Run with:
    python -m src.app.mcp_server
    fastmcp run src/app/mcp_server.py
"""

from datetime import datetime

from fastmcp import FastMCP

from src.app.db.client import db_client, init_db
from src.app.services.embedding import EmbeddingService

ALLOWED_PLATFORMS = ["chatgpt", "claude", "claude-code", "gemini", "perplexity", "cursor"]

mcp = FastMCP("WIMS")


def _init():
    """Initialize DB connection (called lazily on first tool use)."""
    if db_client._db is None:
        init_db()


def _format_timestamp(val) -> str:
    if isinstance(val, str):
        val = datetime.fromisoformat(val.replace("Z", "+00:00"))
    return val.strftime("%Y-%m-%d %H:%M") if val else ""


@mcp.tool
def search_conversations(
    query: str,
    platform: str | None = None,
    limit: int = 10,
) -> str:
    """Search your AI conversation history using semantic search.

    Returns conversations matching the query across all captured platforms
    (ChatGPT, Claude, Gemini, Perplexity, Claude Code, Cursor).

    Args:
        query: Natural language search query (e.g. "React hooks debugging")
        platform: Optional filter — one of: chatgpt, claude, claude-code, gemini, perplexity, cursor
        limit: Max number of conversations to return (default 10)
    """
    _init()

    embedding_service = EmbeddingService()
    query_vector = embedding_service.embed_text(query)
    if not query_vector:
        return "Error: failed to generate embedding for query."

    table = db_client.get_table("messages")

    # Build filter
    filters = []
    if platform and platform in ALLOWED_PLATFORMS:
        filters.append(f"platform = '{platform}'")
    where_clause = " AND ".join(filters) if filters else None

    # Vector search
    search = table.search(query_vector, query_type="vector")
    if where_clause:
        search = search.where(where_clause)
    search = search.select(
        ["id", "conversation_id", "timestamp", "platform", "title", "content", "url", "role"]
    )
    results = search.limit(limit * 5).to_list()

    # Remove duplicates by conversation and keep best match per conversation
    seen_convs: dict[str, dict] = {}
    for r in results:
        if "vector" in r:
            del r["vector"]
        cid = r.get("conversation_id", "")
        if cid not in seen_convs:
            seen_convs[cid] = r

    # Format output
    conversations = list(seen_convs.values())[:limit]
    if not conversations:
        return f"No conversations found matching: {query}"

    lines = [f"Found {len(conversations)} conversation(s) matching \"{query}\":\n"]
    for i, r in enumerate(conversations, 1):
        title = r.get("title", "") or "Untitled"
        platform_name = r.get("platform", "unknown")
        ts = _format_timestamp(r.get("timestamp"))
        content = r.get("content", "")
        cid = r.get("conversation_id", "")
        url = r.get("url", "")

        # Truncate content preview
        preview = content[:300].replace("\n", " ")
        if len(content) > 300:
            preview += "..."

        lines.append(f"### {i}. {title}")
        lines.append(f"- **Platform:** {platform_name}")
        lines.append(f"- **Date:** {ts}")
        lines.append(f"- **Conversation ID:** {cid}")
        if url:
            lines.append(f"- **URL:** {url}")
        lines.append(f"- **Preview:** {preview}")
        lines.append("")

    return "\n".join(lines)


@mcp.tool
def get_conversation(conversation_id: str) -> str:
    """Get the full message thread for a specific conversation.

    Use this after search_conversations to read the complete conversation.

    Args:
        conversation_id: The conversation ID from search results
    """
    _init()

    table = db_client.get_table("messages")
    dummy_vector = [0.0] * db_client.get_vector_dim()

    search = table.search(dummy_vector, query_type="vector")
    search = search.where(f"conversation_id = '{conversation_id}'")
    search = search.select(
        ["id", "conversation_id", "timestamp", "platform", "title", "content", "url", "role"]
    )
    results = search.limit(10000).to_list()

    if not results:
        return f"No conversation found with ID: {conversation_id}"

    # Sort by timestamp ascending
    results.sort(key=lambda r: str(r.get("timestamp", "")))

    title = results[0].get("title", "") or "Untitled"
    platform = results[0].get("platform", "unknown")
    url = results[0].get("url", "")

    lines = [f"# {title}"]
    lines.append(f"**Platform:** {platform} | **Messages:** {len(results)}")
    if url:
        lines.append(f"**URL:** {url}")
    lines.append(f"**Conversation ID:** {conversation_id}")
    lines.append("\n---\n")

    for msg in results:
        role = msg.get("role", "user")
        ts = _format_timestamp(msg.get("timestamp"))
        content = msg.get("content", "")
        role_label = "User" if role in ("user", "human") else "Assistant"
        lines.append(f"**{role_label}** ({ts}):")
        lines.append(content)
        lines.append("")

    return "\n".join(lines)


@mcp.tool
def get_recent_conversations(
    limit: int = 10,
    platform: str | None = None,
) -> str:
    """Get your most recent AI conversations.

    Useful for recalling what you were working on recently.

    Args:
        limit: Max number of conversations to return (default 10)
        platform: Optional filter — one of: chatgpt, claude, claude-code, gemini, perplexity, cursor
    """
    _init()

    table = db_client.get_table("messages")
    dummy_vector = [0.0] * db_client.get_vector_dim()

    filters = []
    if platform and platform in ALLOWED_PLATFORMS:
        filters.append(f"platform = '{platform}'")
    where_clause = " AND ".join(filters) if filters else None

    search = table.search(dummy_vector, query_type="vector")
    if where_clause:
        search = search.where(where_clause)
    search = search.select(
        ["id", "conversation_id", "timestamp", "platform", "title", "content", "url", "role"]
    )
    results = search.limit(10000).to_list()

    if not results:
        return "No conversations found."

    # Group by conversation, find latest timestamp and first user message
    conversations: dict[str, dict] = {}
    for r in results:
        cid = r.get("conversation_id", "")
        ts = r.get("timestamp")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))

        if cid not in conversations:
            conversations[cid] = {
                "title": r.get("title", ""),
                "platform": r.get("platform", ""),
                "url": r.get("url", ""),
                "latest_ts": ts,
                "count": 1,
                "first_user_message": "",
                "messages": [r],
            }
        else:
            conv = conversations[cid]
            conv["count"] += 1
            conv["messages"].append(r)
            if ts and (not conv["latest_ts"] or ts > conv["latest_ts"]):
                conv["latest_ts"] = ts

    # Find first user message per conversation
    for conv in conversations.values():
        user_msgs = [m for m in conv["messages"] if m.get("role") in ("user", "human")]
        if user_msgs:
            user_msgs.sort(key=lambda m: str(m.get("timestamp", "")))
            msg = user_msgs[0].get("content", "")
            conv["first_user_message"] = msg[:200] + "..." if len(msg) > 200 else msg
        del conv["messages"]  # Free memory

    # Sort by latest timestamp descending
    sorted_convs = sorted(
        conversations.items(),
        key=lambda x: x[1]["latest_ts"] or datetime.min,
        reverse=True,
    )[:limit]

    lines = [f"Your {len(sorted_convs)} most recent conversations:\n"]
    for i, (cid, conv) in enumerate(sorted_convs, 1):
        title = conv["title"] or "Untitled"
        ts = _format_timestamp(conv["latest_ts"])
        platform_name = conv["platform"]
        count = conv["count"]
        first_msg = conv["first_user_message"]

        lines.append(f"### {i}. {title}")
        lines.append(f"- **Platform:** {platform_name} | **Messages:** {count} | **Last active:** {ts}")
        lines.append(f"- **Conversation ID:** {cid}")
        if first_msg:
            lines.append(f"- **First question:** {first_msg}")
        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
