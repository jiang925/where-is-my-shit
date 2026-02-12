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
    platform: str | None = None


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


class SearchResult(BaseModel):
    """
    Single result from a search query.
    Frontend-compatible structure with nested meta.
    """

    id: str
    score: float
    content: str
    meta: SearchResultMeta


class SearchResultGroup(BaseModel):
    """
    Results grouped by conversation.
    """

    conversation_id: str
    results: list[SearchResult]


class SearchResponse(BaseModel):
    """
    Grouped search results.
    """

    groups: list[SearchResultGroup]
    count: int
