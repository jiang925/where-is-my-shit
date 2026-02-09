import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.app.api.v1.router import api_router
from src.app.core.config import get_settings
from src.app.core.logging import setup_logging
from src.app.db.client import init_db

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    init_db()

    # Log startup info
    settings = get_settings()
    logger.info("Server started", api_key_configured=bool(settings.api_key))

    yield


settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Add CORS middleware for Chrome extension communication
origins = settings.CORS_ORIGINS
if settings.EXTENSION_ID:
    origins.append(f"chrome-extension://{settings.EXTENSION_ID}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Mount assets directory if it exists
assets_path = "src/static/assets"
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


# Serve SPA for root path
@app.get("/")
async def read_index():
    return FileResponse("src/static/index.html")
