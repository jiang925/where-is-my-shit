# Phase 13: Test Infrastructure Setup - Research

**Researched:** 2026-02-12
**Domain:** Playwright E2E testing with FastAPI backend
**Confidence:** HIGH

## Summary

This phase establishes a foundational testing framework for automated verification of the WIMS platform functionality. The primary challenge is integrating Playwright with a FastAPI backend to create end-to-end integration tests that launch the server automatically, manage test data with cleanup, and operate in an isolated test environment.

**Primary recommendation:** Use Playwright's `webServer` configuration to auto-launch FastAPI, custom fixtures for database setup/teardown, and a dedicated `.env.test` file for test-specific configuration. This approach follows Playwright's official patterns and provides clean separation between development and testing concerns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | 1.58.2 | E2E testing framework | Industry standard for browser automation, official support for webServer |
| `playwright` | 1.58.2 | Browser automation engine | Same version as test runner, official support |
| `pytest-playwright` | Latest | Python/Playwright bridge | Official pytest integration for existing Python test infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pytest-asyncio` | 0.23.0 | Async test support | Already in project for FastAPI async testing |
| `httpx` | 0.26.0 | HTTP client for backend API tests | Already in project, used for direct API testing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| webServer (Playwright native) | beforeEach hook with Python subprocess | webServer is official, has health checks, reuses existing server |
| TypeScript fixtures | Python-only fixtures | TypeScript fixtures integrate better with Playwright's page/context model |
| .env.test | pytest fixtures with monkeypatch | .env.test is cleaner for config separation, follows 12-factor app pattern |

**Installation:**
```bash
# npm packages (in project root or ui directory)
npm install -D @playwright/test@1.58.2 playwright@1.58.2

# Python packages (already present)
pip install pytest-playwright pytest pytest-asyncio httpx
```

## Architecture Patterns

### Recommended Project Structure
```
where-is-my-shit/
├── playwright.config.ts          # Playwright configuration with webServer
├── playwright.setup.ts           # Shared test fixtures and utilities
├── tests/
│   ├── e2e/                      # End-to-end Playwright tests
│   │   ├── fixtures/             # Custom fixtures for DB/API setup
│   │   ├── pages/                # Page object models
│   │   └── spec/                 # Test specs
│   ├── conftest.py               # pytest fixtures (existing)
│   └── .env.test                 # Test-specific environment config
├── src/
│   └── app/                      # FastAPI backend
└── ui/                           # React frontend
```

### Pattern 1: Playwright webServer Configuration
**What:** Automatic server launch before tests run
**When to use:** E2E tests need a running backend server
**Example:**
```typescript
// Source: https://playwright.dev/docs/test-webserver
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Launch FastAPI server before tests
  webServer: {
    command: 'uv run uvicorn src.app.main:app --host 127.0.0.1 --port 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  use: {
    baseURL: 'http://localhost:8000',
  },
});
```

**Key options for FastAPI:**
- `command`: Shell command to start Python server
- `url`: health check URL (should return 2xx, 3xx, 4xx, or 5xx)
- `reuseExistingServer`: Allow manual server during development
- `timeout`: Max wait for server startup (default 60s)
- `env`: Environment variables for the subprocess

### Pattern 2: Database Fixtures with Setup/Teardown
**What:** Async fixtures for database seeding and cleanup
**When to use:** Tests need controlled data setup
**Example:**
```typescript
// Source: https://playwright.dev/docs/test-fixtures
import { test as base } from '@playwright/test';

type TestFixtures = {
  authenticatedPage: Page;
  testData: { apiKey: string; userId: string };
};

export const test = base.extend<TestFixtures>({
  // API key from test environment
  testData: async ({}, use) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    const userId = 'test-user-001';
    await use({ apiKey, userId });
  },

  // Page with auth headers pre-configured
  authenticatedPage: async ({ page, testData }, use) => {
    // Setup: Configure request interceptor for auth
    await page.route('**/api/**', async (route) => {
      const headers = {
        ...route.request().headers(),
        'X-API-Key': testData.apiKey,
      };
      route.continue({ headers });
    });

    await use(page);

    // Teardown: Cleanup any created data
    // Implementation depends on data cleanup strategy
  },
});
```

### Pattern 3: Worker-Scoped Fixtures for Shared Database
**What:** Database setup shared across tests in a worker (isolated per worker)
**When to use:** Multiple tests need the same database instance
**Example:**
```typescript
import { test as base } from '@playwright/test';

