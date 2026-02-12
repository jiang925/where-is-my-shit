# Roadmap: Where Is My Shit (WIMS)

## Overview

This milestone resolves UI/API connectivity issues, establishes comprehensive test infrastructure, and implements core integration tests to validate end-to-end functionality after v1.2 deployment.

## Completed Milestones

### v1.2: Simplify & Deploy (Feb 2026)
**Goal:** Radical simplification of UX and deployment.
- **Auth:** Moved from JWT to API Key (`X-API-Key`).
- **Config:** Centralized in `~/.wims/server.json`.
- **Deploy:** Standardized on `uv` with `setup.sh`/`start.sh`.
- **Clients:** Stateless extension and watchers.

### v1.1: Security & Hardening (Feb 2026)
**Goal:** Security and CI/CD foundations.
- **Security:** Local binding, password hashing, basic auth.
- **Quality:** CI pipelines, unit/integration tests.

### v1.0: Proof of Concept (Jan 2026)
**Goal:** MVP.
- **Core:** Ingestion, Embedding, Vector Search.
- **UI:** Basic React frontend.

---

## v1.3: UI/API Integration & Verification (Current)

**Goal:** Verify platform functionality through automated testing and resolve connectivity issues.

### Phase 12: Debug UI/API Connection

**Goal:** Resolve network-level and authentication barriers preventing UI from accessing the API

**Dependencies:**
- v1.2 deployment complete
- Running API and UI instances accessible locally

**Requirements:**
- CORS-01: Allow localhost UI origin in CORS configuration
- CORS-02: Permit necessary HTTP methods and headers for API interactions
- CORS-03: Handle preflight OPTIONS requests correctly
- AUTH-05: React frontend sends API key in `Authorization: Api-Key <token>` header format
- AUTH-06: FastAPI validates API key from `Authorization` header using `ApiKeyHeader` security scheme

**Success Criteria:**
1. Developer can load UI in browser without CORS errors in console
2. Developer can enter API key in UI and search requests include `Authorization: Api-Key <token>` header
3. Developer can perform search requests that successfully reach the API with authentication
4. Developer can view API endpoints in browser network tab seeing proper CORS headers and Authorization header

---

### Phase 13: Test Infrastructure Setup

**Goal:** Establish foundational testing framework for automated verification of platform functionality

**Dependencies:**
- Phase 12 complete (UI/API connection working)
- GitHub Actions CI/CD workflow exists from v1.2

**Requirements:**
- TEST-05: Playwright 1.58.2 is installed and configured in the project
- TEST-06: Playwright config launches FastAPI server automatically via webServer configuration
- TEST-07: Database fixtures inject and clean up test data to prevent test interference
- TEST-08: Test environment is configured with `.env.test` file for test-specific settings

**Success Criteria:**
1. Developer runs `npm run test:integration` and Playwright launches FastAPI automatically
2. Developer can run integration tests and they pass with database setup/teardown
3. Developer can add new tests using fixtures without duplicating setup code
4. Test environment uses separate `.env.test` configuration without affecting development settings

---

### Phase 14: Core Integration Tests

**Goal:** Verify critical platform workflows are working end-to-end from UI through API to search engine

**Dependencies:**
- Phase 12 complete (UI/API connection working)
- Phase 13 complete (test infrastructure operational)

**Requirements:**
- INTEG-01: User can enter an API key, submit a search query, and see search results displayed in the UI
- INTEG-02: User sees an appropriate error message when searching without an API key

**Success Criteria:**
1. Developer runs integration test and sees API key authentication succeed
2. Developer runs integration test and receives search results containing results from test data
3. Developer runs integration test and sees error message when API key is missing
4. All integration tests pass reliably with explicit wait conditions (no `waitForTimeout`)

---

## Progress

| Phase | Name | Status | Plans | Last Updated |
|-------|------|--------|-------|--------------|
| 12 | Debug UI/API Connection | Complete | 1/1 | 2026-02-12 |
| 13 | Test Infrastructure Setup | Complete | 2/2 | 2026-02-12 |
| 14 | Core Integration Tests | Not Started | 0 | - |

**Overall v1.3 Progress:** 2/3 phases (67%)

**Total v1.3 Plans:** 3

### Phase 12 Plans

- [x] [12-debug-ui-api-connection-01-PLAN.md](.planning/phases/12-debug-ui-api-connection/12-debug-ui-api-connection-01-PLAN.md) — Add CORS/auth regression tests and Vite proxy configuration

### Phase 13 Plans

- [x] [13-test-infrastructure-setup-01-PLAN.md](.planning/phases/13-test-infrastructure-setup/13-01-PLAN.md) — Install Playwright with auto-launch FastAPI server configuration
- [x] [13-test-infrastructure-setup-02-PLAN.md](.planning/phases/13-test-infrastructure-setup/13-02-PLAN.md) — Create test fixtures for auth and database isolation

**Previous Milestones:**
- v1.2: 11 phases (Complete)
- v1.1: 3 phases (Complete)
- v1.0: 8 phases (Complete)

**Total Completed Phases:** 23

---

*Last updated: 2026-02-12*
