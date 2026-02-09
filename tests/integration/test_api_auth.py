import sys
import pytest
import requests
from pathlib import Path
from datetime import datetime

# Add wims-watcher src to path to import client
# (This is also done in conftest.py but good to be explicit if run standalone)
PROJECT_ROOT = Path(__file__).parent.parent.parent
WATCHER_SRC = PROJECT_ROOT / "wims-watcher" / "src"
if str(WATCHER_SRC) not in sys.path:
    sys.path.append(str(WATCHER_SRC))

from client import WimsClient, AuthError

# Temporary directory for token storage
@pytest.fixture
def temp_token_file(tmp_path):
    token_file = tmp_path / "token"
    return token_file

@pytest.fixture
def client(live_server, temp_token_file):
    """
    Creates a WimsClient instance pointing to the live server.
    Redirects token storage to a temp file.
    """
    # Initialize with correct password from conftest.py
    c = WimsClient(base_url=live_server, password="test-password")
    # Override token file to avoid writing to ~/.wims/token
    c.token_file = temp_token_file
    return c

def test_scenario_a_happy_path(client):
    """
    Scenario A: Happy Path
    - Login with correct password
    - Verify token is set
    - Perform ingestion
    """
    # 1. Login
    assert client.login() is True
    assert client.token is not None
    assert len(client.token) > 0

    # 2. Ingest
    payload = {
        "conversation_id": "test-conv-1",
        "platform": "test-platform",
        "content": "This is a test message",
        "role": "user",
        "timestamp": datetime.now().isoformat()
    }

    # ingest returns True on success
    assert client.ingest(payload) is True

def test_scenario_b_bad_password(live_server, temp_token_file):
    """
    Scenario B: Bad Password
    - Login with wrong password
    - Verify failure
    """
    c = WimsClient(base_url=live_server, password="wrong-password")
    c.token_file = temp_token_file

    # login() returns False on failure (it catches exceptions internally in the client code provided)
    # The Plan says "Verify it raises AuthError", let's check client.py again.
    # client.py: login() returns False on error, catches Exception.
    # But let's check if it raises AuthError anywhere.
    # It raises AuthError in _attempt_ingest, but login() returns boolean.
    # So we verify it returns False.

    assert c.login() is False
    assert c.token is None

def test_scenario_c_no_auth(live_server):
    """
    Scenario C: No Auth
    - Raw HTTP request without header
    - Verify 401
    """
    ingest_url = f"{live_server}/api/v1/ingest"
    payload = {
        "conversation_id": "test-conv-2",
        "platform": "test-platform",
        "content": "This should fail",
        "role": "user",
        "timestamp": datetime.now().isoformat()
    }

    # Request without Authorization header
    response = requests.post(ingest_url, json=payload)
    assert response.status_code == 401

def test_scenario_d_token_refresh(client):
    """
    Scenario D: Token Refresh
    - Authenticate successfully
    - Manually break token
    - Ingest -> should fail 401, refresh, and succeed
    """
    # 1. Login first to get a valid token
    assert client.login() is True
    original_token = client.token

    # 2. Sabotage the token
    client.token = "invalid.token.string"
    # Also update the file so it doesn't reload the good one immediately if it checks file
    if client.token_file.exists():
        client.token_file.write_text("invalid.token.string")

    # 3. Call ingest
    payload = {
        "conversation_id": "test-conv-3",
        "platform": "test-platform",
        "content": "This should trigger refresh",
        "role": "user",
        "timestamp": datetime.now().isoformat()
    }

    # This should internally:
    # 1. Post -> 401
    # 2. Catch 401
    # 3. Call login() -> Success (uses stored password)
    # 4. Retry Post -> 200
    # 5. Return True
    assert client.ingest(payload) is True

    # Verify token was updated
    assert client.token != "invalid.token.string"
    # It might be a new token or the same valid one if logic re-fetched it,
    # but definitely not the invalid string.
    assert len(client.token) > 20
