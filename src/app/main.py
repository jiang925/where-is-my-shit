import asyncio
import os
import threading
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.app.api.v1.router import api_router
from src.app.core.config import config_manager, get_settings
from src.app.core.logging import setup_logging
from src.app.db.client import db_client, init_db
from src.app.db.compaction import compaction_manager
from src.app.db.migration import auto_resume_migration

logger = structlog.get_logger()


def _check_embedding_dimension_compat(table) -> None:
    """
    Check if the configured embedding model dimensions match existing data.

    If the existing DB has vectors with different dimensions than the configured
    provider, fall back to fastembed/bge-small-en-v1.5 to avoid search errors.
    """
    from src.app.services.embedding import EmbeddingService

    try:
        row_count = table.count_rows()
        if row_count == 0:
            return  # Empty table, no compatibility concern

        # Get vector dimensions from table schema
        schema = table.schema
        db_dims = None
        for field in schema:
            if field.name == "vector" and hasattr(field.type, "list_size"):
                db_dims = field.type.list_size
                break

        if db_dims is None:
            return  # No vector column found

        # Initialize the embedding service (creates the provider)
        service = EmbeddingService()
        provider_dims = service.get_dimensions()

        if db_dims != provider_dims:
            logger.warning(
                "embedding_dimension_mismatch",
                db_dimensions=db_dims,
                provider_dimensions=provider_dims,
                provider_model=service.get_model_name(),
                action="falling_back_to_fastembed_bge_small",
            )
            print(
                f"\n⚠️  Dimension mismatch: DB has {db_dims}-dim vectors, "
                f"but configured model produces {provider_dims}-dim vectors."
            )
            print(f"   Falling back to fastembed/BAAI/bge-small-en-v1.5 ({db_dims}d) for compatibility.")
            print("   Run 'uv run python -m src.cli reembed' to upgrade existing vectors.\n")

            # Reset and reinitialize with fastembed
            EmbeddingService.reset()
            from src.app.services.embedding_provider import create_embedding_provider

            EmbeddingService._instance = EmbeddingService.__new__(EmbeddingService)
            EmbeddingService._provider = create_embedding_provider(
                {
                    "provider": "fastembed",
                    "model": "BAAI/bge-small-en-v1.5",
                }
            )
        else:
            logger.info(
                "embedding_dimensions_ok",
                dimensions=db_dims,
                model=service.get_model_name(),
            )
    except Exception as e:
        logger.warning("embedding_compat_check_failed", error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    init_db()

    # Get messages table for compaction and migration
    table = db_client.get_table("messages")

    # Check embedding dimension compatibility before any requests
    _check_embedding_dimension_compat(table)

    # Set up and start compaction manager
    compaction_manager.set_table(table)
    compaction_manager.start()

    # Check for incomplete migration and auto-resume in background thread
    migration_thread = threading.Thread(
        target=auto_resume_migration, args=(table,), daemon=True, name="MigrationResumeThread"
    )
    migration_thread.start()

    # Start config watcher
    config_task = asyncio.create_task(config_manager.watch_loop())

    settings = get_settings()

    # Print startup banner with credentials
    print("\n" + "=" * 60)
    print("🚀 WIMS Server Running")
    print(f"🔑 API Key: {settings.api_key}")
    print(f"📄 Config:  {config_manager.path}")
    print(f"📚 Docs:    http://{settings.host}:{settings.port}/docs")
    print("=" * 60 + "\n")

    logger.info("Server started", api_key_configured=bool(settings.api_key))

    yield

    # Shutdown
    compaction_manager.stop()
    config_task.cancel()
    try:
        await config_task
    except asyncio.CancelledError:
        pass
    db_client.close()


settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Add CORS middleware
# We use allow_origins=["*"] with allow_credentials=False because we are using
# stateless API Key auth (X-API-Key) and this is a local tool that needs to be
# accessible from any device on the local network (laptops, phones, etc).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Mount assets directory if it exists
assets_path = "src/static/assets"
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


# Serve SPA for root path and any other path (client-side routing)
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Allow API 404s to pass through as JSON
    if full_path.startswith("api/"):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Not Found")

    # Check if it's a static file request that wasn't caught by mounted assets
    # (e.g., vite.svg, robots.txt)
    static_file_path = os.path.join("src/static", full_path)
    if os.path.exists(static_file_path) and os.path.isfile(static_file_path):
        return FileResponse(static_file_path)

    # Otherwise serve index.html for SPA routing
    return FileResponse("src/static/index.html")
