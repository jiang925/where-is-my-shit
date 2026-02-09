# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Milestone v1.1 - Security, Testing, and Hardening.

## Current Position

**Phase:** 7 - Integration & Hardening
**Plan:** 02 of 03 (Watcher Authentication)
**Status:** Complete
**Progress:** ██████░░░░ 66%

### Current Plan
Phase 7 Plan 2 (Watcher Authentication) is complete. Ready for Plan 3 (E2E Hardening).

## Performance Metrics

- **Test Coverage:** Frontend Basic (Target: >80%)
- **Lint Compliance:** 100% enforced via CI
- **Security:** Full Auth Middleware & CORS (Target: Extension Integration - DONE)

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

### Blockers
- **Environment:** Local python environment missing dependencies (`passlib`, `pyjwt`) preventing local verification scripts. CI should verify.

### Session Continuity
- **Last Action:** Completed Phase 7 Plan 2 (Watcher Authentication)
- **Next Action:** Plan Phase 7 Plan 3 (E2E Hardening)
