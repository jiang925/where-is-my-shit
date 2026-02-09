# Phase 7: Integration Hardening - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Clients handle security gracefully and end-to-end flows are verified. This phase bridges the gap between the secured API (Phase 6) and the client tools (Extension, Watchers), ensuring they can authenticate and operate smoothly.

</domain>

<decisions>
## Implementation Decisions

### Extension UX
- **Notification:** Immediate Popup when unauthorized (401). Don't wait for user interaction; prompt immediately if session is lost/invalid.
- **Login Flow:** In-Popup Form. Keep the user in the extension context; do not open a new tab.
- **Session Persistence:** Persist sessions across browser restarts (using `chrome.storage.local`).
- **Mid-Action Expiry:** Overlay & Preserve. If a token expires while typing/searching, show a login overlay that preserves the current state (search text), allowing seamless continuation after login.

### Watcher Auth (CLI/Background)
- **Credential Source:** Config File. Watchers should read credentials from a local configuration file (e.g., `~/.wims/config.json` or similar).
- **Token Lifecycle:** Auto-Refresh. If the JWT expires during a long-running process, the watcher should automatically use the stored password/credentials to obtain a new token without crashing.
- **Token Storage:** Disk Cache. Persist the JWT to disk to survive restarts, minimizing the need for fresh logins.
- **Auth Failure:** Fail Fast. If authentication fails (e.g., wrong password in config), exit immediately with a specific error code. Do not retry endlessly.

### Claude's Discretion
- Exact configuration file format and location (though standard paths preferred).
- Specific visual design of the login overlay in the extension.
- Internal implementation of the token refresh logic (interceptors vs. proactive checks).

</decisions>

<specifics>
## Specific Ideas

- The extension's "Overlay & Preserve" behavior is critical for usability—losing a complex search query due to a background token expiry is a major annoyance to avoid.
- Watchers should be "set and forget" once configured.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-integration-hardening*
*Context gathered: 2026-02-07*
