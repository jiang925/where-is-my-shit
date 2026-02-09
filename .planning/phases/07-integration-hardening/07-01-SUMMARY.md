---
phase: 07
plan: 01
subsystem: extension
tags:
  - extension
  - auth
  - jwt
  - security
requires:
  - 06-02
provides:
  - extension-auth
affects:
  - extension-user-flow
---

# Phase 7 Plan 1: Extension Authentication Summary

## One-Liner
Implemented JWT authentication flow in Chrome extension with persistent token storage and "login first" UI.

## Decisions Made

### Authentication Flow
- **Pattern:** "Login First"
- **Rationale:** The extension cannot function without a valid token. Rather than complex background refresh flows (which are hard with self-hosted instances), we block all operations until the user authenticates via the Popup.
- **Storage:** Tokens are stored in `chrome.storage.local` alongside settings. This ensures they persist across browser restarts but are not synced to other devices (security best practice).

### Error Handling
- **AuthError:** Created a specific error class for 401/403 responses.
- **Queue Behavior:** The offline queue pauses immediately upon encountering an AuthError. It retains the failed item and all subsequent items. Processing automatically resumes once a new token is detected via storage change listener.

### UI Feedback
- **Badge:** The extension badge turns red with "LOGIN" text when authentication fails.
- **Popup:** The main status view is replaced by a login form when `authRequired` state is true or no token exists.

## Tech Stack
- **Storage:** `chrome.storage.local` for token persistence.
- **Messaging:** Chrome Runtime messaging for state synchronization between Popup and Service Worker.
- **API:** Native `fetch` with Bearer token injection.

## Key Files

### Modified
- `extension/src/lib/storage.ts`: Added `authToken` schema.
- `extension/src/lib/api.ts`: Added interceptor and error handling.
- `extension/src/background/service-worker.ts`: Added auth state management.
- `extension/src/lib/queue.ts`: Added queue pausing on auth error.
- `extension/src/popup/popup.html`: Added login form.
- `extension/src/popup/popup.ts`: Added login logic.
- `extension/src/popup/popup.css`: Added login styles.

## Metrics
- **Duration:** ~10 minutes
- **Completed:** 2026-02-08

## Deviations from Plan
None - plan executed exactly as written.

## Authentication Gates
None encountered during development (this plan *built* the authentication gate for the user).

## Self-Check: PASSED
