import secrets
from typing import Annotated

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from src.app.core.config import get_settings

# Define the security scheme
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(
    api_key_header_value: Annotated[str | None, Security(api_key_header)],
) -> str:
    """
    Validate the API key from the X-API-Key header.
    """
    if not api_key_header_value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing API Key",
        )

    settings = get_settings()

    # Constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(api_key_header_value, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API Key",
        )

    return api_key_header_value
