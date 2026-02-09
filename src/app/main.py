from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import JSONResponse

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

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return JSONResponse(content={"msg": "WIMS Core Engine Ready"})
