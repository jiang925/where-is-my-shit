"""Smart Context engine for finding related conversations.

Uses vector similarity to suggest relevant conversations based on
the current search or conversation context.
"""

from datetime import UTC, datetime
from typing import Any

import structlog

from src.app.db.client import db_client
from src.app.services.embedding import EmbeddingService

logger = structlog.get_logger()


class SmartContextEngine:
    """Finds related conversations using semantic similarity."""

    def __init__(self):
        self.embedding_service = EmbeddingService()

    async def find_related_conversations(
        self,
        conversation_id: str,
        limit: int = 3,
        exclude_same_platform: bool = False
    ) -> list[dict[str, Any]]:
        """Find conversations related to the given conversation.
        
        Args:
            conversation_id: The conversation to find related content for
            limit: Maximum number of related conversations to return
            exclude_same_platform: If True, only return from different platforms
            
        Returns:
            List of related conversation metadata with similarity scores
        """
        logger.debug(
            "smart_context.find_related",
            conversation_id=conversation_id,
            limit=limit
        )
        
        try:
            # Get the conversation's messages to build a query vector
            messages_table = db_client.get_table("messages")
            
            # Get all messages for this conversation
            conv_messages = (
                messages_table.search([0.0] * 384, query_type="vector")
                .where(f"conversation_id = '{conversation_id}'")
                .limit(1000)
                .to_list()
            )
            
            if not conv_messages:
                logger.warning(
                    "smart_context.no_messages",
                    conversation_id=conversation_id
                )
                return []
            
            # Build a composite query from conversation content
            # Use the first user message and any assistant responses
            query_parts = []
            for msg in conv_messages[:5]:  # Use first 5 messages
                content = msg.get("content", "")
                if len(content) > 50:  # Skip very short messages
                    query_parts.append(content[:500])  # First 500 chars
            
            if not query_parts:
                return []
            
            query_text = " ".join(query_parts)[:1000]  # Limit query length
            
            # Generate query vector
            query_vector = self.embedding_service.embed_text(query_text)
            
            # Get platform filter
            source_platform = conv_messages[0].get("platform", "")
            
            # Build filter
            filters = [f"conversation_id != '{conversation_id}'"]
            if exclude_same_platform and source_platform:
                filters.append(f"platform != '{source_platform}'")
            
            where_clause = " AND ".join(filters)
            
            # Search for similar messages
            similar_messages = (
                messages_table.search(query_vector, query_type="vector")
                .where(where_clause)
                .limit(limit * 5)  # Get extra for diversity
                .to_list()
            )
            
            # Group by conversation and aggregate scores
            conv_scores: dict[str, dict[str, Any]] = {}
            for msg in similar_messages:
                cid = msg.get("conversation_id", "")
                distance = msg.get("_distance", 1.0)
                similarity = 1.0 - distance
                
                if cid not in conv_scores:
                    conv_scores[cid] = {
                        "scores": [],
                        "platform": msg.get("platform", "unknown"),
                        "title": msg.get("title", "Untitled"),
                    }
                conv_scores[cid]["scores"].append(similarity)
            
            # Calculate average score for each conversation
            results = []
            for cid, data in conv_scores.items():
                avg_score = sum(data["scores"]) / len(data["scores"])
                
                # Get message count for this conversation
                msg_count = len(data["scores"])
                
                # Get last activity timestamp
                last_activity = await self._get_conversation_last_activity(cid)
                
                results.append({
                    "conversation_id": cid,
                    "platform": data["platform"],
                    "title": data["title"],
                    "similarity_score": round(avg_score, 3),
                    "message_count": msg_count,
                    "last_activity": last_activity.isoformat() if last_activity else None,
                })
            
            # Sort by similarity score and return top N
            results.sort(key=lambda x: x["similarity_score"], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(
                "smart_context.error",
                conversation_id=conversation_id,
                error=str(e)
            )
            return []

    async def find_related_for_search(
        self,
        query: str,
        current_results: list[str],
        limit: int = 3
    ) -> list[dict[str, Any]]:
        """Find conversations related to a search query.
        
        Args:
            query: The search query text
            current_results: Conversation IDs already in results (to exclude)
            limit: Maximum number of related conversations
            
        Returns:
            List of related conversation metadata
        """
        try:
            query_vector = self.embedding_service.embed_text(query)
            messages_table = db_client.get_table("messages")
            
            # Build exclusion filter
            if current_results:
                exclusion_list = "', '".join(current_results)
                where_clause = f"conversation_id NOT IN ('{exclusion_list}')"
            else:
                where_clause = None
            
            # Search
            search = messages_table.search(query_vector, query_type="vector")
            if where_clause:
                search = search.where(where_clause)
            
            similar_messages = search.limit(limit * 5).to_list()
            
            # Group by conversation
            conv_scores: dict[str, dict[str, Any]] = {}
            for msg in similar_messages:
                cid = msg.get("conversation_id", "")
                distance = msg.get("_distance", 1.0)
                similarity = 1.0 - distance
                
                if cid not in conv_scores:
                    conv_scores[cid] = {
                        "scores": [],
                        "platform": msg.get("platform", "unknown"),
                        "title": msg.get("title", "Untitled"),
                    }
                conv_scores[cid]["scores"].append(similarity)
            
            # Build results
            results = []
            for cid, data in conv_scores.items():
                avg_score = sum(data["scores"]) / len(data["scores"])
                last_activity = await self._get_conversation_last_activity(cid)
                
                results.append({
                    "conversation_id": cid,
                    "platform": data["platform"],
                    "title": data["title"],
                    "similarity_score": round(avg_score, 3),
                    "message_count": len(data["scores"]),
                    "last_activity": last_activity.isoformat() if last_activity else None,
                })
            
            results.sort(key=lambda x: x["similarity_score"], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error("smart_context.search_error", query=query, error=str(e))
            return []

    async def _get_conversation_last_activity(self, conversation_id: str) -> datetime | None:
        """Get the timestamp of the most recent message in a conversation."""
        try:
            messages_table = db_client.get_table("messages")
            
            # Get the most recent message for this conversation
            results = (
                messages_table.search([0.0] * 384, query_type="vector")
                .where(f"conversation_id = '{conversation_id}'")
                .limit(1)
                .to_list()
            )
            
            if results:
                ts = results[0].get("timestamp")
                if isinstance(ts, str):
                    from datetime import datetime as dt
                    return dt.fromisoformat(ts.replace('Z', '+00:00'))
                return ts
            return None
            
        except Exception:
            return None


# Global instance
smart_context_engine = SmartContextEngine()
