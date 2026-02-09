import json
import os
import sys
from pathlib import Path
from typing import Dict, Any

# Standard config paths
CONFIG_DIR = Path.home() / ".wims"
CONFIG_FILE = CONFIG_DIR / "config.json"

def load_config() -> Dict[str, Any]:
    """
    Load configuration from ~/.wims/config.json
    Returns a dictionary with 'api_url' and 'password'.
    Exits if config is missing or invalid.
    """
    # Ensure directory exists for other uses (like token storage)
    if not CONFIG_DIR.exists():
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"Error creating config directory {CONFIG_DIR}: {e}")
            sys.exit(1)

    if not CONFIG_FILE.exists():
        print(f"Error: Config file not found at {CONFIG_FILE}")
        print(f"Please create it with content like:")
        print(json.dumps({
            "api_url": "http://localhost:8000",
            "password": "your-admin-password"
        }, indent=2))
        sys.exit(1)

    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {CONFIG_FILE}")
        sys.exit(1)

    # Validate required fields
    if "password" not in config or not config["password"]:
        print("Error: 'password' field missing or empty in config.json")
        sys.exit(1)

    # Set defaults
    if "api_url" not in config:
        config["api_url"] = "http://localhost:8000"

    # Remove trailing slash from api_url if present
    config["api_url"] = config["api_url"].rstrip("/")

    return config
