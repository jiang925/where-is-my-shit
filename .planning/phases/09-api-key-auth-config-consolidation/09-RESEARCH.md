# Phase 09: API Key Auth & Config Consolidation - Research

**Researched:** 2026-02-08
**Domain:** Backend Authentication & Configuration Management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Implementation Decisions**
    - **Key Generation & Output**
        - **Format:** Use a prefix for easy identification (e.g., `sk-wims-`) followed by a secure random string.
        - **Display:** Print the key to the console on startup AND save it to `server.json`.
        - **Behavior:** "Self-healing" - if `server.json` is missing, automatically generate a key and create the file.
        - **Storage:** Store as plain text in `server.json` (not hashed) to allow users to easily copy/paste it into clients.
    - **Config File Management**
        - **Reloading:** Implement "Hot Reload" - watch `server.json` for changes and update configuration without restarting the server.
        - **Permissions:** Permissive - do not enforce strict (0600) file permissions, trust the user's local environment.
        - **Location:** Support a default path (`~/.wims/server.json`) but allow overriding via a `--config` CLI flag.
        - **Port Conflict:** Fail fast if the configured port is busy (do not auto-select another port).

### Claude's Discretion
- Specific library for file watching (e.g., `watchfiles` or polling).
- Exact console output format (colors, ASCII art, etc.).
- Internal structure of the `Settings` class.

### Deferred Ideas (OUT OF SCOPE)
- Client updates (Extension/Watchers) -> Phase 11.
- Deployment scripts (setup.sh/uv) -> Phase 10.
</user_constraints>

## Summary

This phase replaces the complex JWT/Password authentication system with a lightweight, persistent API Key mechanism and consolidates configuration into a single JSON file (`server.json`). This simplifies the "single-user local tool" architecture, improves developer experience (easy to copy keys), and enables hot-reloading of settings.

**Primary recommendation:** Use `watchfiles` for hot-reloading (leveraging existing `uvicorn` dependencies), `pydantic` for config validation, and a singleton `ConfigManager` to handle thread-safe configuration updates.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **pydantic** | >=2.0 | Config definition & validation | Already in use, robust type safety |
| **watchfiles** | Latest | File system monitoring | Efficient (Rust-based), included with `uvicorn[standard]` |
| **fastapi.security** | - | Header extraction | Built-in support for `APIKeyHeader` |

### Removed Dependencies
| Library | Why Removing |
|---------|--------------|
| **pyjwt** | Replaced by simple string comparison |
| **passlib** | No password hashing required for API keys |
| **python-multipart** | Login form support no longer needed |

## Architecture Patterns

### Configuration Management (`ConfigManager`)
Instead of `pydantic-settings` (env vars), we will implement a file-based loader.

```python
# src/app/core/config.py pattern

class ServerConfig(BaseModel):
    api_key: str
    port: int = 8000
    host: str = "127.0.0.1"
    # ... other settings

class ConfigManager:
    def __init__(self, config_path: Path):
        self.path = config_path
        self._config: ServerConfig = self._load_or_create()

    def get(self) -> ServerConfig:
        return self._config

    def _load_or_create(self) -> ServerConfig:
        # Logic to load JSON or create with default + new API Key
        pass

    async def watch_loop(self):
        # Async generator using watchfiles
        async for changes in awatch(self.path):
             self.reload()
```

### Authentication Flow
The `Depends` system will check the `X-API-Key` header against the *current* config.

```python
# src/app/core/auth.py (Simplified)

security = APIKeyHeader(name="X-API-Key")

async def get_current_user(
    api_key_header: str = Security(security),
    settings: ServerConfig = Depends(get_settings)
):
    if not secrets.compare_digest(api_key_header, settings.api_key):
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Invalid API Key"
        )
    return True  # User is authenticated
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **File Watching** | Custom polling loops | `watchfiles` | Handles OS-specific events efficiently; handles debouncing |
| **Atomic Writes** | `open(w).write()` | Write temp + `os.replace` | Prevents corrupt `server.json` if crash occurs during write |
| **Header Parsing** | Manual Request access | `fastapi.security.APIKeyHeader` | Auto-generates OpenAPI docs (padlock icon) |

## Common Pitfalls

### Pitfall 1: Race Conditions During Reload
**What goes wrong:** Config is read halfway through a write, or thread issues updating the global singleton.
**Prevention:**
1. Use atomic writes (write to `server.json.tmp` then rename).
2. In Python (GIL), swapping the reference `self._config = new_config` is atomic.

### Pitfall 2: Port Binding Failures
**What goes wrong:** User changes port in `server.json` to a busy port while server is running.
**Prevention:** Hot-reloading strictly affects *runtime* behavior (logs, thresholds), but usually **cannot** change the bound port of the running process easily without a restart.
**Strategy:** Log a warning that "Port changes require a restart" but reload other settings. For *startup*, check port availability immediately and `sys.exit(1)` if busy.

### Pitfall 3: Infinite Reload Loops
**What goes wrong:** Server writes to `server.json` (e.g., to save a generated key) -> Watcher sees change -> Triggers reload -> Writes again.
**Prevention:** Only write if file is missing. Do not write back to file on simple reload.

## Code Examples

### Atomic Write Pattern
```python
import json
import os

def save_config(path: str, data: dict):
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, path)  # Atomic replacement
```

### Port Availability Check
```python
import socket

def is_port_available(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) != 0
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 9) | Impact |
|------------------------|------------------------|--------|
| **JWT (Session)** | **API Key (Persistent)** | No expiration, simpler clients |
| **SQLite Auth DB** | **`server.json`** | Human-readable, easy backup |
| **Env Vars** | **JSON Config** | Structured, hot-reloadable |

## Open Questions

1.  **CLI Argument Parsing**
    - Need to introduce `argparse` or `click` in `src/app/main.py` (or `src/cli.py` if that's the entry point) to handle `--config`.
    - *Recommendation:* Since `src/app/main.py` is an ASGI app file, arguments are usually passed to the runner (`uvicorn`). We should ensure the app can find the config path via an environment variable that the runner sets, OR use a dedicated entry point script that parses args then sets up the app.

## Sources

### Primary (HIGH confidence)
- **FastAPI Docs** - Security/API Key implementation patterns.
- **Uvicorn Docs** - `watchfiles` integration and behavior.

### Secondary (MEDIUM confidence)
- **Standard Library** - `json`, `secrets`, `socket` capabilities.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Core Python/FastAPI ecosystem.
- Architecture: HIGH - Simplified significantly from JWT.
- Pitfalls: HIGH - Common file-system concurrency issues.

**Research date:** 2026-02-08
