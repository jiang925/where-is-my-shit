import base64
import json
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.schemas.message import BrowseItem, BrowseRequest, BrowseResponse

# Whitelist of allowed platforms for security validation
ALLOWED_PLATFORMS = ['chatgpt', 'claude', 'claude-code', 'gemini', 'perplexity', 'cursor']

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/browse", response_model=BrowseResponse)
async def browse_documents(request: BrowseRequest):
    """
    Browse conversations chronologically with cursor-based pagination.
    Unlike search, this endpoint does not require a query and returns all conversations
    sorted by timestamp (newest first).
    """
    # 1. Calculate date range filter
    start_date = None
    if request.date_range and request.date_range != "all_time":
        today = date.today()
        if request.date_range == "today":
            start_date = datetime.combine(today, time.min)
        elif request.date_range == "this_week":
            # Monday is 0, Sunday is 6
            days_since_monday = today.weekday()
            start_date = datetime.combine(today - timedelta(days=days_since_monday), time.min)
        elif request.date_range == "this_month":
            start_date = datetime.combine(date(today.year, today.month, 1), time.min)

    # 2. Validate platform filter
    platforms_to_filter = []
    if request.platforms:
        for p in request.platforms:
            if p in ALLOWED_PLATFORMS:
                platforms_to_filter.append(p)

    # 3. Decode cursor
    cursor_timestamp = None
    cursor_id = None
    if request.cursor:
        try:
            cursor_data = json.loads(base64.b64decode(request.cursor).decode())
            cursor_timestamp = cursor_data.get("timestamp")
            cursor_id = cursor_data.get("id")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid cursor format: {str(e)}")

    # 4. Build LanceDB query
    try:
        table = db_client.get_table("messages")

        # Build WHERE clause filters
        filters = []

        # Date filter
        if start_date:
            start_date_iso = start_date.isoformat()
            filters.append(f"timestamp >= '{start_date_iso}'")

        # Platform filter
        if platforms_to_filter:
            platform_list = "', '".join(platforms_to_filter)
            filters.append(f"platform IN ('{platform_list}')")

        # Cursor filter (composite: timestamp < cursor_ts OR (timestamp = cursor_ts AND id < cursor_id))
        if cursor_timestamp and cursor_id:
            filters.append(f"(timestamp < '{cursor_timestamp}' OR (timestamp = '{cursor_timestamp}' AND id < '{cursor_id}'))")

        where_clause = " AND ".join(filters) if filters else None

        # Query: Use LanceDB's search() to create a scan query
        # We don't need vector search, so we'll use the table scanner directly
        # The most reliable approach is to use the underlying lance dataset scanner
        def query_table():
            import pyarrow.compute as pc

            lance_ds = table.to_lance()
            columns = ["id", "conversation_id", "timestamp", "platform", "title", "content", "url"]

            # Build PyArrow filter expression
            filter_expr = None
            if where_clause:
                # Since we have complex SQL-like WHERE clause, we need to parse it
                # For simplicity, we'll fetch all data and filter in Python
                # This is acceptable for browse operations with reasonable dataset sizes
                scanner = lance_ds.scanner(columns=columns)
            else:
                scanner = lance_ds.scanner(columns=columns)

            results_table = scanner.to_table()
            return results_table.to_pylist()

        results_list = await run_in_threadpool(query_table)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Browse query failed: {str(e)}")

    # 5. Apply filters in Python (since complex WHERE clause might not be fully supported)
    filtered_results = []
    for r in results_list:
        # Apply date filter
        if start_date:
            timestamp_value = r.get("timestamp")
            if isinstance(timestamp_value, str):
                timestamp_value = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
            if timestamp_value < start_date:
                continue

        # Apply platform filter
        if platforms_to_filter and r.get("platform") not in platforms_to_filter:
            continue

        # Apply cursor filter
        if cursor_timestamp and cursor_id:
            timestamp_value = r.get("timestamp")
            if isinstance(timestamp_value, str):
                timestamp_iso = timestamp_value
            else:
                timestamp_iso = timestamp_value.isoformat()

            result_id = r.get("id", "")

            # Skip if: timestamp > cursor_timestamp OR (timestamp == cursor_timestamp AND id >= cursor_id)
            if timestamp_iso > cursor_timestamp:
                continue
            if timestamp_iso == cursor_timestamp and result_id >= cursor_id:
                continue

        filtered_results.append(r)

    # 6. Sort by timestamp DESC, id DESC
    def sort_key(item):
        timestamp_value = item.get("timestamp")
        if isinstance(timestamp_value, str):
            timestamp_iso = timestamp_value
        else:
            timestamp_iso = timestamp_value.isoformat()
        return (timestamp_iso, item.get("id", ""))

    filtered_results.sort(key=sort_key, reverse=True)

    # 7. Apply pagination (limit + 1 to check if there are more results)
    has_more = len(filtered_results) > request.limit
    page_results = filtered_results[:request.limit]

    # 8. Build response
    items = []
    for r in page_results:
        # Convert timestamp to Unix timestamp
        timestamp_value = r.get("timestamp")
        if isinstance(timestamp_value, str):
            timestamp_value = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
        unix_timestamp = int(timestamp_value.timestamp()) if timestamp_value else 0

        items.append(BrowseItem(
            id=r.get("id", ""),
            conversation_id=r.get("conversation_id", ""),
            timestamp=unix_timestamp,
            platform=r.get("platform", ""),
            title=r.get("title", ""),
            content=r.get("content", ""),
            url=r.get("url", ""),
        ))

    # 9. Build nextCursor
    next_cursor = None
    if has_more and page_results:
        last_item = page_results[-1]
        timestamp_value = last_item.get("timestamp")
        if isinstance(timestamp_value, str):
            timestamp_iso = timestamp_value
        else:
            timestamp_iso = timestamp_value.isoformat()

        cursor_data = {
            "timestamp": timestamp_iso,
            "id": last_item.get("id", "")
        }
        next_cursor = base64.b64encode(json.dumps(cursor_data).encode()).decode()

    return BrowseResponse(
        items=items,
        nextCursor=next_cursor,
        hasMore=has_more,
        total=len(filtered_results)  # Total matching results before pagination
    )
