import pytest
from fastapi import HTTPException
from src.app.core.auth import verify_api_key
from src.app.core.config import ServerConfig

@pytest.mark.asyncio
async def test_verify_api_key_success(monkeypatch):
    # Mock settings
    monkeypatch.setattr("src.app.core.auth.get_settings", lambda: ServerConfig(api_key="valid-key"))

    result = await verify_api_key("valid-key")
    assert result == "valid-key"

@pytest.mark.asyncio
async def test_verify_api_key_missing():
    with pytest.raises(HTTPException) as exc:
        await verify_api_key(None)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Missing API Key"

@pytest.mark.asyncio
async def test_verify_api_key_invalid(monkeypatch):
    monkeypatch.setattr("src.app.core.auth.get_settings", lambda: ServerConfig(api_key="valid-key"))

    with pytest.raises(HTTPException) as exc:
        await verify_api_key("invalid-key")
    assert exc.value.status_code == 403
    assert exc.value.detail == "Invalid API Key"
