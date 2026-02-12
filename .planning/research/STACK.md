# Stack Research: UI/API Integration Testing

**Domain:** UI/API Integration Testing for FastAPI + React
**Researched:** 2026-02-12
**Confidence:** HIGH

## Recommended Stack

### Core Testing Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @playwright/test | ^1.58.2 | Integration test runner | Industry standard for E2E/integration testing with excellent TypeScript support, built-in fixtures, dev server orchestration, and API testing capabilities. Supports multiple web servers in single config - critical for testing FastAPI + React together. |
| @playwright/browsers | [bundled] | Browser binaries | Provides Chrome, Firefox, WebKit support out of the box. Essential for testing cross-browser compatibility, though Chromium is sufficient for integration testing. |

### Test Data & Fixtures

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Custom Playwright fixtures | Typescript config | Test data setup & cleanup | Use `test.extend()` for database seeding fixtures. Worker-scoped fixtures (`scope: 'worker'`) for shared test data across multiple tests; test-scoped fixtures for isolation between tests. |
| Project dependencies pattern | n/a | Global test lifecycle | When you need setup/teardown that runs before any tests (database initialization, seed data ingestion) with full trace/recording support. Avoid `globalSetup` config option - it lacks fixtures and HTML report visibility. |
| API test request context | built-in | API testing without page load | Use `request` fixture for server-side state validation. Two contexts available: context request (shares cookies with page) for auth tests; global request (`playwright.request.newContext()`) for isolated API testing. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| test.extend() API | Custom fixture creation | Create domain-specific fixtures (e.g., `seededDb`, `searchResults` by calling your ingest endpoint with test data. |
| webServer configuration | Dev server orchestration | Supports array of servers for multi-process orchestration. Critical feature: can start Python FastAPI (backend) and have Playwright verify both services are ready before tests run. |
| reuseExistingServer dev server option | Local development workflow | Set `reuseExistingServer: !process.env.CI` to avoid restarting already-running dev servers during local test runs. Saves time during iteration. |
| baseURL configuration | Base URL for page navigation | Set globally in config: `use: { baseURL: 'http://localhost:8000' }`. Allows relative URLs in tests: `await page.goto('/');` instead of `await page.goto('http://localhost:8000/');`. |

### Environment & Test Orchestration

| Tool | Purpose | Notes |
|------|---------|-------|
| node:process.env.CI | Environment detection | Built-in Node.js API. Use to detect CI environment for conditional behavior (e.g., `reuseExistingServer: !process.env.CI`). |
| Python CLI: custom test mode | Server start in test mode | Modify `src/cli.py` to accept `--test-mode` flag that uses isolated test database path (`--db-path /tmp/wims-test.lance`). No additional Python dep needed. |
| Browser context isolation | Auth state management | Use `browser.newContext()` for fresh auth state between tests. For tests requiring session persistence, create worker-scoped fixture sharing same context across tests. |

## Installation

```bash
# Core Playwright packages (install in ui/ directory)
cd ui
npm install -D @playwright/test@^1.58.2

# Install browser binaries (required for first-time setup)
npx playwright install chromium

# Optional: Install all browsers if cross-browser testing needed later
npx playwright install

# Environment management for test configuration (optional, but recommended)
npm install -D cross-env dotenv
```

**Configuration Files to Create:**

```bash
ui/
├── playwright.config.ts      # Playwright test configuration
├── tests/
│   ├── integration/          # Integration test suite
│   │   ├── search.spec.ts    # Full search flow tests
│   │   └── api.spec.ts       # API-only tests using request fixture
│   └── fixtures/
│       ├── test-data.ts      # Sample messages for seeding
│       └── db.fixture.ts     # Database seeding fixture
└── tsconfig.json             # TypeScript config (already exists)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Playwright | Cypress | Choose Cypress if you prefer interactive test runner with visual time-travel debugging. But Cypress doesn't support multiple dev servers natively, and its TypeScript support is less mature. Playwright's built-in dev server orchestration makes it the better choice for FastAPI + React testing. |
| Real backend testing | API mocking (MSW, MirageJS) | Use mocking ONLY if backend is external/unstable. For internal FastAPI, **always test against real backend**. Mocking introduces divergence risk and doesn't verify actual API contract. Playwright's `request` fixture allows efficient API-only tests when UI isn't needed. |
| Project dependencies pattern | globalSetup config option | Global setup is simpler but lacks fixtures, traces, and HTML report visibility. Project dependencies run as separate "setup" project before tests, giving you full Playwright capabilities including fixtures and trace recording. Only choose globalSetup if you don't need tracing. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Full E2E test suite for MVP | Overkill for v1.3. The goal is verifying UI/API connectivity, not comprehensive user journey coverage. Full E2E patterns increase maintenance burden and test flakiness. | Focus integration tests on critical flows: (1) API Key auth, (2) Search request/response, (3) Empty results handling. Use Playwright's `request` fixture for API-only tests to reduce browser overhead. |
| Selenium / Puppeteer | Selenium lacks modern TypeScript ergonomics and has flaky element selection. Puppeteer lacks multi-browser support and has no built-in dev server orchestration. Both require additional boilerplate for test data cleanup. | Playwright provides all three features (multi-browser, TypeScript-first, dev server orchestration) out of the box with less configuration overhead. |
| MSW (Mock Service Worker) for internal API | Mocking introduces risk: frontends can pass tests while backend is broken. No need to mock internal, controllable FastAPI backend. | Real backend testing. Only use MSW if your app depends on third-party APIs beyond your control (OpenAI, Anthropic, etc.). |
| Detox for React Native testing | WIMS is a web-based UI, not React Native. Detox specializes in gray-box mobile testing with platform-specific instrumentation. | Playwright's web testing is optimized for React/Vite web applications running in browsers. |
| Separate test dev servers (docker-compose) | Running services in Docker adds complexity: container build time, volume mounting issues, networking configuration. Playwright's webServer can start processes directly with full supervision. | Process-based dev servers managed by Playwright. Use docker-compose ONLY if you're testing production deployment, not integration testing. |

## Stack Patterns by Variant

**Local Development (iterative testing):**
- Set `reuseExistingServer: !process.env.CI` in webServer config
- Start Python backend manually: `uv run src/cli.py start --test-mode`
- Run Playwright tests: `npm run test:integration`
- Backend stays running between test runs, faster iteration

**CI Environment (GitHub Actions / GitLab CI):**
- Set `reuseExistingServer: false` (default in CI)
- Playwright starts fresh dev server for each test run
- Ensures clean state and proper error detection
- Add `playwright install --with-deps` to CI setup

**API-Only Tests (no UI needed, faster):**
- Use `request` fixture instead of `page` fixture
- Example: `test('search API validates query length', async ({ request }) => { ... })`
- Skips entire browser initialization, reduces test time by 3-5x per test
- Ideal for testing edge cases, validation logic, and error handling

**Seeded Database Tests (deterministic results):**
- Create worker-scoped fixture: `test.extend<{ seededDb: string }>({ seededDb: ... })`
- Ingest known test data via API before tests run: `await request.post('/api/v1/ingest', ...)`
- Multiple tests in same worker share same database state
- Use test-scoped fixtures for test-specific data that needs cleanup

**Multi-Browser Testing (future consideration):**
- Playwright supports Chromium, Firefox, WebKit out of box
- For v1.3, test Chromium only (covers same rendering engine as Chrome/Edge)
- Add Firefox/WebKit if user reports browser-specific issues
- Browser matrix configuration:
  ```typescript
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ]
  ```

## Version Compatibility

| Package | Compatible With | Notes |
|-----------|-----------------|-------|
| @playwright/test@^1.58.2 | Node.js 18+ | Released 2026-02-06, requires Node.js 18+. WIMS already uses Node 18+ for Vite. |
| Vite 7.2.4 | Playwright 1.58.2 | No conflicts. Vite serves static files; Playwright tests deployed output. Both can run in parallel. |
| React 19.2.0 | Playwright 1.58.2 | No conflicts. Playwright tests rendered output, doesn't depend on React internals. |
| TypeScript 5.9.3 | Playwright 1.58.2 | Playwright 1.58.2 uses TypeScript 5.5+ type definitions. Compatible with 5.9.3. |

**Vitest Coexistence:**
- Vitest (already installed) handles component tests with jsdom
- Playwright handles integration tests with real browser
- Separate test commands:
  - `npm run test` → Vitest (unit tests, existing behavior)
  - `npm run test:integration` → Playwright (new integration tests)
- No package conflicts - both use different test runners
- Both can run TypeScript directly without build step

## Configuration Examples

### Playwright Configuration (ui/playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Enable web server orchestration
  webServer: {
    command: 'uv run src/cli.py start --test-mode',
    url: 'http://127.0.0.1:8000',
    port: 8000,
    reuseExistingServer: !process.env.CI,  // Don't restart during local dev
    timeout: 120 * 1000,  // 2-minute startup timeout
    env: { WIMS_CONFIG_FILE: '/tmp/wims-test.json' },
  },

  // Set base URL for all page navigations
  use: {
    baseURL: 'http://127.0.0.1:8000',
    screenshot: 'only-on-failure',  // Capture screenshots on failures
    video: 'retain-on-failure',    // Record video on failures
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Test globals
  testDir: './tests/integration',
  fullyParallel: true,  // Run tests in parallel
  forbidOnly: !!process.env.CI,  // Fail on .only in CI
  retries: process.env.CI ? 2 : 0,  // Retry failed tests twice in CI
  workers: process.env.CI ? 1 : undefined,  // Singleworker in CI (simpler debug)
});
```

