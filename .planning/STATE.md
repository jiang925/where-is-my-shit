# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Milestone v1.1 - Security, Testing, and Hardening.

## Current Position

**Phase:** 6 - Security Core
**Status:** In Progress
**Progress:** █░░░░░░░░░ 20% (Phase 6, Plan 2 Complete)

### Current Plan
Completed 06-02 (Hardening & CLI Tools). Secure endpoints, strict CORS, and CLI management tools are now in place.

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
- **Last Action:** Completed 06-02-PLAN (Hardening & CLI Tools).
- **Next Action:** Execute 06-RESEARCH (Chrome Extension Security Integration).
