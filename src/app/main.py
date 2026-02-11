import asyncio
import os
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
from src.app.db.client import init_db

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    init_db()

    # Start config watcher
    config_task = asyncio.create_task(config_manager.watch_loop())

    settings = get_settings()

    # Print startup banner with credentials
    print("\n" + "=" * 60)
    print(f"🚀 WIMS Server Running")
    print(f"🔑 API Key: {settings.api_key}")
    print(f"📄 Config:  {config_manager.path}")
    print(f"📚 Docs:    http://{settings.host}:{settings.port}/docs")
    print("=" * 60 + "\n")

    logger.info("Server started", api_key_configured=bool(settings.api_key))

    yield

    # Shutdown
    config_task.cancel()
    try:
        await config_task
    except asyncio.CancelledError:
        pass


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
