"""Knowledge item schemas for extracted content."""

from datetime import datetime
from typing import Any

from lancedb.pydantic import LanceModel, Vector
from pydantic import BaseModel, field_validator


class KnowledgeItem(LanceModel):
    """Extracted knowledge from conversations.
    
    Stores code snippets, prompts, decisions, and summaries extracted
    from conversation messages for reuse and discovery.
    """

    id: str
    type: str  # "code" | "prompt" | "decision" | "summary"
    content: str

    # Source tracking
    conversation_id: str
    message_id: str
    platform: str

    # Metadata stored as JSON string for LanceDB compatibility
    metadata: str = "{}"

    # Vector for semantic search (384 dimensions for all-MiniLM-L6-v2)
    vector: Vector(384)

    # Usage tracking
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime


class KnowledgeItemCreate(BaseModel):
    """Payload for creating a knowledge item."""

    type: str
    content: str
    conversation_id: str
    message_id: str
    platform: str
    metadata: dict[str, Any] = {}

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"code", "prompt", "decision", "summary"}
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v


class KnowledgeItemUpdate(BaseModel):
    """Payload for updating a knowledge item."""

    content: str | None = None
    metadata: dict[str, Any] | None = None
    usage_count: int | None = None


class KnowledgeItemResponse(BaseModel):
    """Response model for knowledge items."""

    id: str
    type: str
    content: str
    metadata: dict[str, Any]
    source: "KnowledgeSource"
    usage_count: int
    created_at: datetime


class KnowledgeSource(BaseModel):
    """Source conversation information."""

    conversation_id: str
    platform: str
    title: str


class KnowledgeListResponse(BaseModel):
    """Paginated list of knowledge items."""

    items: list[KnowledgeItemResponse]
    total: int
    has_more: bool


class KnowledgeFilterRequest(BaseModel):
    """Filter parameters for knowledge queries."""

    type: str | None = None
    platform: str | None = None
    tags: list[str] | None = None
    query: str | None = None  # Semantic search query
    limit: int = 50
    offset: int = 0


# Update forward references
KnowledgeItemResponse.model_rebuild()