### Project Dependencies Pattern for Database Seeding

```typescript
// ui/playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup db',
      testMatch: /tests\/fixtures\/global\.setup\.ts/,
      teardown: 'cleanup db',
    },
    {
      name: 'cleanup db',
      testMatch: /tests\/fixtures\/global\.teardown\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup db'],  // Runs after setup db completes
    },
  ],
});
```

### Custom Fixture for Database Seeding

```typescript
// ui/tests/fixtures/db.fixture.ts
import { test as base, expect } from '@playwright/test';

// Types for test data interface
interface SeededDb {
  ingestResults: string[];
}

// Extend base test with custom fixture
const test = base.extend<({ seededDb: SeededDb })>({
  seededDb: async ({ request }, use) => {
    // Setup: Ingest test data
    const testData = [
      { content: 'test message 1', meta: { source: 'claude' } },
      { content: 'test message 2', meta: { source: 'chatgpt' } },
    ];

    const ingestResults: string[] = [];
    for (const item of testData) {
      const response = await request.post('/api/v1/ingest', {
        data: item,
        headers: { 'X-API-Key': process.env.TEST_API_KEY || 'test-key' },
      });
      const result = await response.json();
      ingestResults.push(result.id);
    }

    // Provide seeded data to test
    await use({ ingestResults });

    // Teardown: Cleanup happens in global.teardown.ts
  },
});

export { test, expect };
```

