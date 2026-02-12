# Domain Pitfalls

**Domain:** UI/API Integration Testing (React/FastAPI/Playwright)
**Researched:** 2026-02-12

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Post-Development Test Integration (The "TDD Debt" Problem)

**What goes wrong:** Adding integration tests after components are built without test hooks leads to fragile, hard-to-maintain tests that fail for unrelated reasons. Tests become "checking" rather than "driving" code quality.

**Why it happens:**
- Components were designed with user functionality in mind, not testability
- Missing test IDs, stable selectors, and data-test attributes
- Tight coupling between UI components and API contracts
- Assumptions hardcoded throughout the codebase (API URLs, timeouts, retry logic)

**Consequences:**
- Tests break when UI styling changes unrelated to functionality
- False positives require constant maintenance
- Team loses trust in tests, starts ignoring failures
- Every refactoring becomes a test rewrite exercise

**Prevention:**
1. **Add before you fix:** Create test IDs/selectors as the first step in v1.3 debugging phase
2. **Stable selectors only:** Use `data-testid` attributes instead of CSS selectors or class names
3. **Test boundaries, not implementation:** Test API contracts and user flows, not internal React component rendering
4. **Page Object Model:** Abstract selectors into Page Objects to centralize test maintenance

**Detection:**
- Tests fail after UI changes that don't affect functionality
- Frequent selector update commits in test files
- Test suite takes longer than 10 seconds per test (too brittle)

**Sources:**
- MEDIUM CONFIDENCE: Based on common integration testing patterns, requires validation for Playwright/React specifics

### Pitfall 2: CORS + Auth Token Pass-Through Failure Cascade

**What goes wrong:** CORS (Cross-Origin Resource Sharing) misconfiguration combined with incorrect authentication token passing causes complete UI/API communication failure. Symptoms include 401/403 responses, OPTIONS preflight failures, and confusing error messages.

**Why it happens:**
- FastAPI CORS misconfiguration: `allow_origins="*"` with credentials, or missing preflight handling
- React fetch API not sending credentials: missing `credentials: 'include'` or Authorization header
- Extension/content script security restrictions (if testing browser extension)
- Development/production environment mismatch

**FastAPI CORS Anti-Patterns:**

```python
# WRONG - Wildcard with credentials (forbidden by browser)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # Browser will reject this
    allow_methods=["*"],
    allow_headers=["*"],
)

# WRONG - Missing preflight methods
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Missing OPTIONS
    allow_headers=["*"],
)
```

**Correct CORS Configuration:**

```python
from fastapi.middleware.cors import CORSMiddleware

# For test environment - include all needed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # React dev server
        "http://localhost:3000",  # Alternative dev port
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Include OPTIONS, GET, POST, PUT, DELETE
    allow_headers=["*"],  # Include Authorization, Content-Type
)
```

**React Fetch/Auth Pitfalls:**

```typescript
// WRONG - Token stored, but not sent to API
const token = localStorage.getItem('api_key');
fetch('http://localhost:8000/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // Missing Authorization header!
  body: JSON.stringify({ query })
});

// WRONG - Token format incorrect
fetch('http://localhost:8000/api/search', {
  headers: {
    'Authorization': token,  // Should be: `Bearer ${token}` or `Api-Key ${token}`
  }
});

// CORRECT - Check what FastAPI expects (from FastAPI docs)
fetch('http://localhost:8000/api/search', {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Api-Key ${token}`,  // Match FastAPI security scheme
  }
});
```

**Consequences:**
- OPTIONS preflight returns 404/405 (browser blocks the request)
- POST/GET requests never reach FastAPI with authorization headers
- CORS errors in browser console mask the real auth failure
- Testing locally works but fails in CI (different origins)

**Prevention:**
1. **CORS First:** Configure CORS before writing any tests. Use explicit origins during development
2. **Auth Last:** Test authentication in isolation with FastAPI `TestClient` before Playwright
3. **Browser DevTools:** Check Network tab for OPTIONS requests and verify headers are sent
4. **Test Environment Variables:** Use `.env.test` with explicit CORS origins for test runs

**Detection:**
- Browser console: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Network tab: OPTIONS request fails with 404/405
- FastAPI logs: Shows OPTIONS was received but CORS preflight denied
- Test passes with FastAPI `TestClient` but fails in Playwright

**Sources:**
- HIGH CONFIDENCE: [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/) - Authority on FastAPI CORS configuration

### Pitfall 3: Flaky Tests Due to Race Conditions (Timing Hell)

**What goes wrong:** Tests rely on implicit timing (`page.waitForTimeout()`, thread sleeps, fixed delays) instead of explicit wait conditions. Tests pass locally (fast machine) but fail in CI (slower machine).

**Why it happens:**
- Network latency varies between localhost and CI environments
- React rendering has asynchronous phases (hydration, data loading)
- FastAPI database operations have variable execution time
- Playwright doesn't know when the UI is "ready" without explicit signals

**Common Anti-Patterns:**

```typescript
// WRONG - Magic number timeout
await page.goto('http://localhost:5173');
await page.waitForTimeout(1000);  // Will fail on slow CI
await page.click('#search-button');

