from typing import Optional
from datetime import datetime, timezone
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from structlog import get_logger

from src.app.core.auth import ALGORITHM
from src.app.db.auth import AuthDB

# OAuth2 scheme for Swagger UI integration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

logger = get_logger()

def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Validate JWT token and return the user identity (sub).

    Checks:
    1. Token signature valid
    2. Token not expired
    3. Token issued after last password reset (iat > token_valid_after)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    db = AuthDB()
    auth_data = db.get_auth_data()

    if not auth_data:
        # System not initialized or no auth data
        logger.error("AuthDB returned no data during token validation")
        raise credentials_exception

    # auth_data is (password_hash, token_valid_after, jwt_secret)
    _, token_valid_after, jwt_secret = auth_data

    try:
        # Decode and verify signature
        payload = jwt.decode(token, jwt_secret, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        iat: int = payload.get("iat")

        if username is None:
            raise credentials_exception

        # Revocation check: Ensure token was issued after the last password reset/invalidation
        # token_valid_after is a float timestamp
        if iat is None or iat < token_valid_after:
            logger.warning("Token revoked", iat=iat, valid_after=token_valid_after)
            raise credentials_exception

        return username

    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise credentials_exception
    except jwt.PyJWTError as e:
        logger.warning("JWT validation error", error=str(e))
        raise credentials_exception
    except Exception as e:
        logger.error("Unexpected auth error", error=str(e))
        raise credentials_exception
