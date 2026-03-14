from fastapi import APIRouter

from src.app.api.v1.endpoints import (
    browse,
    digest,
    export,
    health,
    import_data,
    ingest,
    search,
    stats,
    terminal,
    thread,
)

api_router = APIRouter()

api_router.include_router(ingest.router, tags=["ingest"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(browse.router, tags=["browse"])
api_router.include_router(stats.router, tags=["stats"])
api_router.include_router(thread.router, tags=["thread"])
api_router.include_router(export.router, tags=["export"])
api_router.include_router(import_data.router, tags=["import"])
api_router.include_router(terminal.router, tags=["terminal"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(digest.router, tags=["digest"])
