"""Conversation threading schemas."""

from datetime import datetime

from lancedb.pydantic import LanceModel
from pydantic import BaseModel


class ConversationThread(LanceModel):
    """Groups of related conversations."""

    id: str
    name: str
    description: str = ""
    created_at: datetime
    updated_at: datetime


class ThreadConversation(LanceModel):
    """Links conversations to threads with ordering."""

    id: str
    thread_id: str
    conversation_id: str
    position: int
    relationship_type: str = "continues"  # "continues" | "forks" | "related"
    linked_at: datetime
    linked_by: str = "user"  # "user" | "auto"


class ThreadCreateRequest(BaseModel):
    """Request to create a new thread."""

    name: str
    description: str = ""


class ThreadAddConversationRequest(BaseModel):
    """Request to add a conversation to a thread."""

    conversation_id: str
    relationship_type: str = "continues"
    position: int | None = None  # Auto-calculated if not provided


class ThreadConversationInfo(BaseModel):
    """Conversation info within a thread context."""

    conversation_id: str
    platform: str
    title: str
    position: int
    relationship_type: str
    message_count: int = 0
    last_activity: datetime | None = None


class ThreadResponse(BaseModel):
    """Full thread response with conversations."""

    id: str
    name: str
    description: str
    conversations: list[ThreadConversationInfo]
    created_at: datetime


class ThreadListResponse(BaseModel):
    """List of threads for a conversation."""

    threads: list["ThreadSummary"

]


class ThreadSummary(BaseModel):
    """Minimal thread info for listings."""

    id: str
    name: str
    description: str
    conversation_count: int
    updated_at: datetime


# Update forward references
ThreadListResponse.model_rebuild()
