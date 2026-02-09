# Phase 9: API Key Auth & Config Consolidation - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace session-based JWT auth with a persistent, simple API Key mechanism and unified configuration. This phase focuses on the backend implementation of API keys, the configuration file loader, and the removal of JWT logic. Client updates are in Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Key Generation & Output
- **Format:** Use a prefix for easy identification (e.g., `sk-wims-`) followed by a secure random string.
- **Display:** Print the key to the console on startup AND save it to `server.json`.
- **Behavior:** "Self-healing" - if `server.json` is missing, automatically generate a key and create the file.
- **Storage:** Store as plain text in `server.json` (not hashed) to allow users to easily copy/paste it into clients.

### Config File Management
- **Reloading:** Implement "Hot Reload" - watch `server.json` for changes and update configuration without restarting the server.
- **Permissions:** Permissive - do not enforce strict (0600) file permissions, trust the user's local environment.
- **Location:** Support a default path (`~/.wims/server.json`) but allow overriding via a `--config` CLI flag.
- **Port Conflict:** Fail fast if the configured port is busy (do not auto-select another port).

### Claude's Discretion
- Specific library for file watching (e.g., `watchfiles` or polling).
- Exact console output format (colors, ASCII art, etc.).
- Internal structure of the `Settings` class.

</decisions>

<specifics>
## Specific Ideas

- "No existing users. This app has never released." -> No migration logic needed for legacy JWT users.
- The `sk-wims-` prefix is a strong signal for "this is a WIMS key".

</specifics>

<deferred>
## Deferred Ideas

- Client updates (Extension/Watchers) -> Phase 11.
- Deployment scripts (setup.sh/uv) -> Phase 10.

</deferred>

---

*Phase: 09-api-key-auth-config-consolidation*
*Context gathered: 2026-02-08*
