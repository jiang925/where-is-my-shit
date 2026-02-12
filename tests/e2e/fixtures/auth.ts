import { test as base, Page } from '@playwright/test';

interface AuthFixtures {
  apiKey: string;
  authenticatedPage: Page;
}

export const test = base.extend<AuthFixtures>({
  // Provide API key from test environment
  apiKey: async ({}, use) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    console.log(`Using test API key: ${apiKey.substring(0, 10)}...`);
    await use(apiKey);
  },

  // Page with auth headers automatically added to all API requests
  authenticatedPage: async ({ page, apiKey }, use) => {
    // Setup: Configure request interceptor for auth headers
    await page.route('**/api/**', async (route) => {
      const headers = {
        ...route.request().headers(),
        'X-API-Key': apiKey,
      };
      route.continue({ headers });
    });

    console.log('Configured authenticatedPage with API key interceptor');

    await use(page);

    // Teardown: No direct cleanup - fixtures are automatically cleaned up
    // Any test-specific data cleanup should be handled in database fixture
  },
});
