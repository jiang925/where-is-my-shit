# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions.
**Current Focus:** Test Infrastructure Setup (Phase 13)

## Current Position

**Phase:** 2 of 3 (Test Infrastructure Setup)
**Plan:** 2 of 2 complete
**Status:** Phase complete - All plans finished
**Last activity:** 2026-02-12 — Completed 13-02-PLAN.md (Database Fixtures)

```text
[████] 100% (v1.3 - UI/API Integration & Verification)
```

*Phase 12: ✓ Complete | Phase 13: ✓ Complete (2/2) | Phase 14: ○ Not Started*

## Performance Metrics
- **Auth Flow:** API Key (Extension & Watcher Integrated)
- **Setup Time:** <1 min (Achieved via auto-config & uv)
- **Dependencies:** Standardized (uv + pyproject.toml)

## Accumulated Context

### Decisions

#### From Phase 13 Plan 02 (Database Fixtures)
- **Test Config Isolation:** Create separate test-server-config.json during globalSetup to ensure tests don't use development config - server reads from WIMS_CONFIG_FILE env var
- **Auth Fixture Pattern:** apiKey fixture provides key, but APIRequestContext requires explicit headers (page.route doesn't affect API requests)
- **Worker-Scoped Database:** testDbPath fixture uses worker scope to prevent LanceDB file locking conflicts
- **Static Config Path:** webServer env uses static path to test config file (process.env values not available at config load time)

#### From Phase 13 Plan 01 (Playwright Setup)
- **Single Worker Mode:** Set `workers: 1` and `fullyParallel: false` to prevent LanceDB file locking conflicts - LanceDB doesn't support concurrent writes from multiple processes
- **Generous webServer Timeout:** 120-second timeout accounts for first-run scenarios where uv must initialize virtual environment and download embedding models; `reuseExistingServer: !process.env.CI` allows manual dev server during development
- **Request-Based Testing Pattern:** Use Playwright's `request` context for API testing instead of browser-based page navigation for more efficient endpoint verification

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
- **APIRequestContext vs Page Routing:** Playwright's APIRequestContext is separate from Page - page.route interceptors don't affect API requests, requiring explicit header management.

### Blockers / Risks
- None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | fetch the latest github action output. fix the lint issues. Or run the CI checks and fix from there. | 2026-02-11 | 1866dbf | [001-fetch-the-latest-github-action-output-fi](./quick/001-fetch-the-latest-github-action-output-fi/) |

## Session Continuity

**Last session end:** 2026-02-12 - Completed 13-02-PLAN.md
**Stopped at:** Phase 13 complete (2/2 plans)
**Resume file:** .planning/ROADMAP.md (next phase planning)

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

## Phase 13 Plan 01 Summary

**Completed:** 2026-02-12
**Status:** Complete ✓ (3/3 tasks)
**Duration:** 2 minutes

**Deliverables:**
- Playwright 1.58.2 with chromium, firefox, webkit browser binaries
- playwright.config.ts with webServer auto-launch configuration
- E2E test directory structure (tests/e2e/{spec,fixtures,pages})
- Verification test confirming server auto-launch works

**Key Decisions:**
- Single worker mode prevents LanceDB locking conflicts
- 120s webServer timeout for uv venv + model loading
- Request-based API testing pattern established

## Phase 13 Plan 02 Summary

**Completed:** 2026-02-12
**Status:** Complete ✓ (6/6 tasks + 4 auto-fixes)
**Duration:** 4 minutes

**Deliverables:**
- Test environment configuration (.env.test, .env.test.example)
- Global test setup (tests/e2e/playwright.setup.ts) loading test config
- Auth fixture (tests/e2e/fixtures/auth.ts) with API key injection
- Database fixture (tests/e2e/fixtures/database.ts) with worker-scoped isolation
- Verification tests confirming all fixtures work (3/3 passing)

**Key Decisions:**
- Test config uses dedicated test-server-config.json for isolation
- Auth fixture provides apiKey but request context requires explicit headers
- Database fixture is worker-scoped to prevent LanceDB locks
- GlobalSetup creates test server config before webServer starts

**Auto-fixes:**
- Test server config creation (blocking issue)
- Expect import error (bug fix)
- Request context headers (bug fix)
- WebServer env timing (bug fix)

## Next Steps

**Phase 13 Complete** - All test infrastructure in place
**Next:** Phase 14 (or next roadmap item)