export const test = base.extend<{ testDbPath: string }, { testDbPath: string }>({
  testDbPath: [async ({}, use) => {
    // Setup: Create temp database file
    const path = `/tmp/wims-test-${Date.now()}.lance`;
    await use(path);
    // Teardown: Cleanup database file
    await fs.unlink(path).catch(() => {});
  }, { scope: 'worker' }],
});
```

### Anti-Patterns to Avoid
- **Hard-coding server URLs**: Always use `baseURL` from config, never hardcode `http://localhost:8000` in tests
- **Manual server management in tests**: Never start/stop server in `beforeEach` - use `webServer` instead
- **Shared mutable state between tests**: Each test should be independent - use fixtures, not global variables
- **Missing cleanup**: Always implement teardown in fixtures - incomplete cleanup flakes tests
- **Mixing TestClient and Playwright**: Don't use FastAPI's `TestClient` in E2E tests - use real HTTP or APIRequestContext

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server auto-start | Subprocess management with health checks | Playwright `webServer` | built-in health checks, reuses existing server, handles timeouts |
| Test database isolation | Custom temp directories and cleanup | Worker-scoped fixtures | official pattern, clean separation, automatic teardown |
| Auth headers per request | Manually adding headers to each fetch | Page route interception with `page.route()` | one-time setup, applies to all requests, less code |
| Test config management | Custom config loaders | `.env.test` with `process.env` | standard pattern, works with all tools, easier to debug |

**Key insight:** Playwright's built-in patterns (webServer, fixtures) are mature solutions to common problems. Custom implementations reinvent these wheels and typically miss edge cases like signal handling, health check failures, or concurrent test management.

## Common Pitfalls

### Pitfall 1: Server Health Check Timeout
**What goes wrong:** Tests fail because server takes longer to start than expected
**Why it happens:** First run has to initialize Python venv, download embeddings model, create database
**How to avoid:** Set generous `timeout` for webServer (120s+), check actual startup time in logs
**Warning signs:** Intermittent test failures, "Server failed to start" errors

### Pitfall 2: Database File Locking
**What goes wrong:** Tests fail with "database is locked" errors
**Why it happens:** LanceDB opens database with exclusive lock, concurrent tests conflict
**How to avoid:** Use worker-scoped fixture for database, each worker gets its own db file
**Warning signs:** "Lock acquisition timeout", "database locked" errors

### Pitfall 3: Port Already in Use
**What goes wrong:** `webServer` fails to bind to port 8000
**Why it happens:** Dev server running, previous test didn't clean up, zombie process
**How to avoid:** Use `reuseExistingServer: !process.env.CI` in local dev
**Warning signs:** "EADDRINUSE" error, "Address already in use"

### Pitfall 4: Missing Test Environment Config
**What goes wrong:** Tests use production database or wrong API key
**Why it happens:** No `.env.test` loaded, falling back to defaults
**How to avoid:** Explicitly load `.env.test` in `playwright.setup.ts`, validate required env vars
**Warning signs:** Production data modified, unexpected auth failures

### Pitfall 5: Flaky Tests from Race Conditions
**What goes wrong:** Tests pass/fail randomly depending on timing
**Why it happens:** Waiting for network, animations, or async operations without proper waits
**How to avoid:** Use Playwright's `waitFor*` methods, `expect().toBeVisible()` to handle async
**Warning signs:** Intermittent failures, "element not found" errors

## Code Examples

Verified patterns from official sources:

### Basic Playwright Config with webServer
```typescript
// playwright.config.ts
// Source: https://playwright.dev/docs/test-webserver
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Auto-launch FastAPI server
  webServer: {
    command: 'uv run uvicorn src.app.main:app --host 127.0.0.1 --port 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
  },
});
```

### Auth Fixture with API Key
```typescript
// tests/e2e/fixtures/auth.ts
// Source: https://playwright.dev/docs/test-fixtures
import { test as base, Page } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: Page }, { apiKey: string }>({
  // Provide API key to all tests in this test file
  apiKey: [async ({}, use) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    await use(apiKey);
  }, { scope: 'worker' }],

  // Page with auth headers automatically added to all API requests
  authenticatedPage: async ({ page, apiKey }, use) => {
    await page.route('**/api/**', async (route) => {
      const headers = { ...route.request().headers(), 'X-API-Key': apiKey };
      route.continue({ headers });
    });

    await use(page);
  },
});
```

### Database Test Data Fixture
```typescript
// tests/e2e/fixtures/database.ts
// Source: https://playwright.dev/docs/test-fixtures (async fixture pattern)
import { test as base, APIRequestContext } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

interface TestMessage {
  conversation_id: string;
  message: string;
  role: string;
  timestamp: number;
}

export const test = base.extend<{ testMessages: TestMessage[] }, { testDbPath: string }>({
  // Create isolated database per worker
  testDbPath: [async ({}, use) => {
    const dbPath = path.join(__dirname, `../../data/test-db-${process.pid}.lance`);
    // Create database and seed with test data
    // ... implementation depends on database seeding strategy
    await use(dbPath);
    // Cleanup: remove test database
    await fs.unlink(dbPath).catch(() => {});
  }, { scope: 'worker' }],

  // Provide test messages to tests
  testMessages: async ({ request }, use) => {
    const messages: TestMessage[] = [
      {
        conversation_id: 'conv-1',
        message: 'Test message for search',
        role: 'user',
        timestamp: Date.now(),
      },
      // ... more test data
    ];
    await use(messages);
    // Cleanup: could delete via API if needed
  },
});
```

