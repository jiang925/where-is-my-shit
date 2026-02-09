from datetime import datetime
from typing import List, Optional

from lancedb.pydantic import LanceModel, Vector
from pydantic import BaseModel, Field


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
    id: str
    conversation_id: str
    platform: str
    title: str = ""
    content: str
    role: str = "user"
    timestamp: datetime
    url: str = ""


class SearchResult(BaseModel):
    """
    Single result from a search query.
    """
    id: str
    conversation_id: str
    platform: str
    title: str
    content: str
    role: str
    timestamp: datetime
    url: str
    score: float


class SearchResponse(BaseModel):
    """
    Grouped search results.
    """
    results: List[SearchResult]
    count: int