## Dev Server Orchestration Strategy

### Critical Decision: Single-Server Architecture

**Current Architecture:**
- FastAPI serves BOTH `/api/v1/*` (REST API) AND `/` (React frontend static files)
- Vite dev server NOT used in production (build output served by FastAPI)
- Playwright needs FastAPI running to test the full flow

**Recommended Approach:**
1. **For Integration Tests**: Start FastAPI in test mode only. No Vite dev server needed.
   - Build UI once: `npm run build`
   - Start FastAPI: `uv run src/cli.py start --test-mode`
   - Playwright tests: `http://127.0.0.1:8000/` (serves built UI + `/api/v1/*`)

2. **For Development Iteration**: Run both Vite dev server AND FastAPI
   - Terminal 1: `npm run dev` (Vite on port 5173)
   - Terminal 2: `uv run src/cli.py start` (FastAPI on port 8000)
   - Playwright config: `baseURL: 'http://localhost:5173'` with CORS config
   - Note: Requires CORS extension ID configuration in FastAPI config during dev

**Configuration for Test Mode FastAPI:**

```python
# src/cli.py modification for --test-mode flag
def start_server(args):
    # ... existing code ...

    if args.test_mode:
        # Use test database path
        test_db_path = tempfile.mkdtemp() + '/wims-test.lance'
        # Override settings
        settings = ServerConfig(
            api_key='test-api-key-local-only',
            port=args.port or 8000,
            host=args.host or '127.0.0.1',
            DB_PATH=test_db_path,
            # ... other test-specific settings
        )
```

**Why Not Multiple Dev Servers in Playwright config?**

| Approach | Pros | Cons |
|----------|------|------|
| Start FastAPI only (recommended) | Simple, matches production architecture | Requires build step before tests |
| Start Vite + FastAPI (complex) | Faster dev iteration (no rebuild) | CORS complexity, doesn't match prod architecture |

**Recommendation:** Start FastAPI only in Playwright webServer. Build UI before running integration tests. This ensures tests actually validate the production deployment path.

## API Testing Patterns with Playwright

### Pattern 1: Establish Preconditions via API, Verify via UI

