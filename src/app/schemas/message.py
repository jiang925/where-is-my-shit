from datetime import datetime

from lancedb.pydantic import LanceModel, Vector
from pydantic import BaseModel


class Message(LanceModel):
    """
    Core message model for LanceDB storage.
    Represents a single message or document chunk from a platform.
    """

    id: str
    conversation_id: str
    platform: str
    title: str = ""  # Default empty string if not provided
    content: str
    role: str = "user"  # user, assistant, system
    timestamp: datetime
    url: str = ""

    # Vector field for semantic search (384 dimensions for all-MiniLM-L6-v2)
    vector: Vector(384)

    # Embedding model tracking for migration
    embedding_model: str = "BAAI/bge-small-en-v1.5"


class IngestRequest(BaseModel):
    """
    Payload for incoming documents to be ingested.
    Does not include the vector as it is generated server-side.
    """

    id: str | None = None
    conversation_id: str
    platform: str
    title: str = ""
    content: str
    role: str = "user"
    timestamp: datetime
    url: str = ""


class SearchRequest(BaseModel):
    """
    Payload for search queries.
    """

    query: str
    limit: int = 50
    offset: int = 0
    # Optional filters could be added here in the future
    conversation_id: str | None = None
    platform: list[str] | str | None = None


class SearchResultMeta(BaseModel):
    """
    Metadata for a search result (nested structure for frontend compatibility).
    """

    source: str  # Maps to platform
    adapter: str  # Maps to platform (for backwards compatibility)
    created_at: int  # Unix timestamp (maps to timestamp)
    title: str = ""
    url: str = ""
    conversation_id: str = ""
    message_count: int = 0  # Total messages in this conversation
    first_user_message: str = ""  # First user message for context


class SearchResult(BaseModel):
    """
    Single result from a search query.
    Frontend-compatible structure with nested meta.
    """

    id: str
    score: float  # Raw distance/similarity score from search (backward compat)
    content: str
    meta: SearchResultMeta
    relevance_score: float = 0.0  # Unified reranker's final score
    quality_score: float = 1.0  # Content quality signal
    exact_match: bool = False  # Whether query was found as exact text match


class SearchResultGroup(BaseModel):
    """
    Results grouped by conversation.
    """

    conversation_id: str
    results: list[SearchResult]


class SearchResponse(BaseModel):
    """
    Grouped search results with two-tier structure.
    - groups: primary results (above primary threshold) - backward compatible
    - secondary_groups: results between primary and secondary thresholds
    """

    groups: list[SearchResultGroup]  # Primary results (backward compat)
    count: int  # Total primary results count
    secondary_groups: list[SearchResultGroup] = []  # Secondary results
    secondary_count: int = 0  # Total secondary results count
    total_considered: int = 0  # Total results before threshold filtering


class BrowseItem(BaseModel):
    """Single item in browse results — one per conversation."""

    id: str
    conversation_id: str
    timestamp: int  # Unix timestamp (most recent message)
    platform: str
    title: str = ""
    content: str  # Most recent message content
    url: str = ""
    role: str = "user"  # Role of the most recent message
    message_count: int = 1  # Total messages in this conversation
    first_user_message: str = ""  # First user message (shows what the conversation is about)


class BrowseRequest(BaseModel):
    """Payload for browse (chronological listing) queries."""

    cursor: str | None = None  # Base64-encoded JSON: {"timestamp": str, "id": str}
    limit: int = 20
    date_range: str | None = None  # "today", "this_week", "this_month", "all_time" or None
    platforms: list[str] | None = None  # Optional platform filter


class BrowseResponse(BaseModel):
    """Browse results with cursor-based pagination."""

    items: list[BrowseItem]
    nextCursor: str | None = None  # Base64-encoded cursor for next page
    hasMore: bool = False
    total: int = 0
