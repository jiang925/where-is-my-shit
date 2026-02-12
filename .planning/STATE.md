# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions.
**Current Focus:** Test Infrastructure Setup (Phase 13)

## Current Position

**Phase:** 2 of 3 (Test Infrastructure Setup)
**Plan:** Not started
**Status:** Phase 12 complete, ready for Phase 13
**Last activity:** 2026-02-12 — Completed Phase 12: Debug UI/API Connection

```text
[██░░] 33% (v1.3 - UI/API Integration & Verification)
```

*Phase 12: ✓ Complete | Phase 13: ○ Not Started | Phase 14: ○ Not Started*

## Performance Metrics
- **Auth Flow:** API Key (Extension & Watcher Integrated)
- **Setup Time:** <1 min (Achieved via auto-config & uv)
- **Dependencies:** Standardized (uv + pyproject.toml)

## Accumulated Context

### Decisions

#### From Phase 12 Plan 01 (CORS Tests and Dev Proxy)
- **CORS Test Simplification:** Simplified CORS test to skip header verification since TestClient bypasses CORS middleware - focused on functional auth verification instead while preflight OPTIONS test validates CORS headers
- **Vite Proxy Configuration:** Vite proxy uses `/api` route to backend for CORS-free development while preserving `/api/v1` relative paths for production
- **Test Pattern:** CORS auth tests use monkeypatch mocked settings for isolated testing with fixture-based API key generation

#### Previous Phase Decisions
- **Stateless Extension:** Extension updated to use `X-API-Key` and removed all login UI/JWT logic.
- **Stateless Watcher:** Python watcher now runs entirely stateless, relying on `X-API-Key` from config/env.
- **API Key over JWT:** JWT refresh logic was too complex for a single-user local tool. API Keys provide better persistence.
- **Config Persistence:** Configuration is stored in `~/.wims/server.json`.
- **Fail-Fast Startup:** Server exits immediately if the port is in use.
- **Startup UX:** API Key printed on startup.
- **UV for Everything:** Standardized on `uv`.
- **Remove Stale Integration Tests:** Deleted JWT/password auth integration tests that became obsolete after Phase 11 API key migration. Future integration tests should cover API key authentication flow.

### Key Learnings
- **Stateless Auth:** Removing session management significantly simplified the codebase.
- **Extension Store:** `chrome.storage.local` is sufficient for API keys; no need for `chrome.storage.sync` for local-only tools.
- **TestClient CORS Behavior:** FastAPI TestClient bypasses CORS middleware entirely - headers are not added to responses, requiring different test strategies for CORS verification.

### Blockers / Risks
- None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | fetch the latest github action output. fix the lint issues. Or run the CI checks and fix from there. | 2026-02-11 | 1866dbf | [001-fetch-the-latest-github-action-output-fi](./quick/001-fetch-the-latest-github-action-output-fi/) |

## Session Continuity

**Last session end:** 2026-02-12 - Completed Phase 12: Debug UI/API Connection
**Current session goal:** Phase 13: Test Infrastructure Setup

## Phase 12 Summary

**Completed:** 2026-02-12
**Plans:** 1/1 complete
**Status:** Verified ✓ (4/4 must-haves verified)

**Deliverables:**
- CORS and auth regression tests (`tests/test_cors_auth.py` - 5 tests)
- Vite dev server proxy configuration (`ui/vite.config.ts`)
- UI/API connection verification guide (`docs/PHASE12_VERIFICATION.md`)

**Key Decisions:**
- CORS test simplified (TestClient bypasses CORS) - focused on functional auth verification
- Vite proxy uses `/api` route for CORS-free development

## Next Steps

**Phase 13: Test Infrastructure Setup**
- Set up Playwright 1.58.2 for end-to-end testing
- Configure Playwright to launch FastAPI server automatically
- Create database fixtures for test data
- Set up `.env.test` configuration
