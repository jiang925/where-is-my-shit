# WIMS Watcher Daemon

The WIMS Watcher daemon is a background service that monitors local AI tool log directories and automatically captures development session conversations. It runs continuously as a user-level service (systemd on Linux, launchd on macOS) and requires no manual intervention once installed.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Supported Tools](#supported-tools)
- [Update and Maintenance](#update-and-maintenance)
- [Uninstallation](#uninstallation)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)

## Installation

### Quick Install

Install with a single command:

```bash
curl -sSL https://raw.githubusercontent.com/jiang925/wims/main/install-watcher.sh | bash
```

The installer will:

1. Check for Python 3.11+ (required)
2. Prompt to install `uv` if not present
3. Download the latest watcher release
4. Install to `~/.local/bin/wims-watcher`
5. Create a virtual environment and install dependencies
6. Set up platform-specific service (systemd/launchd)
7. Start the service automatically

### Installation Locations

- **Daemon files:** `~/.local/bin/wims-watcher/`
- **Service config:**
  - Linux: `~/.config/systemd/user/wims-watcher.service`
  - macOS: `~/Library/LaunchAgents/com.wims.watcher.plist`
- **Logs:** `~/.wims/watcher.log`
- **Config:** `~/.wims/server.json` (shared with WIMS server)
- **Version file:** `~/.wims/.watcher-version`

### Prerequisites

- **Python 3.11+** (must be pre-installed)
- **uv** (installer will prompt to install if missing)
- **Internet connection** (for initial download only)
- **~50MB disk space**

### Platform Support

- **Linux:** systemd user service (tested on Ubuntu 22.04+)
- **macOS:** launchd user agent (tested on Ventura+)
- **Windows:** Not supported (use WSL)

## Configuration

The watcher reads configuration from `~/.wims/server.json`, which is auto-created by the WIMS server on first run.

### Required Configuration

Only two fields are required:

```json
{
  "api_key": "sk-wims-xxxxxxxxxxxxxxxxxxxx",
  "api_url": "http://localhost:8000"
}
```

The server auto-generates `api_key` on first startup. Copy it from the server logs or web UI.

### Full Configuration Example

```json
{
  "api_key": "sk-wims-abc123",
  "api_url": "http://localhost:8000",
  "port": 8000,
  "host": "127.0.0.1"
}
```

The watcher derives `api_url` from `host` and `port` if not explicitly set.

### Environment Variables

Optional overrides for log file locations:

```bash
# Claude history file (default: ~/.claude/history.jsonl)
export CLAUDE_HISTORY_FILE=~/custom/path/history.jsonl

# Antigravity logs (default: ~/.antigravity/logs/latest.log)
export ANTIGRAVITY_LOG_FILE=~/custom/antigravity.log

# Cursor state database (default: auto-discovered)
export CURSOR_STATE_DB=~/.config/Cursor/User/workspaceStorage/{uuid}/state.vscdb
```

## Supported Tools

### Claude Code

- **Log location:** `~/.claude/history.jsonl`
- **Format:** JSONL (one conversation per line)
- **Auto-discovery:** Yes
- **Monitoring:** Real-time via file watcher

### Cursor

- **Log location:** `~/.config/Cursor/User/workspaceStorage/{uuid}/state.vscdb`
- **Format:** SQLite database
- **Auto-discovery:** Yes (finds most recently modified workspace)
- **Monitoring:** Periodic polling

### Gemini CLI

- **Log location:** `~/.gemini/tmp/*/chats/`
- **Format:** Session files
- **Auto-discovery:** Yes
- **Monitoring:** Real-time via file watcher

### Continue.dev

- **Log location:** `~/.continue/sessions/`
- **Format:** Session files
- **Auto-discovery:** Yes
- **Monitoring:** Real-time via file watcher

### Cline

- **Log location:** VS Code globalStorage (Cline tasks)
- **Format:** Task files
- **Auto-discovery:** Yes
- **Monitoring:** Real-time via file watcher

### Aider

- **Log location:** `.aider.chat.history.md` files
- **Format:** Markdown chat history
- **Auto-discovery:** Yes
- **Monitoring:** Real-time via file watcher

### Jan.ai

- **Log location:** `~/jan/threads/`
- **Format:** JSONL session files
- **Auto-discovery:** Yes
- **Monitoring:** Real-time via file watcher

### Antigravity

- **Log location:** `~/.antigravity/logs/`
- **Format:** Plain text log files
- **Auto-discovery:** Yes (finds latest log file)
- **Monitoring:** Real-time via file watcher

### Open WebUI

- **API endpoint:** Polls `/api/v1/chats`
- **Format:** JSON via HTTP API
- **Auto-discovery:** Requires Open WebUI to be running
- **Monitoring:** Periodic API polling

For Ollama and other self-hosted setups using Open WebUI as a frontend.

### Adding New Tools

To add support for additional tools, extend the watcher source:

1. Create a new parser in `wims-watcher/src/sources/`
2. Implement the `BaseWatcher` interface
3. Add detection logic to `main.py`

See existing parsers for examples.

## Update and Maintenance

### Auto-Update Checking

The watcher checks for updates on startup by querying the GitHub Releases API. If a newer version is available, it logs a notification:

```
Update available: 2026.02.19 → 2026.02.20. Run 'wims-watcher update' to upgrade.
```

No background update checks occur during runtime — only on service start.

### Manual Update

Update to the latest version:

```bash
wims-watcher update
```

The update process:

1. Downloads the latest release from GitHub
2. Backs up `~/.wims/server.json`
3. Replaces `~/.local/bin/wims-watcher/` with new version
4. Restores config
5. Restarts service automatically

### Update Behavior

- **Config preserved:** `~/.wims/server.json` is backed up and restored
- **Database untouched:** Vector database (`~/.wims/*.lance`) is not modified
- **Atomic replacement:** Old installation is removed only after new version is extracted
- **Auto-restart:** Service restarts automatically after update

### Version Information

Check installed version:

```bash
cat ~/.wims/.watcher-version
```

Check latest available version:

```bash
curl -sSL https://api.github.com/repos/jiang925/wims/releases/latest | grep tag_name
```

## Uninstallation

### Clean Uninstall

Run the uninstall script:

```bash
bash ~/.local/bin/wims-watcher/uninstall.sh
```

The script will:

1. Prompt for confirmation
2. Stop and remove the service
3. Remove daemon files from `~/.local/bin/wims-watcher`
4. Prompt before removing config and database files

### What Gets Removed

**Always removed:**
- `~/.local/bin/wims-watcher/` (daemon files)
- `~/.config/systemd/user/wims-watcher.service` (Linux)
- `~/Library/LaunchAgents/com.wims.watcher.plist` (macOS)
- `~/.wims/.watcher-version`

**Prompt before removing:**
- `~/.wims/server.json` (config file)
- `~/.wims/*.lance` (database files)
- `~/.wims/watcher.log` (log file)

### Partial Uninstall

To remove only the daemon but keep your data:

```bash
# Stop service
systemctl --user stop wims-watcher.service  # Linux
launchctl bootout gui/$(id -u)/com.wims.watcher  # macOS

# Remove daemon
rm -rf ~/.local/bin/wims-watcher
```

Config and database remain intact for reinstallation.

## Troubleshooting

### Service Won't Start

**Check service status:**

```bash
# Linux
systemctl --user status wims-watcher.service

# macOS
launchctl print gui/$(id -u)/com.wims.watcher
```

**View logs:**

```bash
tail -f ~/.wims/watcher.log
```

**Common causes:**

1. **Python not found:** Verify Python 3.11+ is installed
   ```bash
   python3 --version
   ```

2. **Config missing:** Ensure `~/.wims/server.json` exists with valid `api_key`
   ```bash
   cat ~/.wims/server.json
   ```

3. **Server not running:** Start the WIMS server first
   ```bash
   cd where-is-my-shit
   ./start.sh
   ```

### Watcher Not Capturing Conversations

**Check log file for errors:**

```bash
tail -f ~/.wims/watcher.log
```

**Verify watched files exist:**

```bash
# Claude
ls -la ~/.claude/history.jsonl

# Cursor
find ~/.config/Cursor/User/workspaceStorage -name "state.vscdb"

# Antigravity
ls -la ~/.antigravity/logs/
```

**Test server connectivity:**

```bash
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:8000/health
```

**Restart service:**

```bash
# Linux
systemctl --user restart wims-watcher.service

# macOS
launchctl kickstart -k gui/$(id -u)/com.wims.watcher
```

### Update Failed

If update fails mid-process:

1. **Check logs:**
   ```bash
   tail -n 50 ~/.wims/watcher.log
   ```

2. **Reinstall manually:**
   ```bash
   curl -sSL https://raw.githubusercontent.com/jiang925/wims/main/install-watcher.sh | bash
   ```

The installer is idempotent and will repair broken installations.

### Permission Errors

The watcher runs as your user and should not require sudo. If you see permission errors:

1. **Check installation directory ownership:**
   ```bash
   ls -la ~/.local/bin/wims-watcher
   ```

2. **Ensure service directories are writable:**
   ```bash
   mkdir -p ~/.config/systemd/user  # Linux
   mkdir -p ~/Library/LaunchAgents  # macOS
   ```

3. **Verify log directory is writable:**
   ```bash
   mkdir -p ~/.wims
   touch ~/.wims/watcher.log
   ```

### Service Not Auto-Starting on Boot

**Linux:**

Enable lingering (allows user services to run without login session):

```bash
loginctl enable-linger $(whoami)
```

Verify service is enabled:

```bash
systemctl --user is-enabled wims-watcher.service
```

**macOS:**

Verify plist is loaded:

```bash
launchctl list | grep wims
```

Reload if needed:

```bash
launchctl unload ~/Library/LaunchAgents/com.wims.watcher.plist
launchctl load ~/Library/LaunchAgents/com.wims.watcher.plist
```

## Architecture

### Components

```
~/.local/bin/wims-watcher/
├── src/
│   ├── main.py           # Entry point, service orchestration
│   ├── config.py         # Configuration loader
│   ├── client.py         # WIMS API client
│   ├── watcher.py        # File watcher manager
│   ├── version.py        # Version checking
│   ├── updater.py        # Auto-update logic
│   └── sources/
│       ├── claude.py       # Claude Code parser
│       ├── cursor.py       # Cursor parser
│       ├── gemini.py       # Gemini CLI parser
│       ├── continue_dev.py # Continue.dev parser
│       ├── cline.py        # Cline parser
│       ├── aider.py        # Aider parser
│       ├── jan.py          # Jan.ai parser
│       ├── antigravity.py  # Antigravity parser
│       └── open_webui.py   # Open WebUI API poller
├── templates/
│   ├── wims-watcher.service.template  # systemd unit
│   ├── com.wims.watcher.plist.template # launchd plist
│   └── uninstall.sh.template          # Uninstaller
├── requirements.txt
├── .venv/                # Virtual environment (created by uv)
└── VERSION               # Version marker
```

### Service Configuration

**systemd (Linux):**

- **Type:** User service (`systemctl --user`)
- **Start:** `After=network.target`
- **Restart:** Always on failure (`Restart=always`, `RestartSec=5`)
- **Output:** Logs to `~/.wims/watcher.log`

**launchd (macOS):**

- **Type:** User agent (`~/Library/LaunchAgents`)
- **Start:** `RunAtLoad=true`
- **Restart:** `KeepAlive=true` (auto-restart on crash)
- **Output:** Logs to `~/.wims/watcher.log`

### Watcher Workflow

1. **Startup:**
   - Load config from `~/.wims/server.json`
   - Check for updates (GitHub API)
   - Connect to WIMS server (health check)
   - Auto-discover tool log files

2. **Monitoring:**
   - Watch file changes (Claude, Antigravity)
   - Poll database periodically (Cursor)
   - Parse new conversations
   - Send to server for indexing

3. **Error Handling:**
   - Log warnings if tool files not found
   - Retry failed ingestions
   - Continue monitoring even if server is down

4. **Shutdown:**
   - Graceful stop on SIGTERM
   - Close file watchers
   - Flush logs

### Communication with Server

The watcher communicates with the WIMS server via HTTP API:

- **Authentication:** X-API-Key header
- **Endpoint:** `POST /ingest`
- **Format:** JSON payload with conversation data
- **Retry:** 3 attempts with exponential backoff

### Dependencies

Minimal dependency set:

- `watchdog` — File system monitoring
- `requests` — HTTP client for server API

The watcher is intentionally lightweight to minimize maintenance overhead.

## Support

- **Issues:** https://github.com/jiang925/wims/issues
- **Docs:** https://github.com/jiang925/wims/tree/main/docs
- **Source:** https://github.com/jiang925/wims/tree/main/wims-watcher
