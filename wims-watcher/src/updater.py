"""Update mechanism for WIMS Watcher daemon."""

import logging
import os
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

import requests

from .version import GITHUB_API, VERSION_FILE, get_current_version, get_latest_version, set_current_version

INSTALL_DIR = Path.home() / ".local" / "bin" / "wims-watcher"


def perform_update() -> bool:
    """
    Download and install latest version from GitHub releases.

    This function:
    1. Checks GitHub for latest version
    2. Downloads the watcher tarball
    3. Backs up config
    4. Replaces installation directory
    5. Restores config
    6. Restarts service
    7. Updates version file

    Returns:
        True if update succeeded, False otherwise
    """
    logging.info("Checking for updates...")

    latest = get_latest_version()
    current = get_current_version()

    if not latest:
        logging.error("Could not fetch latest version from GitHub")
        logging.error("Check your internet connection or try again later.")
        return False

    if latest == current:
        logging.info(f"Already on latest version: {current}")
        return True

    logging.info(f"Updating {current or 'unknown'} → {latest}...")

    try:
        # Fetch release info
        response = requests.get(GITHUB_API, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Find watcher tarball asset
        tarball_url = None
        for asset in data.get("assets", []):
            if "watcher" in asset["name"] and asset["name"].endswith(".tar.gz"):
                tarball_url = asset["browser_download_url"]
                break

        if not tarball_url:
            logging.error("Could not find watcher tarball in release assets")
            logging.error(f"Release: {data.get('html_url', 'unknown')}")
            return False

        # Download tarball
        download_path = Path("/tmp/wims-watcher-update.tar.gz")
        extract_path = Path("/tmp/wims-watcher-update")

        logging.info(f"Downloading {tarball_url}...")
        response = requests.get(tarball_url, stream=True, timeout=60)
        response.raise_for_status()

        with open(download_path, "wb") as f:
            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total_size:
                    percent = (downloaded / total_size) * 100
                    logging.debug(f"Downloaded {percent:.1f}%")

        logging.info("Download complete")

        # Extract tarball
        logging.info("Extracting...")
        if extract_path.exists():
            shutil.rmtree(extract_path)
        extract_path.mkdir(parents=True, exist_ok=True)

        with tarfile.open(download_path, "r:gz") as tar:
            tar.extractall(extract_path)

        # Backup config if exists
        config_file = Path.home() / ".wims" / "server.json"
        config_backup = None
        if config_file.exists():
            config_backup = config_file.read_text()
            logging.info("Backed up config file")

        # Verify extracted directory exists
        extracted_watcher = extract_path / "wims-watcher"
        if not extracted_watcher.exists():
            # Try to find it in subdirectory
            subdirs = list(extract_path.glob("*/wims-watcher"))
            if subdirs:
                extracted_watcher = subdirs[0]
            else:
                logging.error("Could not find wims-watcher directory in tarball")
                return False

        # Replace installation
        logging.info("Installing update...")
        if INSTALL_DIR.exists():
            shutil.rmtree(INSTALL_DIR)

        shutil.move(str(extracted_watcher), str(INSTALL_DIR))
        logging.info(f"Installed to {INSTALL_DIR}")

        # Restore config
        if config_backup:
            config_file.parent.mkdir(parents=True, exist_ok=True)
            config_file.write_text(config_backup)
            logging.info("Restored config file")

        # Update version file
        set_current_version(latest)
        logging.info(f"Updated version file to {latest}")

        # Restart service
        logging.info("Restarting service...")
        restart_success = restart_service()

        if restart_success:
            logging.info(f"✓ Successfully updated to version {latest}")
        else:
            logging.warning(f"✓ Updated to version {latest}, but service restart may have failed")
            logging.warning("Please restart the service manually:")
            if sys.platform == "darwin":
                logging.warning(f"  launchctl kickstart -k gui/{os.getuid()}/com.wims.watcher")
            else:
                logging.warning("  systemctl --user restart wims-watcher.service")

        # Cleanup
        try:
            download_path.unlink()
            shutil.rmtree(extract_path)
        except Exception:
            pass

        return True

    except requests.RequestException as e:
        logging.error(f"Download failed: {e}")
        logging.error("Check your internet connection or try again later.")
        return False
    except tarfile.TarError as e:
        logging.error(f"Failed to extract tarball: {e}")
        return False
    except Exception as e:
        logging.error(f"Update failed: {e}")
        logging.error("Your installation may be in an inconsistent state.")
        logging.error("Please report this issue: https://github.com/jiang925/wims/issues")
        return False


def restart_service() -> bool:
    """
    Restart the watcher service.

    Returns:
        True if restart succeeded, False otherwise
    """
    try:
        if sys.platform == "darwin":
            # macOS launchd
            result = subprocess.run(
                ["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/com.wims.watcher"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                logging.debug(f"launchctl stderr: {result.stderr}")
                return False
        else:
            # Linux systemd
            result = subprocess.run(
                ["systemctl", "--user", "restart", "wims-watcher.service"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                logging.debug(f"systemctl stderr: {result.stderr}")
                return False

        return True

    except subprocess.TimeoutExpired:
        logging.warning("Service restart timed out")
        return False
    except FileNotFoundError:
        logging.warning("Service manager not found")
        return False
    except Exception as e:
        logging.warning(f"Could not restart service: {e}")
        return False
