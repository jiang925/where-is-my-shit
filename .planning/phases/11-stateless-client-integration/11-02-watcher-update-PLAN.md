---
id: 11-02-watcher-update
name: Watcher API Key Integration
goal: Update Python Watcher to use API Key authentication
owner: logic
dependencies: []
must_haves:
  - Watcher reads API Key from config
  - Watcher sends X-API-Key header in requests
  - All JWT/Password logic is removed from watcher
---

<task type="auto" id="WATCH-01">
  <files>
    <file>wims-watcher/src/config.py</file>
  </files>
  <action>
    Update configuration loading to:
    1. Look for `api_key` in the config file (preferring `~/.wims/server.json` if we decide to share it, or just the existing config location).
    2. Remove password validation/loading.
  </action>
  <verify>
    Run `python3 wims-watcher/src/config.py` (if testable) or verify via inspection.
  </verify>
  <done>
    Config loader reads api_key.
  </done>
</task>

<task type="auto" id="WATCH-02">
  <files>
    <file>wims-watcher/src/client.py</file>
  </files>
  <action>
    Refactor `Client` class:
    1. Remove `login()`, `_load_token()`, `_save_token()`.
    2. Remove `token_file` handling.
    3. Update `__init__` to accept `api_key`.
    4. Update `_get_headers()` to include `X-API-Key`.
  </action>
  <verify>
    Verify the Client class no longer has login methods.
  </verify>
  <done>
    Client uses api_key for headers, no login logic.
  </done>
</task>

<task type="auto" id="WATCH-03">
  <files>
    <file>wims-watcher/src/main.py</file>
  </files>
  <action>
    Update `main()` to:
    1. Load config (including api_key).
    2. Initialize Client with the api_key.
    3. Remove any initial login checks (auth check happens on first ingest/ping).
  </action>
  <verify>
    Verify main.py passes the api_key to the client.
  </verify>
  <done>
    Main initializes Client with api_key.
  </done>
</task>
