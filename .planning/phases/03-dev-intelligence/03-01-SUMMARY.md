---
phase: "03"
plan: "01"
subsystem: "watcher"
tags: ["python", "watchdog", "file-monitoring"]
requires: ["02-04"]
provides: ["wims-watcher-service"]
affects: ["03-02"]
tech-stack:
  added: ["watchdog", "requests"]
  patterns: ["cursor-based-tailing", "optimistic-concurrency"]
key-files:
  created:
    - "wims-watcher/src/main.py"
    - "wims-watcher/src/watcher.py"
    - "wims-watcher/src/state.py"
    - "wims-watcher/src/client.py"
    - "wims-watcher/src/parser.py"
  modified: []
metrics:
  duration: "10 minutes"
  completed: "2026-02-06"
---

# Phase 03 Plan 01: Implement Core Watcher Service Summary

Successfully implemented the `wims-watcher` service, a standalone Python application that monitors the Claude Code history log (`~/.claude/history.jsonl`) and streams user interactions to the WIMS Core Engine.

## Features Delivered

### 1. Robust File Monitoring
- **Watchdog Integration**: Uses `watchdog` library to detect file modifications in real-time.
- **Resilient Tailing**: Implements a `StateManager` that persists the file read cursor (byte offset) to `~/.local/state/wims/watcher_cursor.json`. This ensures the watcher resumes exactly where it left off after restarts.
- **Rotation Handling**: Checks file inodes to detect if the history file has been rotated or truncated, resetting the cursor automatically to prevent data loss or crashes.

### 2. Data Ingestion Pipeline
- **JSONL Parsing**: Reads raw byte chunks, safely handles UTF-8 decoding boundaries, and parses valid JSON lines.
- **Transformation**: Converts Claude Code's internal log format (sessionId, display, project) into the standardized WIMS ingestion schema.
- **API Client**: Sends data to the Core Engine (`POST /ingest`) with basic error handling.

### 3. Reliability
- **At-Least-Once Delivery**: The cursor is only updated *after* successful API ingestion. If the API is down, the watcher will retry the same batch on the next file event.
- **Graceful Failure**: Connection errors are logged but do not crash the service.

## Verification Results

### Manual Testing
- **Setup**: Created a dummy history file `/tmp/wims_test.jsonl`.
- **Execution**: Started the watcher against this file.
- **Event Trigger**: Appended a JSON line to the file.
- **Result**:
  - Watcher detected the modification (`File modified`).
  - Watcher read the new line (`Found 1 new entries`).
  - Watcher attempted ingestion (failed as expected since Core Engine wasn't running).
  - Watcher correctly decided *not* to update the cursor, ensuring the event will be retried.

## Decisions Made

1.  **Cursor Persistence Strategy**: Decided to store `inode` + `offset` + `file_path`. This protects against writing offsets to the wrong file if `history.jsonl` is replaced (log rotation).
2.  **Error Handling**: Implemented a "halt-on-failure" strategy for the cursor. If a batch fails to send, the cursor doesn't move. This might cause duplicates if the API succeeds but the response times out, but this is preferable to data loss. WIMS Core handles deduplication via `external_id`.

## Next Steps
- **Plan 03-02**: Create the Systemd service configuration to run this watcher permanently in the background.
