from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from src.app.core.config import get_settings
from src.app.core.logging import setup_logging

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    yield

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

@app.get("/")
async def root():
    return JSONResponse(content={"msg": "WIMS Core Engine Ready"})

@app.get("/health")
async def health():
    return JSONResponse(content={"status": "ok"})
