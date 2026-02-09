---
phase: 09-api-key-auth
plan: 03
subsystem: cli
tags: [cli, config, startup, ux]
---

# Phase 09 Plan 03: CLI & Startup Summary

Finalized the server entry point to support custom configuration paths, fail-fast port checking, and a developer-friendly startup banner.

## Key Changes

### CLI Improvements (`src/cli.py`)
- **Config Flag:** Added `--config <path>` to specify a custom server configuration file (defaults to `~/.wims/server.json`).
- **Fail-Fast Port Check:** The server now checks if the bind port is available before attempting to start Uvicorn, providing a clear error message instead of a stack trace.
- **Argument Priority:** CLI arguments (`--host`, `--port`) override configuration file settings.

### Startup Experience (`src/app/main.py`)
- **Credential Banner:** On startup, the server prints the active API Key and configuration path to `stdout` for easy copy-pasting.
- **Background Watcher:** The configuration watcher is now managed as a background `asyncio` task within the application lifespan, ensuring it starts and stops cleanly with the server.

### Configuration Management
- **Runtime Switching:** Added `set_config_path()` to `ConfigManager` to support the CLI flag.
- **Environment Support:** Added `WIMS_CONFIG_FILE` environment variable support as a fallback.

## Verification Results

### Automated Checks
- **Port Conflict:** Verified that starting the server on a busy port exits with code 1 and a helpful error message.
- **Config Loading:** Verified that `--config` correctly loads settings from the specified file.
- **Startup Output:** Confirmed the API key banner appears in the console logs.

## Deviations
None. The plan was executed as written.
