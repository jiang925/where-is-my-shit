# Research: Phase 03 - Dev Intelligence (Claude Code Watcher)

## 1. Objective Analysis
The goal is to implement `wims-watcher`, a background service that:
1.  Monitors `~/.claude/history.jsonl` in real-time.
2.  Parses new command/prompt entries.
3.  Ingests them into the WIMS Core Engine.

**Key Constraint:** The service must be robust (systemd), resume-capable (state tracking), and lightweight.

## 2. Source Analysis: `history.jsonl`
**Location:** `/home/pter/.claude/history.jsonl`
**Format:** JSON Lines (UTF-8).

**Sample Record:**
```json
{
  "display": "/mcp ",
  "pastedContents": {},
  "timestamp": 1762824199682,
  "project": "/home/pter/code/nexusphp",
  "sessionId": "94ba6257-5181-4e6c-a28d-41d165fb686d"
}
```

**Field Mapping for Ingestion:**
| Claude Field | WIMS Ingest Field | Notes |
|--------------|-------------------|-------|
| `display` | `content` | The user's prompt or command. |
| `sessionId` | `external_id` | Used to group messages into a conversation. |
| `timestamp` | `timestamp` | Milliseconds epoch. Needs conversion if API expects ISO. |
| `project` | `metadata.project` | Context for where the command was run. |
| `pastedContents` | `metadata.pasted` | (Optional) Store as raw metadata if useful. |
| *static* | `source` | Value: `"claude-code"` |

**Behavior:**
-   Appended to when the user executes a command in Claude Code.
-   Contains *User Inputs* only (not AI responses).
-   One line per interaction.

## 3. Architecture & Design

### 3.1. The Watcher Loop (Python)
We will use the `watchdog` library, but specifically focused on file modification.
Since `watchdog` can be tricky with specific file append events on some filesystems, a robust approach often combines `watchdog` (for wake-up) with a polling fallback or just specific event handling.

**Algorithm:**
1.  **Load State:** Read `last_read_offset` from `~/.local/state/wims/watcher_state.json`.
2.  **Initial Catch-up:** Open `history.jsonl`, seek to `last_read_offset`, read to end. Process lines.
3.  **Watch:** Start `Observer` on `~/.claude/`.
4.  **On Event (`modified: history.jsonl`):**
    -   Open file.
    -   Seek to known offset.
    -   Read new lines.
    -   Update offset in memory.
    -   Send to API.
    -   *On Success:* Update `last_read_offset` on disk.

### 3.2. State Persistence
We must track where we left off to prevent re-indexing the entire history on every service restart.

**State File:** `~/.local/state/wims/watcher_state.json`
```json
{
  "file_path": "/home/pter/.claude/history.jsonl",
  "inode": 123456,
  "offset": 45032,
  "last_updated": 1762826382994
}
```
*Note: Tracking `inode` helps detect log rotation (though rare for this specific file, it's good practice).*

### 3.3. API Integration
The Core Engine (Phase 1) provides `POST /ingest`.

**Payload:**
```json
{
  "source": "claude-code",
  "external_id": "94ba6257-5181-4e6c-a28d-41d165fb686d",
  "timestamp": 1762824199682,
  "content": "Research this codebase...",
  "metadata": {
    "project": "/home/pter/code/nexusphp",
    "type": "prompt"
  }
}
```

**Error Handling:**
-   If Core Engine is down: Queue events in memory (limited size) or retry with exponential backoff.
-   Since this is a local service, we can fail softly (log error, retry later) or just rely on the "file cursor" concept. *Decision:* Rely on the cursor. Do not advance the cursor on disk until the API ack is received. This provides "At Least Once" delivery.

## 4. System Integration
**Service Unit:** `~/.config/systemd/user/wims-watcher.service`

```ini
[Unit]
Description=WIMS Watcher for Claude Code
After=network.target

[Service]
ExecStart=/usr/bin/python3 -m wims_watcher
Restart=on-failure
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
```

**Deployment:**
-   `systemctl --user enable --now wims-watcher`
-   `loginctl enable-linger $USER` (Ensure it runs even if user isn't actively logged in, though usually for dev tools, run-on-login is fine).

## 5. Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| **Log Rotation** | If `history.jsonl` is deleted/recreated, the inode changes. The watcher should check inode on startup/read. If changed, reset offset to 0. |
| **Concurrency** | User types fast. API might be slow. The generic `read lines -> send` loop is synchronous. For low volume (manual typing), this is fine. |
| **Privacy** | `history.jsonl` may contain sensitive data (API keys in prompts). *Decision:* No redaction for now (as per scope), but user should be aware. |
| **Core Engine Offline** | If API fails, catch exception, wait 5s, retry. Do NOT update offset. |

## 6. Implementation Plan Inputs
For the Planner (Phase 3 Plan):
1.  **Dependencies:** `watchdog`, `requests`, `appdirs` (for standard config paths).
2.  **Project Structure:**
    -   `src/watcher/main.py`
    -   `src/watcher/observer.py`
    -   `src/watcher/client.py`
3.  **Verification:**
    -   Unit test: Mock file appending.
    -   Integration test: Run watcher, append to dummy file, check Core Engine API logs.
