# Phase 6: Security Core - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure the local API against unauthorized access. Implement authentication (JWT), secure password storage, and network access controls. The goal is to move from "open local server" to "secured personal tool."

</domain>

<decisions>
## Implementation Decisions

### Setup & Recovery
- **Initial Password:** Auto-generate a strong password and print it to stdout on first run. Secure default.
- **Recovery:** Implement a CLI command (e.g., `wims reset-password`) to set a new password. Requires local shell access (proof of ownership).
- **Complexity:** Strict enforcement for reset/changed passwords (length + mixed case/numbers).
- **Storage:** Use a dedicated SQLite database (`auth.db`) for credentials to separate security data from content data.

### Token Strategy
- **Duration:** Long-lived tokens (30 days) for convenience.
- **Revocation:** Changing the password immediately invalidates all existing tokens (likely via a `token_generation` timestamp in the user record).
- **Expiration:** Simple re-login after 30 days. No complex refresh token dance needed for a local tool.

### Access Control
- **Rate Limiting:** Progressive delays (1s -> 2s -> 4s) for failed attempts. Frustrates brute force without locking out the owner.
- **Network Binding:** Default to `127.0.0.1` (Localhost). Add a configuration flag to allow binding to `0.0.0.0` for LAN access if desired.

### Claude's Discretion
- **Extension Storage:** Use `LocalStorage` in the extension for token storage (simplest for extension header injection).
- **CORS:** Strict allow-list. Only allow requests from:
  - Localhost origins
  - The specific Chrome Extension ID
- **Error Responses:** Generic `401 Unauthorized` / `403 Forbidden` messages to prevent user enumeration.

</decisions>

<specifics>
## Specific Ideas

- "Make sure it's convenient and yet not easily accessible by outsiders."
- The "CLI reset" pattern is a common and accepted way to handle "I forgot my localhost password" scenarios (like Jupyter notebooks).

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-security-core*
*Context gathered: 2026-02-07*
