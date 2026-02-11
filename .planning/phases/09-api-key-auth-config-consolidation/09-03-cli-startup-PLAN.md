---
phase: 09-api-key-auth
plan: 03
type: execute
wave: 3
depends_on: [09-02]
files_modified: [src/cli.py, src/app/main.py]
autonomous: true
must_haves:
  truths:
    - "User can specify config path via --config"
    - "Server fails if port is busy"
    - "API Key is printed to console on startup"
  artifacts:
    - path: "src/cli.py"
      provides: "CLI entry point"
  key_links:
    - from: "src/cli.py"
      to: "src/app/core/config.py"
      via: "config_manager.load(path)"
---

<objective>
Finalize the entry point to handle configuration arguments and startup UX.
Purpose: Provide a "one-command" experience with clear credentials.
Output: CLI that parses args and initializes the server correctly.
</objective>

<context>
@src/app/core/config.py
@src/cli.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Port Availability Check</name>
  <files>src/cli.py</files>
  <action>
    Implement `is_port_available` check using `socket`.
    In the main startup routine, read the port from `server.json` (via ConfigManager).
    If port is in use, print error and `sys.exit(1)`.
    Do NOT auto-select a random port (per requirements).
  </action>
  <verify>
    Run `nc -l 8000` in one terminal, then try starting the app. Should fail gracefully.
  </verify>
  <done>
    Fail-fast behavior implemented.
  </done>
</task>

<task type="auto">
  <name>Task 2: CLI Argument Parsing</name>
  <files>src/cli.py</files>
  <action>
    Update CLI to accept `--config`.
    Initialize `config_manager` with the provided path (or default).
    Ensure `uvicorn.run` uses the host/port from the loaded config.
  </action>
  <verify>
    `python src/cli.py --config ./test-config.json` creates/reads from that specific file.
  </verify>
  <done>
    Config path is configurable.
  </done>
</task>

<task type="auto">
  <name>Task 3: Startup UX and Background Watcher</name>
  <files>src/app/main.py</files>
  <action>
    In `app` startup event (lifespan):
    1. Start the `config_manager.watch_loop()` as a background task.
    2. Print the API Key to stdout (formatted clearly).
       Example:
       "🔑 WIMS API Key: sk-wims-xyz..."
       "📄 Config: ~/.wims/server.json"
  </action>
  <verify>
    Start server and observe console output.
  </verify>
  <done>
    Key is visible on startup, and hot-reload loop is active.
  </done>
</task>

</tasks>