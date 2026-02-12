# Phase 14: Core Integration Tests - Research

**Researched:** 2026-02-12
**Domain:** End-to-end integration testing with Playwright
**Confidence:** HIGH

## Summary

Phase 14 focuses on implementing critical integration tests that verify the complete workflow from UI through API to the search engine backend. The project already has robust test infrastructure from Phase 13 (Playwright setup, auth fixtures, database fixtures), making this phase primarily about composing those fixtures into meaningful end-to-end workflows.

The core testing challenge is validating a three-layer architecture: React UI (with localStorage API key) → FastAPI backend (with X-API-Key auth) → LanceDB vector database. Tests must verify both the "happy path" (authenticated search with results) and error handling (missing API key).

**Primary recommendation:** Use Playwright's APIRequestContext for backend data setup (ingest test documents), then use Page-based UI testing to validate the complete user experience. Avoid waitForTimeout entirely - use explicit wait conditions like waitForResponse, locator assertions (toBeVisible, toContainText), and Playwright's built-in auto-waiting.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 | E2E test framework | Industry standard for modern web testing, unified UI/API testing |
| TypeScript | Latest | Type-safe test code | Required by Playwright, catches errors at compile time |
| FastAPI TestClient | - | Backend testing | Already used in Phase 12 for CORS/auth tests |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| APIRequestContext | Built-in | API testing without browser | Data setup (ingest), direct endpoint validation |
| Page | Built-in | Browser-based UI testing | Full user workflow testing, visual validation |
| Locator | Built-in | Element interaction | Finding and asserting on UI elements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright | Cypress | Playwright better for API + UI, already integrated |
| APIRequestContext | Axios/Fetch | APIRequestContext shares cookies/auth with Page context |
| Manual waits | waitForTimeout | Explicit waits are more reliable and faster |

**Installation:**
```bash
# Already installed in Phase 13
# No additional dependencies needed
```

## Architecture Patterns

### Recommended Test Structure
```
tests/e2e/
├── spec/
│   ├── auth-flow.spec.ts          # INTEG-02: Missing API key error
│   ├── search-flow.spec.ts        # INTEG-01: Complete search workflow
│   └── fixtures-demo.spec.ts      # Existing fixture tests (reference)
├── fixtures/
│   ├── auth.ts                     # Existing: apiKey, authenticatedPage
│   ├── database.ts                 # Existing: testDbPath, testMessages
│   └── testData.ts                 # NEW: Fixture to ingest test documents
└── playwright.setup.ts             # Existing global setup
```

### Pattern 1: API Setup + UI Validation
**What:** Use APIRequestContext to setup test data, then use Page to test UI behavior
**When to use:** Integration tests that need real data in the database
**Example:**
```typescript
// Source: Phase 13 fixtures + Playwright docs
import { test } from '../fixtures/auth';

test('user can search and see results', async ({ page, apiKey, request, baseURL }) => {
  // 1. Setup: Ingest test document via API
  const ingestResponse = await request.post(`${baseURL}/api/v1/ingest`, {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'test-conv-1',
      platform: 'test',
      content: 'How to configure API authentication',
      role: 'user',
      timestamp: new Date().toISOString(),
    },
  });
  expect(ingestResponse.status()).toBe(201);

  // 2. Navigate to UI
  await page.goto('/');

  // 3. Enter API key (localStorage persistence)
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();

  // 4. Search for ingested content
  await page.getByPlaceholder('Search...').fill('API authentication');
  await page.getByPlaceholder('Search...').press('Enter');

  // 5. Wait for results to appear
  await expect(page.getByText('How to configure API authentication')).toBeVisible();
});
```

### Pattern 2: Error State Validation
**What:** Test that UI displays appropriate errors when API fails
**When to use:** Negative testing, error handling verification
**Example:**
```typescript
// Source: Playwright assertions docs
test('shows error when API key is missing', async ({ page }) => {
  await page.goto('/');

  // User tries to search without entering API key (should show auth prompt)
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await expect(page.getByText('Please enter your WIMS API Key')).toBeVisible();
});
```

### Pattern 3: Network Response Validation
**What:** Wait for specific API responses before asserting on UI state
**When to use:** When UI updates are triggered by API responses
**Example:**
```typescript
// Source: https://playwright.dev/docs/network
test('waits for search API response', async ({ page, apiKey }) => {
  await page.goto('/');
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();

  // Wait for the search API call to complete
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/v1/search') && response.status() === 200
  );

  await page.getByPlaceholder('Search...').fill('test query');
  await page.getByPlaceholder('Search...').press('Enter');

  const response = await responsePromise;
  const data = await response.json();

  // Validate response structure
  expect(data).toHaveProperty('groups');
  expect(data).toHaveProperty('count');

  // Validate UI reflects the data
  await expect(page.getByText('result')).toBeVisible(); // Actual result text
});
```

