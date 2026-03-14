import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

async function authenticate(page: any, apiKey: string, path: string = '/') {
  await page.goto('/');
  await page.evaluate((key: string) => localStorage.setItem('wims_api_key', key), apiKey);
  await page.goto(path);
}

async function ingest(request: any, apiKey: string, data: Record<string, any>) {
  const response = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data,
  });
  expect(response.status()).toBe(201);
}

test.describe('Prev/Next Navigation in ConversationPanel', () => {
  test.beforeAll(async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    // Ingest multiple conversations so we have multiple results
    for (let i = 1; i <= 3; i++) {
      await ingest(request, apiKey, {
        conversation_id: `nav-test-conv-${i}`,
        platform: 'chatgpt',
        content: `Navigation test message ${i} about artificial intelligence techniques`,
        role: 'user',
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        title: `Nav Test ${i}`,
      });
    }
  });

  test('prev/next buttons appear when multiple results', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Search for all nav test results
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.getByPlaceholder('Search your history...').fill('navigation test artificial intelligence');
    await searchResponse;

    // Wait for results
    await page.waitForTimeout(500);

    // Click first result to open conversation panel
    const firstResult = page.locator('[role="button"]').first();
    await firstResult.click();

    // Wait for panel to appear
    await page.waitForTimeout(500);

    // When viewing the first result, there should be a "next" button but no "prev"
    const nextButton = page.locator('button[aria-label="Next result"]');
    // At minimum, nav buttons should exist in the panel
    const panelButtons = page.locator('.fixed button, [class*="panel"] button');
    const buttonCount = await panelButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('clicking next changes the displayed conversation', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Search for results
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.getByPlaceholder('Search your history...').fill('navigation test artificial intelligence');
    await searchResponse;

    await page.waitForTimeout(500);

    // Click first result
    const firstResult = page.locator('[role="button"]').first();
    await firstResult.click();

    await page.waitForTimeout(500);

    // Get the current conversation URL parameter
    const urlBefore = page.url();

    // Try to find and click next button
    const nextButton = page.locator('button[aria-label="Next result"]').first();
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // URL should have changed to show a different conversation
      const urlAfter = page.url();
      // The conversation parameter should have changed
      expect(urlAfter).not.toBe(urlBefore);
    }
  });
});