// WRONG - Promise.all without proper ordering
await Promise.all([
  page.fill('#search-input', 'query'),
  page.click('#search-button'),
  page.waitForResponse('**/search')  // Might not be included in the list
]);

// WRONG - Checking existence without waiting
const button = await page.locator('#search-button');
if (await button.isVisible()) {  // Might be stale
  await button.click();
}
```

**Correct Explicit Wait Patterns:**

```typescript
// CORRECT - Wait for specific element/action
await page.goto('http://localhost:5173');
await page.waitForSelector('#search-input', { state: 'visible' });
await page.fill('#search-input', 'query');
await page.click('#search-button');

// CORRECT - Wait for API response
const responsePromise = page.waitForResponse('**/search');
await page.click('#search-button');
const response = await responsePromise;
expect(response.status()).toBe(200);

// CORRECT - Wait for UI state change
await page.click('#search-button');
await page.waitForSelector('#results-loading', { state: 'hidden' });
await page.waitForSelector('#results-container', { state: 'visible' });
expect(await page.locator('.result-item').count()).toBeGreaterThan(0);
```

**FastAPI Async Handling for Tests:**

```python
# WRONG - Sync operations in async test
def test_search_sync(client):
    response = client.post("/search", json={"query": "test"})
    assert response.status_code == 200
    # No waiting for database operations

# CORRECT - Explicit test fixtures with cleanup
@pytest_asyncio.fixture
async def test_db(async_session):
    # Set up test state
    yield async_session
    # Clean up (runs after test)
    await async_session.execute(delete(SearchResult))

@pytest.mark.asyncio
async def test_search_async(client, test_db):
    # Use test fixture, guaranteed clean state
    response = await client.post("/search", json={"query": "test"})
    assert response.status_code == 200
```

**Consequences:**
- Test suite fails randomly (10% failure rate feels like "just flakiness")
- Team ignores test failures as "false positives"
- Development slows down due to constant test reruns
- Hard to debug because failures don't reproduce locally

**Prevention:**
1. **Zero timeout() in tests:** Ban `waitForTimeout()` from test files entirely
2. **Wait for conditions:** Use `waitForSelector`, `waitForResponse`, `waitForFunction`
3. **FastAPI TestClient:** Use `TestClient` for API tests to avoid network timing
4. **Parallel testing:** Run tests with `pytest-xdist` and handle race conditions with per-test test databases
5. **Retries with limits:** Configure Playwright retries (max 3) but investigate every flaky test

**Detection:**
- Test passes on run 1, fails on run 2 without code changes
- Browser shows element exists but Playwright says it's not visible (hydration race)
- Network tab shows request sent but response not received yet when click happens
- Test logs show "Timeout after 30000ms waiting for selector"

**Sources:**
- MEDIUM CONFIDENCE: Race condition management is well-documented in testing literature. Playwright documentation provides explicit guidance [Playwright Best Practices](https://playwright.dev/docs/test-best-practices)

### Pitfall 4: Browser Security Policy Violations (Extension + Local Storage)

**What goes wrong:** Chrome extension + local HTTP server violates browser security policies, causing tests to fail or behave differently than production.

**Why it happens:**
- Chrome extension can access `chrome://` URLs but Playwright typically can't
- Local HTTP server (localhost:8000) vs localhost:5173 causes origin mismatches
- Content Security Policy (CSP) blocks inline scripts or certain headers
- Extension manifest permissions not loaded in headless Playwright mode
- `localStorage` and `sessionStorage` isolation between contexts

**Common Issues:**

```typescript
// Extension script (background/content)
// These won't work in Playwright without extension loading
chrome.storage.local.get(['api_key'], (result) => { /* ... */ });

// Playwright test (without extension context)
// localStorage is isolated per page context
await page.goto('chrome-extension://<id>/popup.html');  // FAILS in default context
```

