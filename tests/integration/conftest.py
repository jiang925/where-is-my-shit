import os
import sys
import time
import threading
import pytest
import uvicorn
import requests
from pathlib import Path

# Set test environment variables BEFORE importing app to ensure settings load correctly
os.environ["WIMS_PASSWORD"] = "test-password"
# Use a temporary DB path for tests to avoid messing with real data
os.environ["DB_PATH"] = "data/test_wims.lance"
os.environ["AUTH_DB_PATH"] = "data/test_auth.db"

# Add project root to path so we can import src
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

# Add wims-watcher src to path so we can import WimsClient
WATCHER_SRC = PROJECT_ROOT / "wims-watcher" / "src"
sys.path.append(str(WATCHER_SRC))

from src.app.main import app
from src.app.core.config import settings

# Helper to find a free port
def get_free_port():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port

@pytest.fixture(scope="session")
def live_server():
    """
    Starts the FastAPI server in a separate thread.
    Returns the base URL.
    """

    port = get_free_port()
    host = "127.0.0.1"
    base_url = f"http://{host}:{port}"

    def run_server():
        uvicorn.run(app, host=host, port=port, log_level="error")

    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()

    # Wait for server to be ready
    max_retries = 50
    for i in range(max_retries):
        try:
            response = requests.get(f"{base_url}/api/v1/health")
            if response.status_code == 200:
                break
        except requests.ConnectionError:
            time.sleep(0.1)
    else:
        raise RuntimeError("Server failed to start")

    yield base_url

    # Cleanup (Thread is daemon, so it dies when main process dies)
    # But we might want to clean up the test DBs
    try:
        if os.path.exists("data/test_auth.db"):
            os.remove("data/test_auth.db")
        # LanceDB cleanup might be more complex if it's a directory
        import shutil
        if os.path.exists("data/test_wims.lance"):
            shutil.rmtree("data/test_wims.lance")
    except Exception as e:
        print(f"Cleanup error: {e}")
