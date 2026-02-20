import logging
import os
import sys
from pathlib import Path

# Configure logging to both stdout and file
LOG_FILE = Path.home() / ".wims" / "watcher.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, mode="a"),
    ],
)

# Add src to path if running directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.client import WimsClient
from src.config import load_config
from src.sources.antigravity import AntigravityWatcher
from src.sources.claude import ClaudeWatcher
from src.sources.cursor import CursorWatcher
from src.version import check_for_updates
from src.watcher import LogWatcher


def main():
    # Check for updates on startup
    check_for_updates()

    # Load configuration
    config = load_config()

    # Initialize Client with API Key
    client = WimsClient(base_url=config["api_url"], api_key=config["api_key"])

    # Check connection
    if not client.check_connection():
        logging.warning(
            f"Core Engine not reachable at {client.base_url}. "
            "Watcher will retry ingestion, but ensure wims-core service is running."
        )
    else:
        logging.info(f"Connected to Core Engine at {client.base_url}")

    # Default location for Claude history
    claude_history_file = os.environ.get("CLAUDE_HISTORY_FILE", "~/.claude/history.jsonl")

    # Default location for Antigravity logs (taking the most recent or a specific one)
    # For MVP, we'll assume a fixed path or let the watcher handle finding the latest if it was a directory watcher.
    # But since BaseWatcher expects a file, let's point to a default log file if it exists, or a placeholder.
    antigravity_log_file = os.environ.get("ANTIGRAVITY_LOG_FILE", "~/.antigravity/logs/latest.log")

    # Default location for Cursor state
    # This is tricky as the UUID changes.
    # Ideally we'd scan ~/.config/Cursor/User/workspaceStorage/ for the most recently modified state.vscdb
    cursor_state_db = os.environ.get("CURSOR_STATE_DB", "")

    watchers = []

    # Add Claude Watcher
    if os.path.exists(os.path.expanduser(claude_history_file)):
        watchers.append(ClaudeWatcher(claude_history_file, client=client))
    else:
        logging.warning(f"Claude history file not found at {claude_history_file}")

    # Add Antigravity Watcher
    expanded_ag_path = os.path.expanduser(antigravity_log_file)
    if os.path.exists(expanded_ag_path):
        watchers.append(AntigravityWatcher(expanded_ag_path, client=client))
    else:
        # Check if directory exists and pick latest
        ag_dir = os.path.dirname(expanded_ag_path)
        if os.path.exists(ag_dir) and os.path.isdir(ag_dir):
            # basic logic to find latest log
            try:
                files = [os.path.join(ag_dir, f) for f in os.listdir(ag_dir) if f.endswith(".log")]
                if files:
                    latest_log = max(files, key=os.path.getmtime)
                    watchers.append(AntigravityWatcher(latest_log, client=client))
                    logging.info(f"Watching latest Antigravity log: {latest_log}")
            except Exception as e:
                logging.error(f"Error finding Antigravity logs: {e}")
        else:
            logging.warning(f"Antigravity log file not found at {antigravity_log_file}")

    # Add Cursor Watcher
    if cursor_state_db:
        if os.path.exists(os.path.expanduser(cursor_state_db)):
            watchers.append(CursorWatcher(cursor_state_db, client=client))
    else:
        # Try to auto-discover latest cursor workspace
        cursor_base = os.path.expanduser("~/.config/Cursor/User/workspaceStorage")
        if os.path.exists(cursor_base):
            try:
                # Find all state.vscdb files
                db_files = []
                for root, dirs, files in os.walk(cursor_base):
                    if "state.vscdb" in files:
                        db_files.append(os.path.join(root, "state.vscdb"))

                if db_files:
                    # Pick the most recently modified
                    latest_db = max(db_files, key=os.path.getmtime)
                    watchers.append(CursorWatcher(latest_db, client=client))
                    logging.info(f"Watching latest Cursor state DB: {latest_db}")
                else:
                    logging.warning("No Cursor state.vscdb files found.")
            except Exception as e:
                logging.error(f"Error discovering Cursor DB: {e}")
        else:
            logging.warning(f"Cursor workspace storage not found at {cursor_base}")

    if not watchers:
        logging.error("No watchers could be initialized. Exiting.")
        return

    watcher = LogWatcher(watchers)
    watcher.start()


if __name__ == "__main__":
    # Handle update command
    if len(sys.argv) > 1 and sys.argv[1] == "update":
        from src.updater import perform_update

        success = perform_update()
        sys.exit(0 if success else 1)
    else:
        main()
