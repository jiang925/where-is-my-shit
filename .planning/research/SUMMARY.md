# Research Summary: v1.3 UI/API Integration & Verification

**Project:** Where Is My Shit (WIMS)
**Milestone:** v1.3 - UI/API Integration & Verification
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

v1.3 focuses on making the system actually work by fixing UI/API connectivity and adding automated verification. Research recommends **Playwright 1.58.2** as the integration testing framework, **real backend testing** (not mocking) for reliability, and a **single-server architecture** (FastAPI serves both API and UI to match production).

The research identified critical pitfalls: **CORS + Auth failures** as the most likely cause of the broken UI connection, **flaky tests** from timing issues, and **post-development test debt** from components designed without testability in mind.

## Key Findings

### Stack Additions

| Component | Version | Notes |
|-----------|---------|-------|
| Playwright | 1.58.2 (2026-02-06 release) | Latest stable, excellent TypeScript support |
| Test Runner | Playwright built-in | Orchestration, fixtures, API testing |
| Dev Server | FastAPI only | Serve both `/api/v1/*` and `/` to avoid dual-server complexity |

**Architecture Choice:** Single-server approach (FastAPI serves everything) is optimal for integration tests. Avoids Vite dev server complexity while matching production deployment.

**Coexistence:** Vitest (unit tests) and Playwright (integration tests) coexist seamlessly with separate commands: `npm run test` vs `npm run test:integration`.

### Feature Categories

**Table Stakes (Must Have):**
- Basic search endpoint test with API auth (`X-API-Key` header)
- UI receives and displays search results
- Auth flow verification (API key transmission)

**Differentiators (Nice to Have):**
- Multiple search scenarios (empty results, long queries, special characters)
- CORS validation tests
- Error handling tests (401 response, 500 error display)

**Anti-Features (Avoid):**
- Full E2E test suite (keep it minimal)
- Tests that require external services
- Heavy mocking that defeats integration value
- Complex test setup requiring containers

### Architecture Integration

**Test Location:** `ui/e2e/` or `tests/integration/` at project root (team preference)

**Fixtures:** Custom Playwright fixtures using project dependencies pattern for full database seeding
- Database initialization fixture
- Test data cleanup fixture
- API client fixture for precondition seeding

**Dev Server Orchestration:** Playwright `webServer` config launches FastAPI automatically
```typescript
webServer: {
  command: 'uv run uvicorn src.app.main:app --host 127.0.0.1 --port 8000',
  url: 'http://localhost:8000',
  reuseExistingServer: !process.env.CI,
  timeout: 120000
}
```

**Build Order:**
1. Playwright Setup (install + config)
2. Test Fixtures (database seeding)
3. Basic Integration Test (auth + search)
4. Additional Scenarios (error handling, edge cases)

### Critical Pitfalls

**Pitfall 1: CORS + Auth Token Failure Cascade (Most Likely Cause)**

The UI/API connection failure is almost certainly a CORS + auth issue:
- **CORS misconfig:** `allow_origins=["*"]` with `allow_credentials=True` is forbidden by browsers
- **Auth token passing:** React may not be sending `Authorization: Api-Key <token>` header
- **Preflight failures:** Missing OPTIONS method handling blocks requests before they reach FastAPI

**Fix Priority 1:** Configure CORS correctly before writing tests
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Explicit, not "*"
    allow_credentials=True,
    allow_methods=["*"],  # Include OPTIONS
    allow_headers=["*"],  # Include Authorization
)
```

**Fix Priority 2:** Verify React auth header format matches FastAPI security scheme
```typescript
headers: { 'Authorization': `Api-Key ${apiKey}` }
```

**Pitfall 2: Flaky Tests from Implicit Timing**

Tests that use `waitForTimeout()` or fixed delays fail randomly in CI. Ban timeout entirely:
- ✅ Use `waitForSelector()`, `waitForResponse()`, `waitForFunction()`
- ❌ Never use `waitForTimeout()`, `page.waitFor()`, thread sleeps

**Pitfall 3: Post-Development Test Debt**

Components built without testability in mind cause fragile tests:
- Add `data-testid` attributes before writing tests
- Use Page Object Model to centralize selectors
- Test user flows, not implementation details

## Phase Structure Recommendations

Based on research, here's the suggested v1.3 phase structure:

### Phase 12: Debug UI/API Connection
**Goal:** Identify and fix the root cause of UI not connecting to backend.
**Delivers:** Working CORS configuration, verified auth token transmission
**Addresses:** Likely CORS + auth failure (Pitfall 1)
**Success Criteria:**
- UI successfully loads and connects to API
- Search queries reach FastAPI (visible in logs)
- Browser console free of CORS errors

### Phase 13: Test Infrastructure Setup
**Goal:** Establish Playwright framework with fixtures and dev server orchestration.
**Delivers:** `@playwright/test@1.58.2`, `playwright.config.ts`, database fixtures
**Addresses:** Environment setup, test isolation (Pitfall 4)
**Success Criteria:**
- Playwright runs and launches FastAPI automatically
- Database fixtures inject and clean up test data
- Test passes: "FastAPI responds with 200 OK"

### Phase 14: Core Integration Tests
**Goal:** Verify the complete search flow works end-to-end.
**Delivers:** Basic search test, auth flow test, error handling test
**Addresses:** Core flow verification, flaky test prevention (Pitfall 2, 3)
**Success Criteria:**
- User can search and see results displayed
- Auth failures show user-friendly errors
- All tests pass reliably in CI

**Note:** Phase numbering starts at 12 (continuing from Phase 11 in v1.2).

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Playwright setup | HIGH | Verified from official Playwright docs |
| CORS fixes | HIGH | FastAPI CORS documentation confirms patterns |
| Flaky test prevention | HIGH | Playwright best practices validated |
| Fixtures organization | HIGH | Fixture patterns well-documented |
| Single-server choice | MEDIUM | Matches production, needs verification |

**Overall confidence:** HIGH

## Sources

- **Playwright WebServer Docs:** https://playwright.dev/docs/test-webserver
- **Playwright Test Fixtures:** https://playwright.dev/docs/test-fixtures
- **Playwright API Testing:** https://playwright.dev/docs/api-testing
- **Playwright Best Practices:** https://playwright.dev/docs/test-best-practices
- **FastAPI CORS:** https://fastapi.tiangolo.com/tutorial/cors/
- **FastAPI Testing:** https://fastapi.tiangolo.com/tutorial/testing/
- **Pytest Fixtures:** https://docs.pytest.org/

---
*Research completed: 2026-02-12*
*Ready for requirements: yes*