### Anti-Patterns to Avoid
- **Using waitForTimeout:** Never use `page.waitForTimeout()` - use explicit waits (waitForResponse, locator.waitFor(), expect assertions)
- **Not cleaning up test data:** LanceDB file locking requires worker-scoped database cleanup (already handled by database fixture)
- **Testing API directly without UI:** Integration tests should exercise the full stack, not just API endpoints (use FastAPI TestClient for unit tests)
- **Hardcoded delays:** Use Playwright's auto-waiting and retry mechanisms instead of arbitrary delays

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test data generation | Custom UUID generators, timestamp functions | Existing testMessages fixture, Date objects | Fixtures already provide consistent test data |
| API authentication | Custom header injection per test | Existing auth fixture (apiKey, authenticatedPage) | Centralized auth management, DRY principle |
| Database cleanup | Manual cleanup logic | Existing database fixture with worker scope | Prevents LanceDB file locking, automatic teardown |
| Wait conditions | setTimeout, custom polling | Playwright assertions (toBeVisible, waitForResponse) | Built-in retry logic, better error messages |

**Key insight:** Playwright provides comprehensive waiting and retry mechanisms. Custom wait logic introduces flakiness and maintenance burden. The project's Phase 13 fixtures already handle auth and database isolation - compose them rather than rebuild.

## Common Pitfalls

### Pitfall 1: APIRequestContext vs Page Routing Confusion
**What goes wrong:** Tests fail because page.route() doesn't affect APIRequestContext requests
**Why it happens:** APIRequestContext is separate from Page - they don't share interceptors
**How to avoid:** Use explicit headers in APIRequestContext, use page.route() only for Page navigation requests
**Warning signs:** Auth works in browser but fails in API calls, inconsistent header behavior

**Example from Phase 13:**
```typescript
// ❌ WRONG: page.route doesn't affect request context
await page.route('**/api/**', async (route) => {
  route.continue({ headers: { 'X-API-Key': apiKey } });
});
const response = await request.post('/search'); // Headers NOT applied

// ✅ CORRECT: Explicit headers in request
const response = await request.post('/search', {
  headers: { 'X-API-Key': apiKey },
  data: { query: 'test' }
});
```

### Pitfall 2: LanceDB File Locking in Parallel Tests
**What goes wrong:** Tests fail with "database is locked" errors
**Why it happens:** LanceDB doesn't support concurrent writes from multiple processes
**How to avoid:** Use single worker mode (workers: 1) and worker-scoped database fixture
**Warning signs:** Tests pass individually but fail when run in parallel, intermittent lock errors

**Already handled in playwright.config.ts:**
```typescript
export default defineConfig({
  workers: 1,  // Single worker prevents LanceDB conflicts
  fullyParallel: false,
});
```

### Pitfall 3: localStorage Persistence Across Tests
**What goes wrong:** API key from one test leaks into another, causing unexpected authentication
**Why it happens:** Playwright browser contexts aren't isolated by default
**How to avoid:** Clear localStorage in test setup or use fresh contexts
**Warning signs:** Tests pass when run individually but fail in suite, auth state bleeds between tests

**Solution:**
```typescript
test.beforeEach(async ({ page }) => {
  // Clear localStorage before each test
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
```

### Pitfall 4: Testing Without Real Embeddings
**What goes wrong:** Search tests fail because embedding service returns errors
**Why it happens:** Tests don't mock embedding service, real API key required
**How to avoid:** Ensure .env.test has OPENAI_API_KEY or mock the embedding service
**Warning signs:** "Embedding generation failed" errors, 500 responses from /ingest

**Current state from .env.test.example:**
```bash
# OpenAI API key (use test key or actual key if needed for embeddings)
OPENAI_API_KEY=
```

**Decision needed:** Mock embeddings or use real API key in tests

