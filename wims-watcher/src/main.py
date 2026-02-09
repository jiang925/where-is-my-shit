import logging
import os
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Add src to path if running directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.watcher import LogWatcher

def main():
    # Default location for Claude history
    history_file = os.environ.get("CLAUDE_HISTORY_FILE", "~/.claude/history.jsonl")

    watcher = LogWatcher(history_file)
    watcher.start()

if __name__ == "__main__":
    main()
