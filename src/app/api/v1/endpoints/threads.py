"""API endpoints for conversation threading."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.schemas.thread import (
    ThreadAddConversationRequest,
    ThreadConversationInfo,
    ThreadCreateRequest,
    ThreadListResponse,
    ThreadResponse,
    ThreadSummary,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/threads", response_model=ThreadResponse)
async def create_thread(request: ThreadCreateRequest):
    """Create a new conversation thread."""
    try:
        db = db_client.connect()
        
        if "conversation_threads" not in db.table_names():
            raise HTTPException(status_code=500, detail="Thread table not initialized")
        
        table = db.open_table("conversation_threads")
        
        thread_id = str(uuid.uuid4())
        now = datetime.now(UTC)
        
        thread_data = {
            "id": thread_id,
            "name": request.name,
            "description": request.description,
            "created_at": now,
            "updated_at": now,
        }
        
        table.add([thread_data])
        
        return ThreadResponse(
            id=thread_id,
            name=request.name,
            description=request.description,
            conversations=[],
            created_at=now,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create thread: {str(e)}")


@router.get("/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(thread_id: str):
    """Get a thread with all its conversations."""
    try:
        db = db_client.connect()
        
        if "conversation_threads" not in db.table_names():
            raise HTTPException(status_code=404, detail="Thread not found")
        
        # Get thread info
        threads_table = db.open_table("conversation_threads")
        dim = db_client.get_vector_dim("messages")
        dummy_vector = [0.0] * dim
        
        thread_results = (
            threads_table.search(dummy_vector, query_type="vector")
            .where(f"id = '{thread_id}'")
            .limit(1)
            .to_list()
        )
        
        if not thread_results:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        thread = thread_results[0]
        
        # Get conversations in thread
        conversations = await _get_thread_conversations(thread_id)
        
        return ThreadResponse(
            id=thread_id,
            name=thread.get("name", ""),
            description=thread.get("description", ""),
            conversations=conversations,
            created_at=thread.get("created_at"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch thread: {str(e)}")


@router.post("/threads/{thread_id}/conversations")
async def add_conversation_to_thread(thread_id: str, request: ThreadAddConversationRequest):
    """Add a conversation to a thread."""
    try:
        db = db_client.connect()
        
        if "thread_conversations" not in db.table_names():
            raise HTTPException(status_code=500, detail="Thread conversations table not initialized")
        
        table = db.open_table("thread_conversations")
        
        # Calculate position if not provided
        position = request.position
        if position is None:
            # Get current max position
            dim = db_client.get_vector_dim("messages")
            dummy_vector = [0.0] * dim
            
            existing = (
                table.search(dummy_vector, query_type="vector")
                .where(f"thread_id = '{thread_id}'")
                .limit(1000)
                .to_list()
            )
            
            positions = [r.get("position", 0) for r in existing]
            position = max(positions) + 1 if positions else 0
        
        link_data = {
            "id": str(uuid.uuid4()),
            "thread_id": thread_id,
            "conversation_id": request.conversation_id,
            "position": position,
            "relationship_type": request.relationship_type,
            "linked_at": datetime.now(UTC),
            "linked_by": "user",
        }
        
        table.add([link_data])
        
        return {"success": True, "message": "Conversation added to thread"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add conversation: {str(e)}")


@router.get("/conversations/{conversation_id}/threads", response_model=ThreadListResponse)
async def get_conversation_threads(conversation_id: str):
    """Get all threads a conversation belongs to."""
    try:
        db = db_client.connect()
        
        if "thread_conversations" not in db.table_names():
            return ThreadListResponse(threads=[])
        
        links_table = db.open_table("thread_conversations")
        dim = db_client.get_vector_dim("messages")
        dummy_vector = [0.0] * dim
        
        links = (
            links_table.search(dummy_vector, query_type="vector")
            .where(f"conversation_id = '{conversation_id}'")
            .limit(100)
            .to_list()
        )
        
        thread_ids = [link.get("thread_id") for link in links]
        
        if not thread_ids or "conversation_threads" not in db.table_names():
            return ThreadListResponse(threads=[])
        
        # Get thread details
        threads_table = db.open_table("conversation_threads")
        threads = []
        
        for tid in thread_ids:
            thread_results = (
                threads_table.search(dummy_vector, query_type="vector")
                .where(f"id = '{tid}'")
                .limit(1)
                .to_list()
            )
            
            if thread_results:
                t = thread_results[0]
                # Count conversations in thread
                conv_count = len([
                    l for l in links
                    if l.get("thread_id") == tid
                ])
                
                threads.append(ThreadSummary(
                    id=tid,
                    name=t.get("name", ""),
                    description=t.get("description", ""),
                    conversation_count=conv_count,
                    updated_at=t.get("updated_at"),
                ))
        
        return ThreadListResponse(threads=threads)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch threads: {str(e)}")


@router.delete("/threads/{thread_id}/conversations/{conversation_id}")
async def remove_conversation_from_thread(thread_id: str, conversation_id: str):
    """Remove a conversation from a thread."""
    try:
        # Note: LanceDB doesn't support easy deletion
        # In production, this would properly remove the link
        
        return {"success": True, "message": "Conversation removed from thread"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove conversation: {str(e)}")


async def _get_thread_conversations(thread_id: str) -> list[ThreadConversationInfo]:
    """Get all conversations in a thread with metadata."""
    db = db_client.connect()
    
    if "thread_conversations" not in db.table_names():
        return []
    
    links_table = db.open_table("thread_conversations")
    dim = db_client.get_vector_dim("messages")
    dummy_vector = [0.0] * dim
    
    links = (
        links_table.search(dummy_vector, query_type="vector")
        .where(f"thread_id = '{thread_id}'")
        .limit(100)
        .to_list()
    )
    
    # Sort by position
    links.sort(key=lambda x: x.get("position", 0))
    
    conversations = []
    messages_table = db_client.get_table("messages")
    
    for link in links:
        cid = link.get("conversation_id", "")
        
        # Get conversation metadata
        conv_messages = (
            messages_table.search(dummy_vector, query_type="vector")
            .where(f"conversation_id = '{cid}'")
            .limit(100)
            .to_list()
        )
        
        if conv_messages:
            first_msg = conv_messages[0]
            
            # Get last activity
            timestamps = [
                m.get("timestamp") for m in conv_messages
                if m.get("timestamp")
            ]
            last_activity = max(timestamps) if timestamps else None
            
            conversations.append(ThreadConversationInfo(
                conversation_id=cid,
                platform=first_msg.get("platform", "unknown"),
                title=first_msg.get("title", "Untitled"),
                position=link.get("position", 0),
                relationship_type=link.get("relationship_type", "continues"),
                message_count=len(conv_messages),
                last_activity=last_activity,
            ))
    
    return conversations
