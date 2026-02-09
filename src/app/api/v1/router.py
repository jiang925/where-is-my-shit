from fastapi import APIRouter

from src.app.api.v1.endpoints import ingest, search, health

api_router = APIRouter()

api_router.include_router(ingest.router, tags=["ingest"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(health.router, tags=["health"])
