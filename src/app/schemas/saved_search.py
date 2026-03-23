"""Saved search schemas."""

from datetime import datetime
from typing import Any

from lancedb.pydantic import LanceModel
from pydantic import BaseModel


class SavedSearch(LanceModel):
    """User-saved search queries with optional digest."""

    id: str
    name: str
    query: str
    filters: str = "{}"  # JSON string for filters
    digest_enabled: bool = False
    digest_frequency: str = "weekly"  # "daily" | "weekly"
    last_digest_at: datetime | None = None
    created_at: datetime


class SavedSearchCreateRequest(BaseModel):
    """Request to create a saved search."""

    name: str
    query: str
    filters: dict[str, Any] = {}
    digest_enabled: bool = False
    digest_frequency: str = "weekly"


class SavedSearchUpdateRequest(BaseModel):
    """Request to update a saved search."""

    name: str | None = None
    query: str | None = None
    filters: dict[str, Any] | None = None
    digest_enabled: bool | None = None
    digest_frequency: str | None = None


class SavedSearchResponse(BaseModel):
    """Response model for saved searches."""

    id: str
    name: str
    query: str
    filters: dict[str, Any]
    digest_enabled: bool
    digest_frequency: str
    last_digest_at: datetime | None = None
    created_at: datetime


class SavedSearchListResponse(BaseModel):
    """List of saved searches."""

    items: list[SavedSearchResponse]


class DigestContent(BaseModel):
    """Content of a digest for a saved search."""

    saved_search_id: str
    saved_search_name: str
    new_count: int
    preview_conversations: list["DigestPreview"

]


class DigestPreview(BaseModel):
    """Preview of a conversation in a digest."""

    conversation_id: str
    platform: str
    title: str
    preview: str
    timestamp: datetime


# Update forward references
DigestContent.model_rebuild()
