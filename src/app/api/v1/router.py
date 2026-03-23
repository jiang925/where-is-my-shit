from fastapi import APIRouter

from src.app.api.v1.endpoints import (
    browse,
    digest,
    export,
    health,
    import_data,
    ingest,
    knowledge,
    saved_searches,
    search,
    stats,
    sync,
    terminal,
    thread,
    threads,
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
api_router.include_router(sync.router, tags=["sync"])

# New Intelligence Layer endpoints
api_router.include_router(knowledge.router, prefix="/v1", tags=["knowledge"])
api_router.include_router(threads.router, prefix="/v1", tags=["threads"])
api_router.include_router(saved_searches.router, prefix="/v1", tags=["saved-searches"])