```typescript
test('search displays ingested results', async ({ page, request }) => {
  // Step 1: Ingest test data via API (no UI interaction needed)
  await request.post('/api/v1/ingest', {
    data: {
      content: 'the sky is blue',
      meta: { source: 'test', conversation_id: 'conv-123' },
    },
    headers: { 'X-API-Key': 'test-key' },
  });

  // Step 2: Navigate to UI
  await page.goto('/');

  // Step 3: Enter API key in UI
  await page.fill('input[type="password"]', 'test-key');
  await page.click('button[type="submit"]');

  // Step 4: Perform search
  await page.fill('input[placeholder*="search"]', 'sky');
  await page.press('input[placeholder*="search"]', 'Enter');

  // Step 5: Verify results from search
  await expect(page.locator('text=the sky is blue')).toBeVisible();
});
```

### Pattern 2: Verify via API After UI Actions

```typescript
test('search query updates server state', async ({ page, request }) => {
  // Step 1: Setup auth in UI
  await page.goto('/');
  await page.fill('input[type="password"]', 'test-key');
  await page.click('button[type="submit"]');

  // Step 2: Perform search via UI
  await page.fill('input[placeholder*="search"]', 'test query');
  await page.press('input[placeholder*="search"]', 'Enter');

  // Step 3: Verify server received query via API
  // (This would require your backend to log queries or expose metrics)
  const response = await request.get('/api/v1/metrics/queries');
  await expect(response.ok()).toBeTruthy();
});
```

### Pattern 3: API-Only Tests (Edge Cases)

```typescript
test('search API rejects empty queries', async ({ request }) => {
  const response = await request.post('/api/v1/search', {
    data: { query: '', limit: 20, offset: 0 },
    headers: { 'X-API-Key': 'test-key' },
  });

  // Verify API returns empty results (your implementation choice)
  const result = await response.json();
  expect(result.results).toHaveLength(0);
  expect(result.total).toBe(0);
});

test('search API requires authentication', async ({ request }) => {
  const response = await request.post('/api/v1/search', {
    data: { query: 'test', limit: 20, offset: 0 },
    // No X-API-Key header
  });

  expect(response.status()).toBe(403);
  expect(await response.text()).toContain('Missing API Key');
});
```

## Sources

### High Confidence (Official Documentation)

- **[Playwright Installation](https://playwright.dev/docs/test-webserver)** — Verified webServer configuration with `command`, `url`, `reuseExistingServer`, `timeout`, multi-server array support, and graceful shutdown options
- **[Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures)** — Verified built-in fixtures (`page`, `context`, `browser`, `request`), custom fixture creation with `test.extend()`, and worker-scoped fixtures (`scope: 'worker'`)
- **[Playwright API Testing](https://playwright.dev/docs/api-testing)** — Confirmed real backend testing (not mocking) approach, `request` fixture behavior, context request vs global request patterns
- **[Playwright Global Setup](https://playwright.dev/docs/test-global-setup-teardown)** — Verified project dependencies pattern vs globalSetup configuration, with feature comparison table
- **[NPM Registry: @playwright/test](https://www.npmjs.com/package/@playwright/test)** — Confirmed latest stable version: 1.58.2 (released 2026-02-06)
- **[GitHub Release: Playwright v1.58.2](https://github.com/microsoft/playwright/releases/tag/v1.58.2)** — Verified release date and stability notation

### Medium Confidence (Official Code References)

- **[Playwright Package Source](https://raw.githubusercontent.com/microsoft/playwright/main/package.json)** — Verified project uses multiple web servers support and esbuild/vite build tools, validating multi-server orchestration patterns
- **[WIMS Project Codebase](/home/pter/code/where-is-my-shit)** — Verified FastAPI serves both `/api/v1/*` and `/`, Vite builds to `../src/static`, API Key auth with X-API-Key header

### Notes on Confidence

- **Playwright configuration patterns (HIGH):** Directly verified from official Playwright documentation
- **API testing strategies (HIGH):** Confirmed this is the recommended approach in official docs
- **Dev server orchestration (MEDIUM):** Patterns verified from docs; specific WIMS FastAPI configuration determined from code analysis
- **Test data fixtures (HIGH):** Fixture patterns and scopes verified from official docs
- **Vitest + Playwright coexistence (HIGH):** Standard practice confirmed by community patterns; no conflicts identified

---
*Stack research for: UI/API Integration Testing (FastAPI + React)*
*Researched: 2026-02-12*
*Ready for phase planning: yes*
