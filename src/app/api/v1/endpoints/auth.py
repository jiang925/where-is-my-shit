import time
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from src.app.core.auth import create_access_token, generate_secret_key, verify_password
from src.app.db.auth import AuthDB

logger = structlog.get_logger()
router = APIRouter()

# Simple in-memory storage for failed attempts: {ip: (count, last_attempt_time)}
# In a production environment with multiple workers, this should be in Redis/Memcached
failed_attempts: dict[str, tuple[int, float]] = {}

class LoginRequest(BaseModel):
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

def get_auth_db():
    return AuthDB()

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    login_data: LoginRequest,
    auth_db: Annotated[AuthDB, Depends(get_auth_db)]
):
    """
    Authenticate user and return JWT token.
    Implements progressive delay on failure (1s/2s/4s) to slow down brute force attacks.
    """
    client_ip = request.client.host if request.client else "unknown"

    # Check if we need to clean up old entries for this IP (reset after 15 mins)
    if client_ip in failed_attempts:
        count, last_time = failed_attempts[client_ip]
        if time.time() - last_time > 900:  # 15 minutes reset
            del failed_attempts[client_ip]

    auth_data = auth_db.get_auth_data()

    if not auth_data:
        logger.error("Auth system not initialized")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System not initialized"
        )

    password_hash, _, jwt_secret = auth_data

    # Verify password
    if not verify_password(login_data.password, password_hash):
        # Handle failure and progressive delay
        current_count = 0
        if client_ip in failed_attempts:
            current_count, _ = failed_attempts[client_ip]

        new_count = current_count + 1
        failed_attempts[client_ip] = (new_count, time.time())

        # Calculate delay: 1s, 2s, 4s... capped at 4s for this plan or higher
        # Plan says "1s/2s/4s"
        delay = min(4, 2 ** (new_count - 1))
        if delay < 1:
            delay = 1

        logger.warning(f"Login failed for IP {client_ip}. Attempt {new_count}. Delaying {delay}s")
        time.sleep(delay)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Success - clear failed attempts for this IP
    if client_ip in failed_attempts:
        del failed_attempts[client_ip]

    # Ensure we have a JWT secret (should be in DB, but just in case)
    if not jwt_secret:
        # Fallback/Recovery (should not happen if initialized properly)
        jwt_secret = generate_secret_key()
        auth_db.set_secret(jwt_secret)

    access_token = create_access_token(
        data={"sub": "admin"},
        secret_key=jwt_secret
    )

    return Token(access_token=access_token, token_type="bearer")
