import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

export default defineConfig({
  globalSetup: require.resolve('./tests/e2e/playwright.setup.ts'),
  testDir: './tests/e2e',
  testIgnore: ['**/exploratory.spec.ts'],  // Uses hardcoded live server URL, not for CI
  fullyParallel: false,  // Single worker to avoid LanceDB lock conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // Single worker for LanceDB compatibility

  // Auto-launch FastAPI server before tests
  webServer: {
    command: 'uv run uvicorn src.app.main:app --host 127.0.0.1 --port 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,  // 120 seconds for first run (uv venv init, model loading)
    env: {
      // Use test config file (created by globalSetup before webServer starts)
      WIMS_CONFIG_FILE: path.join(__dirname, 'data/test-server-config.json'),
    },
  },

  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
