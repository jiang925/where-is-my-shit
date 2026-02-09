# Phase 3: Dev Intelligence - Context & Analysis

## 1. Goal
Create a local background service (`wims-watcher`) that monitors the Claude Code history log and indexes developer interactions into the WIMS Core Engine.

## 2. Scope & Targets
-   **Primary Target:** Claude Code (`~/.claude/history.jsonl`).
-   **Deferred:** Antigravity and Cursor (located on a different machine; out of scope for this specific host implementation).
-   **Privacy:** No redaction required.

## 3. Technical Architecture

### 3.1. Service: `wims-watcher`
-   **Language:** Python 3.10+
-   **Lifecycle:** Systemd User Service (`systemd --user`). This ensures it starts on login and restarts on failure.
-   **Dependencies:** `watchdog` (file events), `requests` (API client).

### 3.2. Data Source: `history.jsonl`
-   **Location:** `~/.claude/history.jsonl`
-   **Format:** JSON Lines.
-   **Key Fields:**
    -   `sessionId`: Unique identifier for the conversation.
    -   `timestamp`: Event time.
    -   `display`: The user prompt or command.
    -   `project`: The working directory/context.

### 3.3. Aggregation Logic
-   **Session-Based:** The Core Engine expects "Sessions", not individual log lines.
-   **Behavior:**
    1.  On startup, scan `history.jsonl` to build a cache of known sessions.
    2.  Watch `history.jsonl` for modifications.
    3.  On append, parse new lines.
    4.  Group new lines by `sessionId`.
    5.  Send an "Update Session" payload to the Core Engine for the active session.

## 4. Implementation Strategy

### 4.1. The Watcher
-   Use `watchdog` to monitor `~/.claude/`.
-   Filter for `history.jsonl` modification events.
-   Maintain a `cursor` (byte offset) to read only new data (tail).

### 4.2. The Payload
The payload sent to `POST /ingest` (or specific endpoint) should look like:
```json
{
  "source": "claude-code",
  "external_id": "5da30382-e7e1-4730-9739-76fa25f16c1b",
  "timestamp": 1762826382994,
  "content": "Research this codebase...",
  "metadata": {
    "project": "/home/pter/code/nexusphp",
    "type": "prompt"
  }
}
```
*Note: The Planner will define the exact API schema based on Phase 1.*

## 5. Next Steps
1.  Create `wims-watcher` Python project structure.
2.  Implement the `history.jsonl` parser.
3.  Implement the API client.
4.  Create the systemd service unit file.
