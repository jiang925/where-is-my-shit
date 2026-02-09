# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Milestone v1.1 - Security, Testing, and Hardening.

## Current Position

**Phase:** 8 - Hotfix Auth
**Plan:** 01 of 01 (Fix JWT Timestamp Precision)
**Status:** Complete
**Progress:** ██████████ 100%

### Current Plan
Phase 8 Plan 01 is complete. Fixed critical JWT timestamp precision bug.

## Performance Metrics

- **Test Coverage:** Integration Auth Flow (100% Pass)
- **Lint Compliance:** 100% enforced via CI
- **Security:** Full Auth Middleware & CORS (Verified via Integration Tests)

## Context & Memory

### Decisions
- **Auth Strategy:** Self-hosted JWT (no external provider).
- **Extension Auth:** "Login First" pattern. Extension blocks operations until user authenticates via Popup.
- **Token Storage:** `chrome.storage.local` used for persistence (survives browser restart, no cloud sync).
- **Error Handling:** Queue pauses immediately on 401/403, resumes automatically after login.
- **Revocation:** Timestamp-based revocation (`token_valid_after`) for global password resets.
- **Watcher Config:** Standardized on `~/.wims/config.json` for credentials.
- **Watcher Token:** Persisted in `~/.wims/token` to minimize login requests.
- **Watcher Auth:** Automatic retry on 401 with re-login flow.
- **Integration Testing:** Uses real `uvicorn` server fixture with temporary databases to verify full HTTP stack and client behavior.
- **JWT Validation:** Cast `token_valid_after` to int to avoid floating point precision race conditions.

### Blockers
- **Environment:** Local python environment required manual dependency installation (`passlib`, `pyjwt`, `httpx`, `pytest`). Future setup should use `requirements.txt` strictly.

### Session Continuity
- **Last Action:** Completed Phase 8 Plan 01 (Hotfix Auth).
- **Next Action:** Ready for deployment or further maintenance.
