---
phase: 09-api-key-auth
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/app/core/config.py, requirements.txt]
autonomous: true
must_haves:
  truths:
    - "Server creates ~/.wims/server.json if missing"
    - "Config file contains a valid sk-wims- key"
    - "ConfigManager hot-reloads when file changes"
    - "watchfiles library is installed"
  artifacts:
    - path: "src/app/core/config.py"
      provides: "ConfigManager class"
      exports: ["config_manager", "ServerConfig"]
  key_links:
    - from: "src/app/core/config.py"
      to: "~/.wims/server.json"
      via: "atomic write"
---

<objective>
Implement the persistent configuration system that replaces environment variables.
Purpose: Enable stateful configuration (API Keys) and hot-reloading.
Output: A robust ConfigManager class that handles JSON persistence and key generation.
</objective>

<context>
@src/app/core/config.py
</context>

<tasks>

<task type="auto">
  <name>Task 0: Add Dependencies</name>
  <files>requirements.txt</files>
  <action>
    Add `watchfiles` to `requirements.txt` (or `pyproject.toml` if present).
    Ensure `pydantic` is also listed (>=2.0).
  </action>
  <verify>
    Run `pip install -r requirements.txt` (or equivalent) to verify installation.
    `python -c "import watchfiles"` succeeds.
  </verify>
  <done>
    Dependencies are declared and installed.
  </done>
</task>

<task type="auto">
  <name>Task 1: Define Configuration Model</name>
  <files>src/app/core/config.py</files>
  <action>
    Create `ServerConfig` Pydantic model and `ConfigManager` class.

    Requirements:
    - `ServerConfig` fields: `api_key` (str), `port` (int, default 8000), `host` (str, default 127.0.0.1).
    - `ConfigManager.__init__`: Accept `config_path`.
    - `_load_or_create()`:
      1. If file exists, load JSON.
      2. If missing, generate new config with `sk-wims-` + `secrets.token_urlsafe(32)`.
      3. Save to file using atomic write pattern (write to .tmp, then os.replace).
    - Use `~/.wims/server.json` as default path.
  </action>
  <verify>
    Create a test script that instantiates ConfigManager and checks if the file is created with a key.
  </verify>
  <done>
    ServerConfig model exists and validates inputs.
    ConfigManager automatically creates config file if missing.
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement Hot Reloading</name>
  <files>src/app/core/config.py</files>
  <action>
    Add `watch_loop()` async method to `ConfigManager` using `watchfiles`.

    Logic:
    - Use `async for changes in awatch(self.path):`
    - On change, reload config from disk.
    - Update internal `_config` state thread-safely.
    - Log "Configuration reloaded" (use print/logging).
  </action>
  <verify>
    Run a script that starts the loop, modifies the file externally, and asserts the internal state updated.
  </verify>
  <done>
    Changes to server.json are reflected in ConfigManager without restart.
  </done>
</task>

<task type="auto">
  <name>Task 3: Global Singleton</name>
  <files>src/app/core/config.py</files>
  <action>
    Instantiate a global `config_manager` instance (initially with default path, can be re-initialized by CLI).
    Add helper `get_settings()` that returns the current snapshot of `ServerConfig`.
  </action>
  <verify>
    Import `settings` from `src.app.core.config` and verify it has `api_key`.
  </verify>
  <done>
    Dependency injection ready for use in API.
  </done>
</task>

</tasks>