# Architecture: UI/API Integration Testing for FastAPI + React

**Project:** Where Is My Shit (WIMS) v1.3
**Domain:** Local-first personal search with API Key authentication
**Researched:** 2026-02-12
**Focus:** Integration test architecture (Playwright + FastAPI + React)

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Test Execution Flow                              │
│                                                                         │
│  ┌────────────────┐    ┌────────────────┐    ┌──────────────────────┐  │
│  │   Playwright   │ →  │   FastAPI      │ →  │   Test Database      │  │
│  │   Test Runner  │    │   Test Server  │    │   (LanceDB isolated) │  │
│  │                │    │   (webServer)  │    │                      │  │
│  └────────┬───────┘    └────────────────┘    └──────────────────────┘  │
│           │                                                               │
│           │ requests/assertions                                          │
│           ↓                                                               │
│  ┌────────────────┐    ┌────────────────┐                               │
│  │   React App    │ ←  │   API Tests    │    Browser automation         │
│  │   (Static)     │    │   (request)    │    + HTTP API validation      │
│  └────────────────┘    └────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Playwright Test Runner** | Orchestrates test lifecycle, starts servers, runs assertions | FastAPI Test Server, React App, Test Database |
| **FastAPI Test Server** | Serves API endpoints, accepts test requests | Playwright Test Runner, Test Database |
| **Test Database** | Stores test conversation data, provides predictable responses | FastAPI Test Server, Test Fixtures |
| **React App** | Static UI build served under `/`, renders search interface | Playwright Test Runner (for UI tests only) |
| **Test Fixtures** | Seed test data, provide known sample data for assertions | Test Database, Test Files |

### Data Flow

```
Test Fixtures → Test Database → FastAPI API → React UI → Playwright Assertions
                 (seed              (endpoint         (render           (verify
                  known data)         serves webapp)    results)           behavior)
```

**Flow Steps:**

1. **Setup Phase** (`beforeAll` hook):
   - Playwright starts FastAPI server via `webServer` config
   - Fixtures seed test database with known conversation data
   - Health check verifies backend is ready

2. **Test Execution**:
   - API Tests: Playwright uses `request` context directly against API endpoints
   - UI Tests: Playwright launches browser, loads React app, triggers user interactions
   - Backend processes requests against test database, returns JSON responses

3. **Assertion Phase**:
   - API Tests: Validate response structure, status codes, data types
   - UI Tests: Validate DOM elements render correctly, display API data

4. **Teardown Phase** (`afterAll` hook):
   - Test database cleaned up (or entire test DB deleted)
   - FastAPI server process terminated gracefully by Playwright

## Test Directory Location

### Recommended Structure

```
where-is-my-shit/
├── src/                          # Backend Python source
│   ├── app/
│   │   ├── api/
│   │   ├── db/
│   │   └── main.py
│   ├── static/                   # Built React app (dev: served by Vite)
│   │   ├── index.html
│   │   └── assets/
│   └── tests/                    # Backend unit tests (existing)
│       ├── test_api_endpoints.py
│       └── conftest.py
│
├── ui/                           # Frontend React source
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── playwright.config.ts      # NEW: Playwright configuration
│   ├── playwright/               # NEW: Playwright integration tests
│   │   ├── fixtures/             # Test data fixtures
│   │   │   ├── conversations.json
│   │   │   └── queries.json
│   │   ├── setup/                # Test setup utilities
│   │   │   ├── database.ts       # Database seeding/cleanup
│   │   │   └── server.ts         # Server utilities (health checks)
│   │   ├── api/                  # API integration tests
│   │   │   ├── search.spec.ts    # Basic search functionality
│   │   │   ├── auth.spec.ts      # API key authentication
│   │   │   ├── errors.spec.ts    # Error handling
│   │   │   └── cors.spec.ts      # CORS validation
│   │   ├── ui/                   # UI integration tests
│   │   │   ├── search-render.spec.ts    # UI renders results
│   │   │   └── error-display.spec.ts    # Error message display
│   │   └── auth/                 # Authentication tests
│   │       └── api-key.spec.ts   # API key validation
│   └── playwright-report/        # Generated test reports
└── wims-watcher/                 # Chrome extension (separate concern)
```

