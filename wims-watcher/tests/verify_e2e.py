import os
import sys
import time
import json
import requests
import subprocess
from pathlib import Path

def get_service_status():
    """Check if systemd service is active."""
    try:
        result = subprocess.run(
            ["systemctl", "--user", "is-active", "wims-watcher"],
            capture_output=True,
            text=True
        )
        return result.stdout.strip() == "active"
    except Exception as e:
        print(f"Error checking service status: {e}")
        return False

def append_history_event(history_file):
    """Append a test event to history file."""
    event = {
        "sessionId": "verify-e2e-session",
        "timestamp": int(time.time() * 1000),
        "display": "WIMS Verification Test",
        "project": "/home/pter/code/where-is-my-shit",
        "cwd": "/home/pter/code/where-is-my-shit",
        "type": "prompt"
    }

    with open(history_file, 'a') as f:
        f.write(json.dumps(event) + "\n")

    return event

def verify_ingestion(base_url, session_id):
    """Check if the event appears in search results."""
    # Note: Search endpoint is POST /api/v1/search
    search_url = f"{base_url}/api/v1/search"
    payload = {
        "query": "WIMS Verification Test",
        "limit": 5,
        "conversation_id": None
    }

    # Retry a few times as ingestion is async
    for i in range(10):
        try:
            print(f"Checking search results (attempt {i+1})...")
            response = requests.post(search_url, json=payload, timeout=5)
            if response.status_code == 200:
                results = response.json()
                # Debug print
                # print(results)

                # Check if our test string is in the results
                # Structure depends on Phase 1 implementation.
                # Assuming results is a list of objects or similar.
                results_str = json.dumps(results)
                if "WIMS Verification Test" in results_str:
                    return True
            else:
                print(f"Search failed: {response.status_code}")
        except Exception as e:
            print(f"Request failed: {e}")

        time.sleep(1)

    return False

def main():
    print("Starting End-to-End Verification...")

    # 1. Check Service
    if not get_service_status():
        print("FAIL: wims-watcher service is not running.")
        sys.exit(1)
    print("PASS: wims-watcher service is active.")

    # 2. Check Core Engine
    core_url = "http://localhost:8000"
    try:
        requests.get(f"{core_url}/docs", timeout=2)
        print("PASS: Core Engine is reachable.")
    except:
        print("FAIL: Core Engine is not running at http://localhost:8000")
        print("Please start the Core Engine (uvicorn src.app.main:app) to fully verify.")
        # We can't verify ingestion if core is down, but we verified the service is up.
        # The plan requires "Logs show successful connection" or similar.
        # If Core is down, Watcher logs will show connection errors.

        # Check watcher logs
        print("\nWatcher Logs (last 10 lines):")
        subprocess.run(["systemctl", "--user", "status", "wims-watcher", "-n", "10", "--no-pager"])
        sys.exit(1)

    # 3. Simulate Event
    history_file = Path(os.path.expanduser("~/.claude/history.jsonl"))
    print(f"Appending test event to {history_file}...")
    append_history_event(history_file)

    # 4. Verify Ingestion
    if verify_ingestion(core_url, "verify-e2e-session"):
        print("PASS: Test event found in Core Engine search.")
        sys.exit(0)
    else:
        print("FAIL: Test event not found in Core Engine search after timeout.")
        sys.exit(1)

if __name__ == "__main__":
    main()
