from pydantic import BaseModel


class ActivityEntry(BaseModel):
    date: str  # YYYY-MM-DD
    count: int


class StatsResponse(BaseModel):
    total_messages: int
    total_conversations: int
    by_platform: dict[str, int]  # platform -> message count
    conversations_by_platform: dict[str, int]  # platform -> conversation count
    activity: list[ActivityEntry]
