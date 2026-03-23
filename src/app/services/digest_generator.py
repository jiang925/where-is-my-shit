"""Digest generation for saved searches.

Generates periodic digests of new conversations matching saved searches.
"""

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from src.app.db.client import db_client

logger = structlog.get_logger()


async def generate_digests() -> dict[str, Any]:
    """Generate digests for all saved searches with digests enabled.
    
    Returns:
        Dict with summary of generated digests
    """
    logger.info("digest_generation.start")
    
    try:
        # Get all saved searches with digests enabled
        db = db_client.connect()
        
        if "saved_searches" not in db.table_names():
            logger.info("digest_generation.no_saved_searches_table")
            return {"generated": 0, "searches_checked": 0}
        
        table = db.open_table("saved_searches")
        
        # Get all saved searches
        all_searches = table.to_pandas().to_dict('records')
        
        enabled_searches = [
            s for s in all_searches
            if s.get("digest_enabled", False)
        ]
        
        generated = 0
        
        for search in enabled_searches:
            try:
                # Check if it's time for a digest
                last_digest = search.get("last_digest_at")
                frequency = search.get("digest_frequency", "weekly")
                
                if last_digest:
                    last_dt = datetime.fromisoformat(last_digest.replace('Z', '+00:00'))
                    if frequency == "daily":
                        next_digest = last_dt + timedelta(days=1)
                    else:  # weekly
                        next_digest = last_dt + timedelta(weeks=1)
                    
                    if datetime.now(UTC) < next_digest:
                        continue  # Not time yet
                
                # Generate digest for this search
                digest = await generate_single_digest(search)
                
                if digest["new_count"] > 0:
                    # TODO: Send digest via notification/email
                    logger.info(
                        "digest_generated",
                        search_id=search.get("id"),
                        search_name=search.get("name"),
                        new_count=digest["new_count"]
                    )
                    generated += 1
                
                # Update last_digest_at
                # TODO: Update in database
                
            except Exception as e:
                logger.error(
                    "digest_generation.search_error",
                    search_id=search.get("id"),
                    error=str(e)
                )
        
        logger.info(
            "digest_generation.complete",
            searches_checked=len(enabled_searches),
            digests_generated=generated
        )
        
        return {
            "generated": generated,
            "searches_checked": len(enabled_searches)
        }
        
    except Exception as e:
        logger.error("digest_generation.error", error=str(e))
        return {"error": str(e)}


async def generate_single_digest(saved_search: dict[str, Any]) -> dict[str, Any]:
    """Generate a digest for a single saved search.
    
    Returns:
        Dict with new_count and preview_conversations
    """
    from src.app.api.v1.endpoints.search import ALLOWED_PLATFORMS
    
    query = saved_search.get("query", "")
    filters_str = saved_search.get("filters", "{}")
    last_digest = saved_search.get("last_digest_at")
    
    try:
        filters = json.loads(filters_str) if filters_str else {}
    except json.JSONDecodeError:
        filters = {}
    
    # Build date filter (only show conversations since last digest)
    date_filter = None
    if last_digest:
        last_dt = datetime.fromisoformat(last_digest.replace('Z', '+00:00'))
        date_filter = f"timestamp >= timestamp '{last_dt.isoformat()}'"
    
    # Search for new conversations
    messages_table = db_client.get_table("messages")
    
    # Simple text search for now
    # TODO: Use vector search if query is semantic
    search_results = (
        messages_table.search(query, query_type="fts")
        .limit(100)
        .to_list()
    )
    
    # Apply date filter manually if needed
    if date_filter:
        # TODO: Apply date filter properly
        pass
    
    # Group by conversation and get newest
    conversations: dict[str, dict[str, Any]] = {}
    for msg in search_results:
        cid = msg.get("conversation_id", "")
        if cid not in conversations:
            conversations[cid] = {
                "conversation_id": cid,
                "platform": msg.get("platform", "unknown"),
                "title": msg.get("title", "Untitled"),
                "preview": msg.get("content", "")[:200],
                "timestamp": msg.get("timestamp"),
            }
    
    return {
        "saved_search_id": saved_search.get("id"),
        "saved_search_name": saved_search.get("name"),
        "new_count": len(conversations),
        "preview_conversations": list(conversations.values())[:3]
    }