### Rationale for `ui/playwright/` Location

**Why NOT in `src/tests/integration/`:**
1. TypeScript tests belong in the `ui/` directory with other frontend code
2. Playwright is a frontend testing tool, naturally grouped with frontend source
3. Keeps PHP-style "tests at project root" separation for backend (Pytest) vs frontend (Playwright)
4. Package.json scripts (`npm run test:integration`) are cleaner when tests live in `ui/`

**Why NOT in `ui/src/tests/`:**
1. Vite already transpiles `ui/src/` for production builds
2. Playwright tests should be compiled separately, not part of production bundles
3. Clear separation: `src/` = production code, `playwright/` = test-only code

**Why NOT in top-level `tests/integration/`:**
1. Confusing for developers expecting backend tests in `tests/`
2. TypeScript compilation paths become complex (`../ui/node_modules` resolution)
3. No clear way to run `npm run test:integration` from project root

## Playwright Configuration (Backend Startup)

### Recommended `webServer` Configuration

**Location:** `ui/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',

  // Shared base URL for all tests - enables relative paths like '/'
  use: {
    baseURL: 'http://localhost:8000',
    // Enable screenshot/video recording for failed tests
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // FastAPI test server startup
  webServer: {
    command: 'uv run uvicorn src.app.main:app --host 127.0.0.1 --port 8000',
    url: 'http://localhost:8000/health',  // Health check endpoint
    timeout: 30000,  // 30 seconds max startup time
    reuseExistingServer: !process.env.CI,  // Local: reuse existing server, CI: start fresh
    stdout: 'pipe',  // Capture stdout for debugging
    stderr: 'pipe',  // Capture stderr for debugging
    env: {
      // Use isolated test database path
      WIMS_DB_PATH: '.tmp/test_db',
      // Use test-specific API key (known value for tests)
      WIMS_API_KEY: 'test-api-key-for-integration-tests',
      PLAYWRIGHT_TEST: '1',  // Signal to FastAPI that we're in test mode
    },
    cwd: '..',  // Start from project root (where uvicorn finds src/)
  },

  // Worker isolation (each test file runs in separate process)
  fullyParallel: false,  // Sequential tests avoid race conditions
  workers: 1,  // Single worker ensures database isolation

  // Configure browsers for testing
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

**Key Configuration Decisions:**

1. **`webServer.command`**: Uses `uv run uvicorn` for startup
   - `uv run` ensures same Python environment as development
   - `src.app.main:app` points to FastAPI app module

2. **`webServer.url`**: Uses health check endpoint for startup detection
   - Backend MUST have `/health` endpoint returning 200-399 status
   - Playwright waits for this URL to respond before running tests

3. **`webServer.env`**: Passes test-specific environment variables
   - Isolated database path prevents data pollution
   - Test API key known by test suite for authentication
   - `PLAYWRIGHT_TEST` flag allows backend to modify behavior for tests (e.g., disable analytics)

4. **`webServer.reuseExistingServer: !process.env.CI`**:
   - Local development: Don't restart server if already running (faster iterations)
   - CI environment: Always start fresh server (clean state)

5. **`fullyParallel: false` + `workers: 1`**:
   - Sequential test execution prevents race conditions
   - LanceDB file-based locks don't support concurrent write well
   - Trade-off: Slower tests, but guaranteed isolation

### Backend Health Check (Required Addition)

**Purpose:** Provide Playwright with a reliable endpoint for server startup detection

**Implementation:** `src/app/api/v1/endpoints/health.py` (if not exists)

```python
from fastapi import APIRouter

health_router = APIRouter()

@health_router.get("/health")
async def health_check():
    """Health check endpoint for test orchestration."""
    return {"status": "ok", "message": "WIMS is running"}
```

**Router Integration:** Updates `src/app/api/v1/router.py`:

```python
from src.app.api.v1.endpoints import health