**Prevention:**
1. **Test the web app, not the extension:** Use Playwright to test the React web UI directly (localhost:5173)
2. **Test extension separately:** If extension testing is needed, use `chromium.launchPersistentContext` with extension loaded
3. **Mock extension storage:** In Playwright tests, manually set localStorage/sessionStorage for auth tokens
4. **Environment flag:** Add `IS_EXTENSION` check in React code to handle both contexts

```typescript
// In React app - handle both extension and web testing
const apiKey = localStorage.getItem('api_key');
// Playwright tests set this directly
await page.addInitScript(() => {
  localStorage.setItem('api_key', 'test-api-key');
});
```

**Sources:**
- HIGH CONFIDENCE: Browser security policies are fundamental to Chrome extensions and well-documented in [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)

## Moderate Pitfalls

### Pitfall 1: Test Environment Data Contamination

**What goes wrong:** Tests share database or localStorage state, causing test execution order to matter. Passes when run individually, fails when run together.

**Why it happens:**
- Tests don't clean up after themselves
- Database operations aren't wrapped in transactions
- localStorage not cleared between tests
- Unique seed data conflicts between concurrent tests

**Prevention:**
```python
# pytest conftest.py - Automatic cleanup
@pytest_asyncio.fixture(autouse=True)
async def cleanup_database(async_session):
    yield
    # Clean up created records
    await async_session.execute(delete(SearchResult))
    await async_session.commit()

# Isolate test users
@pytest.fixture
def test_user_factory(async_session):
    created_users = []
    def create_user(email):
        user = User(email=email)
        async_session.add(user)
        created_users.append(user)
        return user
    yield create_user
    # Cleanup all created users
    for user in created_users:
        async_session.delete(user)
    async_session.commit()
```

