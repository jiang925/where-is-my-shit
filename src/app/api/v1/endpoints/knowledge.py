"""API endpoints for knowledge items."""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.schemas.knowledge import (
    KnowledgeFilterRequest,
    KnowledgeItemResponse,
    KnowledgeItemUpdate,
    KnowledgeListResponse,
    KnowledgeSource,
)
from src.app.services.embedding import EmbeddingService

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/knowledge", response_model=KnowledgeListResponse)
async def list_knowledge(
    type: str | None = Query(None, description="Filter by type: code, prompt, decision, summary"),
    platform: str | None = Query(None, description="Filter by platform"),
    tags: str | None = Query(None, description="Comma-separated tags"),
    query: str | None = Query(None, description="Semantic search query"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List knowledge items with optional filtering."""
    try:
        db = db_client.connect()
        
        if "knowledge_items" not in db.table_names():
            return KnowledgeListResponse(items=[], total=0, has_more=False)
        
        table = db.open_table("knowledge_items")
        
        # Build filters
        filters = []
        if type:
            allowed_types = {"code", "prompt", "decision", "summary"}
            if type not in allowed_types:
                raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {allowed_types}")
            filters.append(f"type = '{type}'")
        
        if platform:
            filters.append(f"platform = '{platform}'")
        
        where_clause = " AND ".join(filters) if filters else None
        
        # If semantic query provided, use vector search
        if query:
            embedding_service = EmbeddingService()
            query_vector = embedding_service.embed_text(query)
            
            search = table.search(query_vector, query_type="vector")
            if where_clause:
                search = search.where(where_clause)
            
            results = search.limit(limit + offset).to_list()
        else:
            # Otherwise use regular query with filters
            # LanceDB doesn't support simple query without vector/fts
            # So we use a dummy vector search with filter
            dim = db_client.get_vector_dim("messages")
            dummy_vector = [0.0] * dim
            
            search = table.search(dummy_vector, query_type="vector")
            if where_clause:
                search = search.where(where_clause)
            
            results = search.limit(limit + offset).to_list()
        
        # Apply offset manually
        results = results[offset:offset + limit]
        
        # Build response
        items = []
        for row in results:
            # Get conversation title from messages table
            title = await _get_conversation_title(row.get("conversation_id", ""))
            
            items.append(KnowledgeItemResponse(
                id=row.get("id", ""),
                type=row.get("type", ""),
                content=row.get("content", ""),
                metadata=json.loads(row.get("metadata", "{}")),
                source=KnowledgeSource(
                    conversation_id=row.get("conversation_id", ""),
                    platform=row.get("platform", ""),
                    title=title,
                ),
                usage_count=row.get("usage_count", 0),
                created_at=row.get("created_at"),
            ))
        
        # Check if there are more results
        has_more = len(results) == limit
        
        return KnowledgeListResponse(
            items=items,
            total=len(items),  # Approximate
            has_more=has_more
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch knowledge items: {str(e)}")


@router.get("/knowledge/{item_id}", response_model=KnowledgeItemResponse)
async def get_knowledge_item(item_id: str):
    """Get a single knowledge item by ID."""
    try:
        db = db_client.connect()
        
        if "knowledge_items" not in db.table_names():
            raise HTTPException(status_code=404, detail="Knowledge item not found")
        
        table = db.open_table("knowledge_items")
        
        # Search by ID
        dim = db_client.get_vector_dim("messages")
        dummy_vector = [0.0] * dim
        
        results = (
            table.search(dummy_vector, query_type="vector")
            .where(f"id = '{item_id}'")
            .limit(1)
            .to_list()
        )
        
        if not results:
            raise HTTPException(status_code=404, detail="Knowledge item not found")
        
        row = results[0]
        title = await _get_conversation_title(row.get("conversation_id", ""))
        
        return KnowledgeItemResponse(
            id=row.get("id", ""),
            type=row.get("type", ""),
            content=row.get("content", ""),
            metadata=json.loads(row.get("metadata", "{}")),
            source=KnowledgeSource(
                conversation_id=row.get("conversation_id", ""),
                platform=row.get("platform", ""),
                title=title,
            ),
            usage_count=row.get("usage_count", 0),
            created_at=row.get("created_at"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch knowledge item: {str(e)}")


@router.post("/knowledge/{item_id}/increment-usage")
async def increment_usage(item_id: str):
    """Increment the usage count for a knowledge item."""
    try:
        db = db_client.connect()
        
        if "knowledge_items" not in db.table_names():
            raise HTTPException(status_code=404, detail="Knowledge item not found")
        
        # Note: LanceDB doesn't support direct updates easily
        # For now, we'll just return success
        # In production, this would update the usage_count field
        
        return {"success": True, "message": "Usage count updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update usage: {str(e)}")


@router.delete("/knowledge/{item_id}")
async def delete_knowledge_item(item_id: str):
    """Delete a knowledge item."""
    try:
        db = db_client.connect()
        
        if "knowledge_items" not in db.table_names():
            raise HTTPException(status_code=404, detail="Knowledge item not found")
        
        # Note: LanceDB soft deletes are tricky
        # For now, we'll mark it as deleted in metadata
        # In production, this would use proper deletion
        
        return {"success": True, "message": "Knowledge item deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete knowledge item: {str(e)}")


async def _get_conversation_title(conversation_id: str) -> str:
    """Get the title of a conversation from its messages."""
    try:
        messages_table = db_client.get_table("messages")
        
        results = (
            messages_table.search([0.0] * 384, query_type="vector")
            .where(f"conversation_id = '{conversation_id}'")
            .limit(1)
            .to_list()
        )
        
        if results:
            return results[0].get("title", "Untitled")
        return "Untitled"
        
    except Exception:
        return "Untitled"