# Add health router (may already exist)
api_router.include_router(health.health_router, tags=["health"])
```

## Fixture Organization

### Custom Fixtures Architecture

**Base Test Object:** `ui/playwright/fixtures/custom-test.ts`

```typescript
import { test as base } from '@playwright/test';

// Define fixture types
type TestFixtures = {
  authenticatedRequest: { get: (url: string) => Promise<Response> };
  testDatabase: {
    seedConversations: (data: Conversation[]) => Promise<void>;
    clearConversations: () => Promise<void>;
  };
};

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
  // Fixture 1: Pre-authenticated request context
  authenticatedRequest: async ({ request }, use) => {
    // Clone request context and add API key header
    const authRequest = request.newContext({
      extraHTTPHeaders: {
        'X-API-Key': process.env.WIMS_API_KEY || 'test-api-key-for-integration-tests',
      },
    });
    await use({ get: (url) => authRequest.get(url) });
    await authRequest.dispose();
  },

  // Fixture 2: Database seeding utilities
  testDatabase: async ({ request }, use) => {
    const db = {
      async seedConversations(data: Conversation[]) {
        await request.post('/api/v1/ingest/batch', {
          data: { conversations: data },
          headers: {
            'X-API-Key': process.env.WIMS_API_KEY || 'test-api-key-for-integration-tests',
          },
        });
      },
      async clearConversations() {
        await request.delete('/api/v1/test/cleanup', {
          headers: {
            'X-API-Key': process.env.WIMS_API_KEY || 'test-api-key-for-integration-tests',
          },
        });
      },
    };
    await use(db);
  },
});

// Export test expectations
export const expect = test.expect;
```

### Test Data File Placement

**Fixtures Directory:** `ui/playwright/fixtures/`

```
fixtures/
├── conversations.json       # Sample conversation data for seeding
│   [
│     {
│       "id": "fixture-1",
│       "content": "How do I change my password?",
│       "source": "web",
│       "timestamp": "2026-01-15T10:00:00Z",
│       "metadata": {"url": "https://example.com", "title": "Help article"}
│     },
│     {
│       "id": "fixture-2",
│       "content": "What is the refund policy?",
│       "source": "web",
│       "timestamp": "2026-01-20T14:30:00Z",
│       "metadata": {"url": "https://example.com", "title": "FAQ"}
│     }
│   ]
├── queries.json             # Known queries with expected results
│   {
│     "exactMatch": {
│       "query": "change my password",
│       "expectedResults": ["fixture-1"],
│       "expectedMinScore": 0.9
│     },
│     "partialMatch": {
│       "query": "password",
│       "expectedResults": ["fixture-1"],
│       "expectedMinScore": 0.7
│     },
│     "noResults": {
│       "query": "quantum physics",
│       "expectedResults": [],
│       "expectedMinScore": 0
│     }
│   }
└── auth.json                # Test authentication scenarios
    {
      "validKey": "test-api-key-for-integration-tests",
      "invalidKey": "invalid-key-should-fail",
      "missingKey": ""
    }
```

**Why JSON Files (Not TypeScript or Python):**
- Platform-agnostic, can be loaded by both frontend test fixtures and backend test scripts
- Easy to edit for test data changes without rebuilding
- Git-friendly (diff-friendly, merge-friendly)
- Can be consumed by multiple test suites (Playwright + future backend integration tests)

## Server Lifecycle Management

### Startup Sequence (Playwright Orchestrates)

```
1. Playwright executes test suite
   ↓
2. webServer startup checks reuseExistingServer
   ├─ Local (server running): Attach to existing, skip startup
   └─ CI (no server): Execute command to start new server
   ↓
3. Playwright runs uvicorn with test env vars
   ↓
