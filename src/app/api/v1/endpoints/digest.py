from collections import defaultdict
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client

ALLOWED_PLATFORMS = [
    "aider", "antigravity", "chatgpt", "claude", "claude-code", "cline",
    "continue", "copilot", "cursor", "deepseek", "doubao", "gemini",
    "grok", "huggingchat", "jan", "kimi", "lechat", "open-webui",
    "perplexity", "poe", "qwen",
]

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/digest")
async def get_digest(period: str = Query("today", pattern="^(today|this_week)$")):
    """Return a digest of recent conversations.

    Groups conversations by platform with titles and counts for the given period.
    """
    now = datetime.now(UTC)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:  # this_week
        start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    naive_start = start.replace(tzinfo=None).isoformat()

    def query_recent():
        table = db_client.get_table("messages")
        dim = db_client.get_vector_dim()
        rows = (
            table.search([0.0] * dim, query_type="vector")
            .where(f"timestamp >= timestamp '{naive_start}'")
            .select(["conversation_id", "platform", "title", "role", "content", "timestamp"])
            .limit(100000)
            .to_list()
        )
        return rows

    rows = await run_in_threadpool(query_recent)

    # Group by conversation
    convs: dict[str, dict] = {}
    for r in rows:
        cid = r.get("conversation_id", "")
        if cid not in convs:
            convs[cid] = {
                "conversation_id": cid,
                "platform": r.get("platform", "unknown"),
                "title": r.get("title", ""),
                "message_count": 0,
                "first_user_message": "",
            }
        convs[cid]["message_count"] += 1
        if r.get("role") == "user" and not convs[cid]["first_user_message"]:
            msg = r.get("content", "")
            convs[cid]["first_user_message"] = msg[:200] + ("..." if len(msg) > 200 else "")

    # Group by platform
    by_platform: dict[str, list[dict]] = defaultdict(list)
    for conv in convs.values():
        by_platform[conv["platform"]].append(conv)

    return {
        "period": period,
        "total_conversations": len(convs),
        "total_messages": len(rows),
        "by_platform": {
            platform: {
                "count": len(conversations),
                "conversations": [
                    {
                        "conversation_id": c["conversation_id"],
                        "title": c["title"],
                        "first_user_message": c["first_user_message"],
                        "message_count": c["message_count"],
                    }
                    for c in conversations
                ],
            }
            for platform, conversations in by_platform.items()
        },
    }