**Sources:**
- HIGH CONFIDENCE: Database test isolation is a well-understood pattern in [pytest documentation](https://docs.pytest.org/)

### Pitfall 2: Hardcoded API URLs and Ports

**What goes wrong:** Tests hardcode `http://localhost:8000` which conflicts with environment variables, CI setup, or multiple services.

**Prevention:**
```typescript
// Playwright config
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:8000',
    extraHTTPHeaders: {
      'Authorization': `Api-Key ${process.env.TEST_API_KEY}`,
    }
  }
});

// .env.test
API_BASE_URL=http://localhost:8000
TEST_API_KEY=test-key-12345

// Test
test('search works', async ({ request }) => {
  // Uses baseURL from config + request context
  const response = await request.post('/search', {
    json: { query: 'test' }
  });
});
```

**Sources:**
- MEDIUM CONFIDENCE: Environment-based configuration is standard practice. Playwright configuration specifics need verification from [Playwright Configuration Documentation](https://playwright.dev/docs/test-configuration)

### Pitfall 3: Missing Error Boundary Testing

**What goes wrong:** Tests only test happy paths. When API returns 500, or network fails, or missing auth token, UI doesn't display error message properly.

**Prevention:**
```typescript
// Test error states
test('handles 401 unauthorized', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('api_key'));
  await page.goto('/');
  await page.click('#search-button');
  await expect(page.locator('.error-message')).toHaveText(
    'Authentication required'
  );
});

test('handles API 500 error', async ({ page, context }) => {
  // Mock API failure
  await context.route('**/search', route => {
    route.fulfill({ status: 500, body: '{"error": "Internal error"}' });
  });
  await page.goto('/');
  await page.fill('#search-input', 'query');
  await page.click('#search-button');
  await expect(page.locator('.error-message')).toBeVisible();
});
```

**Sources:**
- LOW CONFIDENCE: Error testing patterns are standard, but specific Playwright mocking syntax requires verification from [API Testing Documentation](https://playwright.dev/docs/api-testing)

## Minor Pitfalls

### Pitfall 1: Test Naming Clarity

**What goes wrong:** Test names like `test_search()` don't describe what scenario is being tested, making failures hard to interpret.

**Prevention:**
```typescript
// BAD
test('search', async ({ page }) => { /* ... */ });

// GOOD
test('search displays results when API returns data', async ({ page }) => { /* ... */ });
test('search shows loading state', async ({ page }) => { /* ... */ });
test('search shows error when API fails', async ({ page }) => { /* ... */ });
test('search requires authentication', async ({ page }) => { /* ... */ });
```

### Pitfall 2: Screenshot Failure Debugging

**What goes wrong:** Tests fail with no context, hard to debug in CI where you can't see the browser.

**Prevention:**
```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  }
});

// Failure automatically produces:
// - screenshot.png
// - video.webm
// - trace.zip (can be opened in trace viewer)
```

**Sources:**
- HIGH CONFIDENCE: [Playwright Debugging Documentation](https://playwright.dev/docs/debug) confirms this approach

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 12-01: Debug UI/API Connection** | Pitfall 2: CORS + Auth failures | Start with browser Network tab inspection. Use FastAPI logs to confirm request received. Test with `curl` first to isolate CORS. |
| **Phase 12-02: Add Stable Test Selectors** | Pitfall 1: Post-development test debt | Add `data-testid` attributes to React components before writing tests. Document selector conventions. |
| **Phase 12-03: Configure Test Environment** | Pitfall 2: CORS config mismatches | Create `.env.test` with explicit settings. Use `pyproject.toml` pytest configuration for test-specific behavior. |
| **Phase 12-04: Write Integration Tests** | Pitfall 3: Race conditions / flaky tests | Ban `waitForTimeout()`. Use `waitForSelector`, `waitForResponse`. Add test timeouts with reasonable limits (30s default). |
| **Phase 12-05: Debug Flaky Tests** | Pitfall 3: Timing issues in CI | Use Playwright retries (max 3). Compare local vs CI logs. Check database cleanup fixtures. |
| **Phase 12-06: Verify Complete Flow** | Pitfall 2: Full flow CORS/auth issues | Test end-to-end from API key entry to search results. Verify token storage and transmission. |

## Sources

### High Confidence
- **FastAPI CORS Documentation:** https://fastapi.tiangolo.com/tutorial/cors/ - Authority on FastAPI CORS configuration
- **FastAPI Testing Documentation:** https://fastapi.tiangolo.com/tutorial/testing/ - Standard patterns for FastAPI testing
- **Pytest Documentation:** https://docs.pytest.org/ - Comprehensive testing patterns and fixture strategies
- **Chrome Extension Security:** https://developer.chrome.com/docs/extensions/ - Fundamental browser security model
- **Playwright Debugging:** https://playwright.dev/docs/debug - Screenshot/video/trace configuration

### Medium Confidence
- **Playwright Best Practices:** https://playwright.dev/docs/test-best-practices - Patterns for explicit waits and avoiding flaky tests (requires verification of specific syntax)
- **Playwright Configuration:** https://playwright.dev/docs/test-configuration - Environment variable handling and baseURL setup
- **Playwright API Testing:** https://playwright.dev/docs/api-testing - Network mocking and intercepting requests

### Low Confidence (Requires Validation)
- **Playwright + Chrome Extension Testing:** Loading extensions in headless mode and testing content scripts (needs specific research for v1.3 if extension testing is required)
- **Playwright + FastAPI CI Setup:** How to run FastAPI server in CI before Playwright tests start (pytest-xdist? pytest-docker? [needs investigation](https://playwright.dev/docs/ci))
- **LanceDB Testing Patterns:** Testing vector search functionality without requiring a running LanceDB instance in CI (needs Phase 12-01 specific research)
- **Local Storage in Playwright:** Performance and isolation implications for auth token mocking (needs hands-on testing in v1.3)

## Additional Research Recommended for v1.3

1. **Playwright + FastAPI CI Setup:** How to run FastAPI server in CI before Playwright tests start (pytest-xdist? pytest-docker?) - Research in Phase 12-03
2. **Extension vs Web App Testing:** If testing the chrome extension is required beyond the web UI, research `chromium.launchPersistentContext` with extension loading - Phase 12-06 if needed
3. **LanceDB Testing Patterns:** Testing vector search functionality without requiring a running LanceDB instance in CI - Requires specific database research in Phase 12-01
4. **Token Storage Security:** localStorage vs sessionStorage vs http-only cookies for API key storage in test vs production - Security considerations (might be Phase 14-01 scope)

## Quick Checklist for v1.3 Phase Kickoff

Before writing tests, verify:
- [ ] FastAPI CORS middleware configured with explicit origins (not `"*"`)
- [ ] React fetch/send includes proper Authorization header format
- [ ] `data-testid` attributes added to all interactive React components
- [ ] `.env.test` file with test-specific environment variables
- [ ] FastAPI test fixtures for database cleanup
- [ ] Playwright test timeout configured (default 30s, adjust as needed)
- [ ] Screenshots/video on failure enabled in Playwright config
- [ ] Test script in `package.json` for running tests locally (`"test:e2e": "playwright test"`)
