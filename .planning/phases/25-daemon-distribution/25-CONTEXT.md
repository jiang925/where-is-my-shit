# Phase 25: Daemon Distribution - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Package and distribute standalone watcher daemon without requiring git clone. Script-based installer with uv auto-install (prompted), systemd/launchd service setup, auto-update mechanism, and uninstall script. Distributes via GitHub Releases.

</domain>

<decisions>
## Implementation Decisions

### Install Script Behavior
- **Installation location:** ~/.local/bin/wims-watcher (user-level, no sudo)
- **Existing install:** Update in place (idempotent install, preserve config)
- **Python requirement:** Require Python pre-installed (fail with message if not found)
- **uv handling:** Prompt user "Install uv? (y/n)" before installing (per DAEMON-02)
- **Output style:** Minimal output - show key milestones and final status only

### Service Configuration
- **Auto-start:** Yes, service starts automatically on boot
- **Restart policy:** Auto-restart always on crash (systemd/launchd automatic restart)
- **Log location:** ~/.wims/watcher.log (consistent with server config location)
- **Service type:** User service (systemd --user, launchd ~/Library) - no sudo, runs when user logged in

### Auto-update Mechanism
- **Check frequency:** On startup only (no background checks)
- **Notification:** Log message only (write to ~/.wims/watcher.log)
- **Update application:** Notify only, manual update - user runs update command when ready
- **Manual check command:** No separate check-update command (only startup check)

### Uninstall Cleanup
- **Remove automatically:** Watcher daemon files + service configuration (systemd/launchd)
- **Prompt before removing:** Config file (~/.wims/server.json) and database (~/.wims/*.lance)
- **Confirmation:** Yes, require "Are you sure?" before proceeding with uninstall
- **Stop daemon:** Yes, stop service before uninstalling (clean shutdown)
- **Output:** Show what's being removed (transparent cleanup)

</decisions>

<specifics>
## Specific Ideas

- Consistent with existing wims-watcher/ behavior (user service, ~/.wims location)
- One-liner: `curl -sSL https://raw.githubusercontent.com/jiang925/wims/main/install-watcher.sh | bash`
- Update command: `wims-watcher update` (manual trigger after log notification)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-daemon-distribution*
*Context gathered: 2026-02-20*
