import secrets
from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

# Password hashing configuration
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate a hash for a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, secret_key: str, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.now(UTC)})
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def generate_strong_password(length: int = 32) -> str:
    """Generate a secure random password."""
    return secrets.token_urlsafe(length)


def generate_secret_key() -> str:
    """Generate a secure random secret key for JWT."""
    return secrets.token_hex(32)