### Test Using Fixtures
```typescript
// tests/e2e/spec/search.spec.ts
import { test, authenticatedPage, expect } from '../fixtures/auth';

test('search returns test message', async ({ authenticatedPage, request }) => {
  // Use authenticated page - headers are automatically added
  await authenticatedPage.goto('/');

  // Perform search via API for better control
  const response = await request.post('/api/v1/search', {
    data: { query: 'test message', limit: 5 },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.count).toBeGreaterThan(0);
});

test('search without auth fails', async ({ page, baseURL }) => {
  const response = await page.request.post(`${baseURL}/api/v1/search`, {
    data: { query: 'test', limit: 5 },
  });

  expect(response.status()).toBe(403);
});
```

### Test Environment Setup
```typescript
// tests/e2e/playwright.setup.ts
// Source: Standard practice for test environment configuration
import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  // Load .env.test file
  const envPath = path.join(__dirname, '../../.env.test');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
    console.log('Loaded .env.test configuration');
  }

  // Validate required environment variables
  const required = ['TEST_API_KEY', 'TEST_DB_PATH', 'TEST_PORT'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

export default globalSetup;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual server start in beforeAll | webServer configuration | Playwright 1.20+ | Eliminates boilerplate, handles health checks |
| Shared test fixtures | Worker-scoped fixtures | Playwright 1.25+ | Better parallelization, no test interference |
| Hard-coded test URLs | baseURL with config | Playwright 1.15+ | Easy environment switching, cleaner tests |

**Deprecated/outdated:**
- Selenium WebDriver: Replaced by Playwright (faster, more reliable)
- Protractor: Deprecated, Playwright is modern standard
- Cypress: Still viable but Playwright has broader language support
- Custom server launchers: Use official webServer instead

## Open Questions

### Question 1: Database Seeding Strategy
- **What we know:** LanceDB doesn't have a simple seed mechanism like SQL INSERT
- **What's unclear:** Should we seed via API ingest endpoint, direct LanceDB operations, or fixture files?
- **Recommendation:** Seed via API ingest endpoint to test actual data flow, but provide fixture files for repeatability. Consider using `fixtures/seed-data.json` and an API endpoint to bulk ingest test data.

### Question 2: Test vs Production Database Compatibility
- **What we know:** Project uses LanceDB (vector database), not a traditional SQL database
- **What's unclear:** Is there any schema/migration that needs to be set up for test database?
- **Recommendation:** Verify if LanceDB requires any schema initialization. If not, test database can be a simple fresh file on each test run.

### Question 3: Parallel Test Execution Strategy
- **What we know:** Playwright runs tests in parallel by default, but LanceDB may have file locking issues
- **What's unclear:** Should we limit to single worker, or implement more complex isolation (one db per worker)?
- **Recommendation:** Start with `workers: 1` for simplicity in this phase. If performance becomes an issue, implement worker-scoped database fixtures (each worker gets its own db file).

## Integration with Existing Code

### Current Test Infrastructure
The project already has:
- `pytest` configured in `pyproject.toml`
- `pytest-asyncio` for async FastAPI testing
- `conftest.py` with fixtures for database setup
- Existing auth tests using FastAPI's `TestClient`

### What Changes
- New npm commands for E2E tests (complementing pytest tests)
- `playwright.config.ts` for Playwright configuration
- `.env.test` for test environment variables
- New test directory structure: `tests/e2e/`

### What Stays the Same
- pytest tests continue to work as before
- Python unit tests unchanged
- Existing `conftest.py` fixtures still used for pytest tests

### Recommended Test Division
| Test Type | Framework | Purpose | Runtime |
|-----------|-----------|---------|---------|
| Unit tests | pytest | Test individual functions/classes | Fast |
| API tests | pytest + TestClient | Test FastAPI endpoints without browser | Fast |
| Unit tests | Vitest | Test React components | Fast |
| **E2E tests** | **Playwright** | **Full user flows from browser to backend** | **Slow** |

## Sources

### Primary (HIGH confidence)
- https://playwright.dev/docs/test-webserver - webServer configuration, health checks, options
- https://playwright.dev/docs/test-fixtures - Fixture patterns, async fixtures, worker scope
- https://playwright.dev/docs/api/class-fixturerecorder - Fixture API reference
- https://playwright.dev/docs/configure - Playwright config reference
- https://playwright.dev/python/docs/intro - Python pytest integration
- /home/pter/code/where-is-my-shit/src/app/main.py - Current FastAPI application setup
- /home/pter/code/where-is-my-shit/tests/conftest.py - Existing pytest fixtures
- /home/pter/code/where-is-my-shit/pyproject.toml - Current dependencies
- /home/pter/code/where-is-my-shit/ui/vite.config.ts - Vite configuration

### Secondary (MEDIUM confidence)
- Standard practice for .env.test files derived from 12-factor app methodology
- LanceDB usage patterns derived from project's existing code in `/src/app/db/client.py`
- Auth integration derived from `/src/app/core/auth.py`

### Tertiary (LOW confidence)
- None - all findings verified against official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified against official Playwright documentation
- Architecture: HIGH - Patterns verified from official Playwright documentation and confirmed against project structure
- Pitfalls: HIGH - Derived from official documentation and common test failure patterns

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - Playwright release cycle is stable, but minor versions may add features)

---

*Phase: 13-test-infrastructure-setup*
*Researched: 2026-02-12*