### Pitfall 5: Timing Issues with Auto-Wait Assumptions
**What goes wrong:** Tests fail because elements appear but aren't fully interactive
**Why it happens:** Assuming toBeVisible guarantees clickability (it doesn't check for disabled state)
**How to avoid:** Use toBeEnabled for buttons, or combine assertions (toBeVisible + toBeEnabled)
**Warning signs:** Elements visible but clicks don't work, tests flake on CI

**Example:**
```typescript
// ❌ WRONG: Button might be visible but disabled
await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
await page.getByRole('button', { name: 'Search' }).click(); // Might fail

// ✅ CORRECT: Check enabled state
await expect(page.getByRole('button', { name: 'Search' })).toBeEnabled();
await page.getByRole('button', { name: 'Search' }).click();
```

## Code Examples

Verified patterns from official sources:

### Complete Integration Test Flow
```typescript
// Source: Project structure + https://playwright.dev/docs/api-testing
import { test, expect } from '@playwright/test';
import { test as authTest } from '../fixtures/auth';

authTest('end-to-end search workflow', async ({ page, apiKey, request, baseURL }) => {
  // Step 1: Setup test data via API (bypasses UI for speed)
  const ingestResponse = await request.post(`${baseURL}/api/v1/ingest`, {
    headers: { 'X-API-Key': apiKey },
    data: {
      conversation_id: 'e2e-test-conv',
      platform: 'playwright-test',
      content: 'Testing search functionality with Playwright integration tests',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'E2E Test Document',
    },
  });

  expect(ingestResponse.status()).toBe(201);
  const { id } = await ingestResponse.json();

  // Step 2: Navigate to application
  await page.goto('/');

  // Step 3: Authenticate (enter API key)
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();

  // Step 4: Wait for search interface to appear
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();

  // Step 5: Perform search
  const searchInput = page.getByPlaceholder(/search/i);
  await searchInput.fill('Playwright integration');

  // Wait for search API response
  const responsePromise = page.waitForResponse(
    res => res.url().includes('/api/v1/search') && res.status() === 200
  );

  await searchInput.press('Enter');
  await responsePromise;

  // Step 6: Validate results appear
  await expect(page.getByText('Testing search functionality')).toBeVisible();
  await expect(page.getByText('E2E Test Document')).toBeVisible();

  // Step 7: Validate result metadata
  const resultCard = page.locator('article', { hasText: 'Testing search functionality' });
  await expect(resultCard).toBeVisible();
  await expect(resultCard.getByText('playwright-test')).toBeVisible(); // Platform
});
```

### Testing Error States
```typescript
// Source: https://playwright.dev/docs/test-assertions
test('displays error for missing API key', async ({ page }) => {
  await page.goto('/');

  // Should show authentication prompt
  await expect(page.getByText('Authentication Required')).toBeVisible();
  await expect(page.getByText(/enter your WIMS API Key/i)).toBeVisible();

  // Search interface should NOT be visible
  await expect(page.getByPlaceholder(/search/i)).not.toBeVisible();
});

test('displays error for invalid API key', async ({ page }) => {
  await page.goto('/');

  // Enter invalid API key
  await page.getByLabel('API Key').fill('invalid-key-xyz');
  await page.getByRole('button', { name: 'Connect' }).click();

  // Should attempt search and fail
  const searchInput = page.getByPlaceholder(/search/i);
  await searchInput.fill('test query');

  // Wait for API error response
  const errorResponse = page.waitForResponse(
    res => res.url().includes('/api/v1/search') && res.status() === 403
  );

  await searchInput.press('Enter');
  await errorResponse;

  // Should show error message and redirect to auth
  await expect(page.getByText(/authentication required/i)).toBeVisible({ timeout: 5000 });
});
```

### Combining Multiple Fixtures
```typescript
// Source: https://playwright.dev/docs/test-fixtures
import { test as base } from '@playwright/test';
import { test as authTest } from '../fixtures/auth';
import { test as dbTest } from '../fixtures/database';

// Merge fixtures
const test = base.extend({
  ...authTest,
  ...dbTest,
});

test('searches with pre-loaded database', async ({
  page,
  apiKey,
  testMessages,
  request,
  baseURL
}) => {
  // testMessages already exist (from database fixture)
  // Ingest them into the test database
  for (const msg of testMessages) {
    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: msg.conversation_id,
        platform: 'test',
        content: msg.message,
        role: msg.role,
        timestamp: new Date(msg.timestamp).toISOString(),
      },
    });
  }

  // Now test search with real data
  await page.goto('/');
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();

  await page.getByPlaceholder(/search/i).fill('API documentation');
  await page.getByPlaceholder(/search/i).press('Enter');

  // Should find the test message about API docs
  await expect(page.getByText(/API documentation at \/docs/i)).toBeVisible();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| waitForTimeout | Explicit waits (waitForResponse, assertions) | Playwright 1.0+ | Faster, more reliable tests |
| Selenium WebDriver | Playwright | 2020-2023 migration | Better auto-wait, API testing support |
| Separate API testing tools | Unified Playwright | 2021+ | Single framework for UI + API |
| page.waitFor() | expect().toBeVisible() | Playwright 1.19+ | Web-first assertions with retry |
| Manual fixture management | test.extend() pattern | Playwright 1.10+ | Better composition, type safety |

**Deprecated/outdated:**
- `page.waitForTimeout()`: Officially discouraged, use explicit conditions
- `page.waitFor()`: Removed in Playwright 1.19, replaced by locator assertions
- `page.$()` selectors: Legacy, use `page.locator()` or `page.getByRole()`
- Separate request library (axios): Use built-in `request` fixture for API testing

## Open Questions

1. **Embedding Service Mocking**
   - What we know: Real embeddings require OPENAI_API_KEY in .env.test
   - What's unclear: Should tests use real embeddings or mock the service?
   - Recommendation: Start with real embeddings (simpler, validates full stack), add mocking only if tests are too slow or API costs are prohibitive

2. **Test Data Volume**
   - What we know: testMessages fixture has 4 sample messages
   - What's unclear: Is this enough to test search relevance and ranking?
   - Recommendation: Start with 4 messages (validates basic flow), add more if testing edge cases (pagination, large result sets)

3. **UI Component Selectors**
   - What we know: Current UI uses generic placeholders and text selectors
   - What's unclear: Should we add test-id attributes for more stable selectors?
   - Recommendation: Use getByRole and getByText for now (semantic), add data-testid only if selectors become brittle

4. **Cross-Browser Testing**
   - What we know: playwright.config.ts only tests chromium project
   - What's unclear: Do we need firefox/webkit coverage for integration tests?
   - Recommendation: Chromium-only for Phase 14 (faster feedback), add browsers in later phases if needed

## Sources

### Primary (HIGH confidence)
- [Playwright API Testing Documentation](https://playwright.dev/docs/api-testing) - Official guide for APIRequestContext
- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures) - Official fixture patterns and composition
- [Playwright Locator Assertions](https://playwright.dev/docs/api/class-locatorassertions) - toBeVisible, toContainText, etc.
- [Playwright Authentication](https://playwright.dev/docs/auth) - Auth patterns and state management
- [Playwright Network](https://playwright.dev/docs/network) - waitForResponse, waitForRequest patterns
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) - Official testing guidelines
- Project codebase:
  - `playwright.config.ts` - Existing configuration
  - `tests/e2e/fixtures/auth.ts` - Auth fixture implementation
  - `tests/e2e/fixtures/database.ts` - Database fixture implementation
  - `tests/e2e/spec/fixtures-demo.spec.ts` - Working fixture examples
  - `src/app/api/v1/endpoints/search.py` - Search endpoint schema
  - `ui/src/App.tsx` - UI components and behavior

### Secondary (MEDIUM confidence)
- [BrowserStack Playwright API Testing Guide 2026](https://www.browserstack.com/guide/playwright-api-test) - Best practices for 2026
- [BrowserStack Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) - Updated testing patterns
- [BrowserStack Playwright Fixtures Guide 2026](https://www.browserstack.com/guide/fixtures-in-playwright) - Fixture patterns and examples
- [Understanding Playwright waitForResponse 2026](https://www.browserstack.com/guide/playwright-waitforresponse) - Network waiting patterns
- [Why You Shouldn't Use waitForTimeout](https://www.browserstack.com/guide/playwright-waitfortimeout) - Explicit wait recommendations
- [Playwright Solutions: Headers and Authentication](https://playwrightsolutions.com/the-definitive-guide-to-api-test-automation-with-playwright-part-4-handling-headers-and-authentication/) - Detailed auth guide
- [Checkly: Playwright Waits and Timeouts](https://www.checklyhq.com/docs/learn/playwright/waits-and-timeouts/) - Wait strategy guide
- [ReqRes: API Testing with Playwright](https://reqres.in/blog/api-testing-with-playwright) - Real vs mock endpoints
- [FullStack Open: Playwright E2E Testing](https://fullstackopen.com/en/part5/end_to_end_testing_playwright/) - React + backend testing

### Tertiary (LOW confidence)
- None - all findings verified with official documentation or current project code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright 1.58.2 already installed, fixtures exist, documented patterns
- Architecture: HIGH - Existing fixtures demonstrate patterns, official Playwright docs comprehensive
- Pitfalls: HIGH - Verified from Phase 13 learnings (APIRequestContext headers, LanceDB locking) and official docs

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - Playwright is stable, patterns unlikely to change)

**Key Insights for Planning:**
1. Phase 13 fixtures are production-ready - focus on composing them, not rebuilding
2. Integration tests should test UI + API together, not just API endpoints (use FastAPI TestClient for API unit tests)
3. waitForTimeout is forbidden - use explicit waits (waitForResponse, locator assertions)
4. Real embeddings vs mocking is an open decision - recommend starting with real embeddings for simplicity
5. LanceDB single-worker constraint already handled - no additional concerns for test parallelization