4. FastAPI app initializes:
   a. Loads config (WIMS_DB_PATH, WIMS_API_KEY, etc.)
   b. Connects to test database (.tmp/test_db)
   c. Registers API routes (/health, /api/v1/*)
   d. Starts listening on localhost:8000
   ↓
5. Playwright polls /health endpoint
   ↓
6. /health returns 200 OK
   ↓
7. Playwright marks server as ready
   ↓
8. Tests execute (API + UI)
```

### Teardown Sequence

```
1. All tests complete
   ↓
2. Playwright triggers afterAll hooks
   ↓
3. Test fixtures clean up database
   ↓
4. Process cleanup begins:
   ├─ Graceful shutdown: Send SIGTERM to uvicorn process
   ├─ + configurable timeout (gracefulShutdown: { signal: 'SIGTERM', timeout: 500 })
   ├─ If timeout exceeded: Send SIGKILL to force terminate
   └─ On Windows: Always SIGKILL (Windows ignores SIGTERM)
   ↓
5. Server process terminated
   ↓
6. Test suite completes
```

### Multiple Server Support (Future-Proof)

**If Dev Server + API Server Are Separate:**

```typescript
webServer: [
  // API server
  {
    command: 'uv run uvicorn src.app.main:app --host 127.0.0.1 --port 8000',
    url: 'http://localhost:8000/health',
    name: 'api',
  },
  // Vite dev server (if testing hot-reload)
  {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173/',
    name: 'vite',
    reuseExistingServer: !process.env.CI,
  },
],
```

**For v1.3:** Single server (FastAPI serves static React build) is sufficient - Vite dev server not needed.

## Patterns to Follow

### Pattern 1: API Request Context with Authentication

**When:** Tests need authenticated API access

**Pattern:** Use `authenticatedRequest` custom fixture

```typescript
import { test, expect } from '../fixtures/custom-test';

test('authenticated search request returns results', async ({ authenticatedRequest, testDatabase }) => {
  // Seed test data
  await testDatabase.seedConversations([
    { id: 'test-1', content: 'password reset help', source: 'web' }
  ]);

  // Make authenticated request
  const response = await authenticatedRequest.get('/api/v1/search?q=password');

  // Assertions
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.results).toHaveLength(1);
  expect(data.results[0].content).toContain('password');
});
```

**Why:** Centralizes auth logic, reduces repetitive header cloning

### Pattern 2: Database Seeding in beforeAll

**When:** Multiple tests need same base data

**Pattern:** Use worker-scoped `beforeAll` hook

```typescript
import { test, expect } from '@playwright/test';

test.describe('Search Feature', () => {
  test.beforeAll(async ({ request }) => {
    // Seed once for all tests in this describe block
    await request.post('/api/v1/test/seed', {
      data: fixtures.conversations,
      headers: { 'X-API-Key': process.env.WIMS_API_KEY },
    });
  });

  test.afterAll(async ({ request }) => {
    // Cleanup once after all tests
    await request.delete('/api/v1/test/cleanup');
  });

  test('search finds exact match', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Search"]', 'password');
    await page.click('button[type="search"]');
    await expect(page.getByText('password reset help')).toBeVisible();
  });
});
```

**Why:** Avoids redundant setup, ensures consistent starting state

### Pattern 3: API Response Schema Validation

**When:** Need to verify API contract

**Pattern:** Use TypeScript interfaces + assertions

```typescript
interface SearchResponse {
  results: Array<{
    id: string;
    content: string;
    score: number;
    timestamp: string;
    source: string;
  }>;
  total: number;
  query: string;
}

test('search response matches expected schema', async ({ authenticatedRequest }) => {
  const response = await authenticatedRequest.get('/api/v1/search?q=test');
  const data: SearchResponse = await response.json();

  // Validate structure
  expect(data).toHaveProperty('results');
  expect(Array.isArray(data.results)).toBeTruthy();
  expect(data).toHaveProperty('total');
  expect(data).toHaveProperty('query');

  // Validate nested objects
  if (data.results.length > 0) {
    const firstResult = data.results[0];
    expect(typeof firstResult.id).toBe('string');
    expect(typeof firstResult.content).toBe('string');
    expect(typeof firstResult.score).toBe('number');
    expect(firstResult.score).toBeGreaterThanOrEqual(0);
    expect(firstResult.score).toBeLessThanOrEqual(1);
  }
});
```

**Why:** Type safety, catches breaking API changes early

### Pattern 4: UI Locator Strategies

**When:** Testing React component rendering

**Pattern:** Use semantic locators (role, label) over CSS selectors

```typescript
test('search results display correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search query').fill('password');
  await page.getByRole('button', { name: 'Search' }).click();

  // Wait for results (Playwright auto-waits for element visibility)
  const results = page.getByRole('listitem');

  // Use semantic assertions
  await expect(results.first()).toContainText('password');
  await expect(results.first()).toBeVisible();

  // Validate metadata
  const resultMetadata = results.first().getByTestId('result-source');
  await expect(resultMetadata).toHaveText('web');
});
```

**Why:** Resilient to CSS changes, accessible-first approach

## Anti-Patterns to Avoid

### Anti-Pattern 1: Hardcoded Timeouts

**What:** `await page.waitForTimeout(3000);`

**Why bad:** Flaky tests, waste CI time, maskrace conditions

**Instead:** Use Playwright auto-waiting

```typescript
// BAD: Arbitrary wait
await page.waitForTimeout(3000);
const result = page.locator('.result');

// GOOD: Wait for element to be visible
await expect(page.locator('.result')).toBeVisible();
```

### Anti-Pattern 2: Direct Database Access in Frontend Tests

**What:** Writing SQL or LanceDB commands directly in Playwright tests

**Why bad:** Bypasses API, tests wrong layer, couples frontend to backend internals

**Instead:** Seed via API endpoints

```typescript
// BAD: Direct database access
import lancedb from 'lancedb';
const db = lancedb.connect('.tmp/test_db');
const table = db.open_table('messages');
await table.add([...]);  // Coupled to LanceDB schema

// GOOD: Seed via API
await request.post('/api/v1/ingest/batch', {
  data: { conversations: [...] }
});
```

### Anti-Pattern 3: Reusing Production Database

**What:** Pointing tests at `wims.db` (production database path)

**Why bad:** Data pollution, non-repeatable tests, irreversible changes

**Instead:** Isolated test database

```typescript
// BAD: Production database
webServer: {
  env: { WIMS_DB_PATH: 'wims.db' }  // Destructive!
}

// GOOD: Isolated test database
webServer: {
  env: { WIMS_DB_PATH: '.tmp/test_db' }  // Disposable!
}
```

### Anti-Pattern 4: Over-MockedResponses

**What:** Mocking every API response in Playwright

```typescript
// BAD: Mocking backend responses
await page.route('/api/v1/search*', route => route.fulfill({
  status: 200,
  body: JSON.stringify({ results: [mockData] })
}));
```

**Why bad:** Tests pass even if backend is broken, defeats purpose of integration testing

**Instead:** Test against real FastAPI server (configured via `webServer`)

### Anti-Pattern 5: Monolithic Test Files

**What:** 500-line `integration.spec.ts` testing auth, search, errors, everything

**Why bad:** Hard to debug, slow feedback, violates single responsibility

**Instead:** Split by feature

```
playwright/
├── auth/api-key.spec.ts        # 50 lines, auth only
├── api/search.spec.ts          # 100 lines, search API
├── ui/search-render.spec.ts    # 80 lines, UI rendering
└── errors/spec.ts              # 150 lines, error scenarios
```

## Scalability Considerations

| Concern | Current Approach (v1.3) | At 100 Tests | At 1000 Tests |
|---------|-------------------------|--------------|---------------|
| **Test Execution Time** | Sequential (1 worker) | ~10-20 sec | ~2-5 min |
| **Backend Startup** | Per test suite | Fast (reuse) | May need parallel workers |
| **Database Isolation** | Single test DB | Sufficient | May need per-worker DBs |
| **Flakiness Rate** | Low (1 worker) | Low | Higher (race conditions) |
| **Debuggability** | High (sequential) | High | Medium (parallel logs) |

### Horizontal Scaling (Future v2.0)

**Problem:** `workers: 1` becomes bottleneck at high test count

**Solution:** Database-per-worker isolation

```typescript
// playwright.config.ts
export default defineConfig({
  // In v2.0, enable parallel workers
  fullyParallel: true,
  workers: process.env.CI ? 4 : 2,  // 4 workers in CI, 2 local

  webServer: {
    // Generate unique DB path per worker
    env: {
      WIMS_DB_PATH: `.tmp/test_db_${process.env.TEST_WORKER_ID}`,
    },
  },
});
```

**Trade-offs:**
- **Pros:** 4-8x faster test execution
- **Cons:** 4-8x more disk usage, complex cleanup logic

## Integration Points Summary

### New Components (v1.3)

| Component | Location | Purpose | Dependencies |
|-----------|----------|---------|--------------|
| **playwright.config.ts** | `ui/` | Test runner configuration | None (native) |
| **custom-test.ts** | `ui/playwright/fixtures/` | Custom fixtures (auth, DB) | @playwright/test |
| **database.ts** | `ui/playwright/setup/` | Seeding/cleanup utilities | httpx (via FastAPI) |
| **server.ts** | `ui/playwright/setup/` | Health check utilities | None |
| **conversations.json** | `ui/playwright/fixtures/` | Test data samples | None |
| **queries.json** | `ui/playwright/fixtures/` | Expected query results | None |
| **health check endpoint** | `src/app/api/v1/endpoints/health.py` | Server readiness probe | FastAPI |

### Modified Components

| Component | Modification Required | Why |
|-----------|----------------------|-----|
| **FastAPI app** | Add `/health` endpoint if not exists | Playwright startup detection |
| **API router** | Include health router if not exists | Expose health check |
| **Environment config** | Support `WIMS_DB_PATH`, `PLAYWRIGHT_TEST` env vars | Test mode detection |

### Build Order for v1.3

1. **Add test infrastructure** (no code changes yet):
   - Create `ui/playwright.config.ts`
   - Install `@playwright/test`: `npm install -D @playwright/test`
   - Create directory structure under `ui/playwright/`

2. **Add health check endpoint**:
   - Implement `/health` endpoint (if missing)
   - Verify returns 200 OK: `curl http://localhost:8000/health`

3. **Create test fixtures**:
   - Create `ui/playwright/fixtures/conversations.json`
   - Create `ui/playwright/setup/database.ts` (if seeding via API needed)

4. **Configure server startup**:
   - Configure `webServer` command in `playwright.config.ts`
   - Test server starts manually: `uv run uvicorn src.app.main:app`

5. **Write first integration test**:
   - Create `ui/playwright/api/search.spec.ts`
   - Test basic search with known query
   - Run: `npm run test:integration`

6. **Add more scenarios**:
   - Auth tests (`api-key.spec.ts`)
   - Error tests (`errors.spec.ts`)
   - UI tests (`search-render.spec.ts`)

## Sources

**Primary (HIGH confidence):**
- [Playwright webServer Documentation](https://playwright.dev/docs/test-webserver) - HIGH confidence (official docs, verified 2025)
- [Playwright Test Fixtures Guide](https://playwright.dev/docs/test-fixtures) - HIGH confidence (official docs, verified 2025)
- [Playwright API Testing Documentation](https://playwright.dev/docs/api-testing) - HIGH confidence (official docs, verified 2025)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) - HIGH confidence (official docs, verified 2025)

**Secondary (MEDIUM confidence):**
- [FastAPI Testing Documentation](https://fastapi.tiangolo.com/tutorial/testing/) - MEDIUM confidence (official FastAPI docs)
- [Integration Testing Patterns](https://martinfowler.com/bliki/IntegrationTest.html) - MEDIUM confidence (architecture patterns)

**Project Context:**
- Existing project structure analysis (`src/`, `ui/`, `tests/`)
- Current test setup (Pytest for backend, Vitest for frontend)
- LanceDB file-based database behavior
- FastAPI module structure (`src/app/main.py`)

**Confidence Assessment:**
- Test directory location: HIGH - follows established frontend test conventions
- Backend startup orchestration: HIGH - Playwright webServer is well-documented
- Fixture organization: HIGH - custom fixtures pattern is standard practice
- Test data placement: HIGH - JSON fixtures widely used in industry
- Dev server lifecycle: HIGH - Playwright handles process lifecycle automatically

**Overall confidence:** HIGH
