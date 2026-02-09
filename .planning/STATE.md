# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Milestone v1.1 - Security, Testing, and Hardening.

## Current Position

**Phase:** 6 - Security Core
**Status:** Complete
**Progress:** ██████████ 100%

### Current Plan
Phase 6 is done and ready for Phase 7.

## Performance Metrics

- **Test Coverage:** Frontend Basic (Target: >80%)
- **Lint Compliance:** 100% enforced via CI
- **Security:** Full Auth Middleware & CORS (Target: Extension Integration)

## Context & Memory

### Decisions
- **Auth Strategy:** Self-hosted JWT (no external provider).
- **Auth DB:** Dedicated SQLite (`data/auth.db`) separate from vector store to isolate security data.
- **Brute Force:** Progressive delay (1s/2s/4s) implemented on login endpoint.
- **CLI Framework:** Used standard `argparse` to minimize dependencies.
- **Revocation:** Timestamp-based revocation (`token_valid_after`) for global password resets.

### Blockers
- **Environment:** Local python environment missing dependencies (`passlib`, `pyjwt`) preventing local verification scripts. CI should verify.

### Session Continuity
- **Last Action:** Completed Phase 6 execution
- **Next Action:** Plan Phase 7
