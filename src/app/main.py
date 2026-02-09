from contextlib import asynccontextmanager
from typing import AsyncGenerator
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from src.app.core.config import get_settings
from src.app.core.logging import setup_logging
from src.app.db.client import init_db
from src.app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    init_db()
    yield

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Add CORS middleware for Chrome extension communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Extension origins are chrome-extension://... which vary per install
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Mount assets directory if it exists
assets_path = "src/static/assets"
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

# Serve SPA for root path
@app.get("/")
async def read_index():
    return FileResponse('src/static/index.html')

# Catch-all for SPA routing (optional, but good for react router later)
# For now, just ensuring root works is enough per plan.
