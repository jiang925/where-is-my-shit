import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.app.api.v1.endpoints import auth as auth_endpoint
from src.app.api.v1.router import api_router
from src.app.core.auth import (
    generate_secret_key,
    generate_strong_password,
    get_password_hash,
)
from src.app.core.config import get_settings
from src.app.core.logging import setup_logging
from src.app.db.auth import AuthDB
from src.app.db.client import init_db

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    init_db()

    # Initialize Auth System
    auth_db = AuthDB()
    auth_db.initialize()

    # Check if we need to setup initial credentials
    auth_data = auth_db.get_auth_data()
    if not auth_data:
        # First run setup
        initial_password = generate_strong_password()
        hashed_pw = get_password_hash(initial_password)
        jwt_secret = generate_secret_key()

        auth_db.update_password(hashed_pw)
        auth_db.set_secret(jwt_secret)

        # PRINT TO STDOUT as requested
        print("\n" + "=" * 60)
        print(f"INITIAL ADMIN PASSWORD: {initial_password}")
        print("=" * 60 + "\n")
        logger.info("Generated initial admin password")

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
app.include_router(auth_endpoint.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])

# Mount assets directory if it exists
assets_path = "src/static/assets"
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


# Serve SPA for root path
@app.get("/")
async def read_index():
    return FileResponse("src/static/index.html")


# Catch-all for SPA routing (optional, but good for react router later)
# For now, just ensuring root works is enough per plan.
