"""Version management for WIMS Watcher."""

import logging
from pathlib import Path

import requests

GITHUB_API = "https://api.github.com/repos/jiang925/wims/releases/latest"
VERSION_FILE = Path.home() / ".wims" / ".watcher-version"


def get_current_version() -> str | None:
    """
    Read current installed version from version file.

    Returns:
        Version string (e.g., "2026.02.20") or None if not found
    """
    if VERSION_FILE.exists():
        try:
            return VERSION_FILE.read_text().strip()
        except Exception as e:
            logging.warning(f"Could not read version file: {e}")
    return None


def set_current_version(version: str) -> None:
    """
    Write current version to version file.

    Args:
        version: Version string to write
    """
    try:
        VERSION_FILE.parent.mkdir(parents=True, exist_ok=True)
        VERSION_FILE.write_text(version)
    except Exception as e:
        logging.warning(f"Could not write version file: {e}")


def get_latest_version() -> str | None:
    """
    Check GitHub API for latest release version.

    Returns:
        Latest version tag (e.g., "2026.02.20") or None if check failed
    """
    try:
        response = requests.get(GITHUB_API, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get("tag_name")
    except requests.RequestException as e:
        logging.debug(f"Could not check for updates: {e}")
    except Exception as e:
        logging.warning(f"Unexpected error checking for updates: {e}")
    return None


def check_for_updates() -> None:
    """
    Check for updates on startup and log notification if available.

    This runs once at startup and logs to the configured logger.
    """
    current = get_current_version()
    latest = get_latest_version()

    if not latest:
        logging.debug("Could not check for updates (GitHub API unavailable)")
        return

    if not current:
        logging.info(f"Running WIMS Watcher version: unknown (latest: {latest})")
        # Set current version for future checks
        set_current_version(latest)
        return

    if latest != current:
        logging.info(f"Update available: {current} → {latest}. Run 'wims-watcher update' to upgrade.")
    else:
        logging.debug(f"Running latest version: {current}")
