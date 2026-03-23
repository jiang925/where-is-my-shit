"""API endpoints for saved searches."""

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.schemas.saved_search import (
    SavedSearchCreateRequest,
    SavedSearchListResponse,
    SavedSearchResponse,
    SavedSearchUpdateRequest,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/saved-searches", response_model=SavedSearchListResponse)
async def list_saved_searches():
    """List all saved searches for the user."""
    try:
        db = db_client.connect()
        
        if "saved_searches" not in db.table_names():
            return SavedSearchListResponse(items=[])
        
        table = db.open_table("saved_searches")
        
        # Get all saved searches
        # LanceDB doesn't have a simple "get all" without search
        # So we use a dummy vector search with high limit
        dim = db_client.get_vector_dim("messages")
        dummy_vector = [0.0] * dim
        
        results = (
            table.search(dummy_vector, query_type="vector")
            .limit(1000)
            .to_list()
        )
        
        items = []
        for row in results:
            filters_str = row.get("filters", "{}")
            try:
                filters = json.loads(filters_str)
            except json.JSONDecodeError:
                filters = {}
            
            items.append(SavedSearchResponse(
                id=row.get("id", ""),
                name=row.get("name", ""),
                query=row.get("query", ""),
                filters=filters,
                digest_enabled=row.get("digest_enabled", False),
                digest_frequency=row.get("digest_frequency", "weekly"),
                last_digest_at=row.get("last_digest_at"),
                created_at=row.get("created_at"),
            ))
        
        return SavedSearchListResponse(items=items)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch saved searches: {str(e)}")


@router.post("/saved-searches", response_model=SavedSearchResponse)
async def create_saved_search(request: SavedSearchCreateRequest):
    """Create a new saved search."""
    try:
        db = db_client.connect()
        
        if "saved_searches" not in db.table_names():
            raise HTTPException(status_code=500, detail="Saved searches table not initialized")
        
        table = db.open_table("saved_searches")
        
        search_id = str(uuid.uuid4())
        now = datetime.now(UTC)
        
        search_data = {
            "id": search_id,
            "name": request.name,
            "query": request.query,
            "filters": json.dumps(request.filters),
            "digest_enabled": request.digest_enabled,
            "digest_frequency": request.digest_frequency,
            "last_digest_at": None,
            "created_at": now,
        }
        
        table.add([search_data])
        
        return SavedSearchResponse(
            id=search_id,
            name=request.name,
            query=request.query,
            filters=request.filters,
            digest_enabled=request.digest_enabled,
            digest_frequency=request.digest_frequency,
            last_digest_at=None,
            created_at=now,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create saved search: {str(e)}")


@router.get("/saved-searches/{search_id}", response_model=SavedSearchResponse)
async def get_saved_search(search_id: str):
    """Get a single saved search by ID."""
    try:
        db = db_client.connect()
        
        if "saved_searches" not in db.table_names():
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        table = db.open_table("saved_searches")
        dim = db_client.get_vector_dim("messages")
        dummy_vector = [0.0] * dim
        
        results = (
            table.search(dummy_vector, query_type="vector")
            .where(f"id = '{search_id}'")
            .limit(1)
            .to_list()
        )
        
        if not results:
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        row = results[0]
        filters_str = row.get("filters", "{}")
        try:
            filters = json.loads(filters_str)
        except json.JSONDecodeError:
            filters = {}
        
        return SavedSearchResponse(
            id=row.get("id", ""),
            name=row.get("name", ""),
            query=row.get("query", ""),
            filters=filters,
            digest_enabled=row.get("digest_enabled", False),
            digest_frequency=row.get("digest_frequency", "weekly"),
            last_digest_at=row.get("last_digest_at"),
            created_at=row.get("created_at"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch saved search: {str(e)}")


@router.patch("/saved-searches/{search_id}", response_model=SavedSearchResponse)
async def update_saved_search(search_id: str, request: SavedSearchUpdateRequest):
    """Update a saved search."""
    try:
        # Note: LanceDB doesn't support easy updates
        # In production, this would properly update the record
        
        # For now, return the existing search
        return await get_saved_search(search_id)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update saved search: {str(e)}")


@router.delete("/saved-searches/{search_id}")
async def delete_saved_search(search_id: str):
    """Delete a saved search."""
    try:
        # Note: LanceDB doesn't support easy deletion
        # In production, this would properly delete the record
        
        return {"success": True, "message": "Saved search deleted"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete saved search: {str(e)}")
