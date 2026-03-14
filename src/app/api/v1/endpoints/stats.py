from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.schemas.stats import ActivityEntry, StatsResponse

# Whitelist of allowed platforms for security validation
ALLOWED_PLATFORMS = [
    "aider", "antigravity", "chatgpt", "claude", "claude-code", "cline",
    "continue", "copilot", "cursor", "deepseek", "doubao", "gemini",
    "grok", "huggingchat", "jan", "kimi", "lechat", "open-webui",
    "perplexity", "poe", "qwen",
]

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    platforms: str | None = Query(None),
):
    """
    Return aggregated statistics about captured conversations.
    Accepts optional query params:
    - granularity: one of "day", "week", "month" (default "day")
    - platforms: comma-separated string of platform names to filter by
    """
    # 1. Validate and parse platform filter
    platforms_to_filter = []
    if platforms:
        for p in platforms.split(","):
            p = p.strip()
            if p in ALLOWED_PLATFORMS:
                platforms_to_filter.append(p)

    # 2. Query LanceDB table
    try:
        table = db_client.get_table("messages")

        def query_table():
            dummy_vector = [0.0] * db_client.get_vector_dim()
            query_builder = table.search(dummy_vector, query_type="vector")

            if platforms_to_filter:
                platform_list = "', '".join(platforms_to_filter)
                query_builder = query_builder.where(f"platform IN ('{platform_list}')")

            query_builder = query_builder.select(["id", "conversation_id", "timestamp", "platform"])
            results = query_builder.limit(100000).to_list()
            return results

        results = await run_in_threadpool(query_table)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats query failed: {str(e)}")

    # 3. Parse timestamps
    for r in results:
        timestamp_value = r.get("timestamp")
        if isinstance(timestamp_value, str):
            r["timestamp"] = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))

    # 4. Compute aggregates
    total_messages = len(results)

    conversation_ids = {r.get("conversation_id") for r in results}
    total_conversations = len(conversation_ids)

    # by_platform: platform -> message count
    by_platform: dict[str, int] = defaultdict(int)
    # conversations_by_platform: platform -> set of conversation_ids
    convs_by_platform: dict[str, set] = defaultdict(set)

    for r in results:
        platform_name = r.get("platform", "unknown")
        by_platform[platform_name] += 1
        convs_by_platform[platform_name].add(r.get("conversation_id"))

    conversations_by_platform = {p: len(convs) for p, convs in convs_by_platform.items()}

    # 5. Build activity timeline
    today = datetime.now().date()

    if granularity == "day":
        # Last 30 days
        num_periods = 30
        dates = []
        for i in range(num_periods - 1, -1, -1):
            d = today - timedelta(days=i)
            dates.append(d.isoformat())

        # Count messages per day
        day_counts: dict[str, int] = defaultdict(int)
        for r in results:
            ts = r.get("timestamp")
            if ts:
                day_key = ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10]
                day_counts[day_key] += 1

        activity = [ActivityEntry(date=d, count=day_counts.get(d, 0)) for d in dates]

    elif granularity == "week":
        # Last 12 weeks, Monday as week start
        num_periods = 12
        # Find the Monday of the current week
        current_monday = today - timedelta(days=today.weekday())
        dates = []
        for i in range(num_periods - 1, -1, -1):
            monday = current_monday - timedelta(weeks=i)
            dates.append(monday.isoformat())

        # Count messages per week (by Monday)
        week_counts: dict[str, int] = defaultdict(int)
        for r in results:
            ts = r.get("timestamp")
            if ts:
                msg_date = ts.date() if hasattr(ts, "date") else datetime.fromisoformat(str(ts)[:10]).date()
                msg_monday = msg_date - timedelta(days=msg_date.weekday())
                week_counts[msg_monday.isoformat()] += 1

        activity = [ActivityEntry(date=d, count=week_counts.get(d, 0)) for d in dates]

    else:
        # month: last 12 months
        num_periods = 12
        dates = []
        year = today.year
        month = today.month
        for i in range(num_periods - 1, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            dates.append(f"{y:04d}-{m:02d}-01")

        # Count messages per month
        month_counts: dict[str, int] = defaultdict(int)
        for r in results:
            ts = r.get("timestamp")
            if ts:
                if hasattr(ts, "date"):
                    msg_date = ts.date()
                else:
                    msg_date = datetime.fromisoformat(str(ts)[:10]).date()
                month_key = f"{msg_date.year:04d}-{msg_date.month:02d}-01"
                month_counts[month_key] += 1

        activity = [ActivityEntry(date=d, count=month_counts.get(d, 0)) for d in dates]

    return StatsResponse(
        total_messages=total_messages,
        total_conversations=total_conversations,
        by_platform=dict(by_platform),
        conversations_by_platform=conversations_by_platform,
        activity=activity,
    )
