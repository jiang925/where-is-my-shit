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

test.describe('Compact Card Mode', () => {
  test.beforeAll(async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    await ingest(request, apiKey, {
      conversation_id: 'compact-view-test-1',
      platform: 'chatgpt',
      content: 'Compact view test content about React hooks and state management patterns',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Compact View Test',
    });
    await ingest(request, apiKey, {
      conversation_id: 'compact-view-test-2',
      platform: 'claude',
      content: 'Another compact view test about TypeScript generics and type inference',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Compact View Test 2',
    });
  });

  test('view mode toggle button is visible on search page', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Search to get results
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.getByPlaceholder('Search your history...').fill('compact view test');
    await searchResponse;

    // View mode toggle button should be visible
    const toggleButton = page.locator('button[aria-label="Switch to compact view"], button[aria-label="Switch to card view"]');
    await expect(toggleButton.first()).toBeVisible();
  });

  test('toggling view mode switches between card and compact', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Search to get results
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.getByPlaceholder('Search your history...').fill('compact view test');
    await searchResponse;

    // Wait for results to appear
    await page.waitForTimeout(500);

    // Default should be card view - toggle to compact
    const compactToggle = page.locator('button[aria-label="Switch to compact view"]');
    if (await compactToggle.isVisible()) {
      await compactToggle.click();
      // Should now show card view toggle
      await expect(page.locator('button[aria-label="Switch to card view"]')).toBeVisible();
    }

    // Verify localStorage was updated
    const viewMode = await page.evaluate(() => localStorage.getItem('wims_view_mode'));
    expect(viewMode).toBe('compact');
  });

  test('view mode persists after page reload', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);

    // Set compact mode in localStorage
    await page.evaluate(() => localStorage.setItem('wims_view_mode', 'compact'));
    await page.goto('/');

    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Search to get results
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.getByPlaceholder('Search your history...').fill('compact view test');
    await searchResponse;

    // Should show "Switch to card view" (meaning we're in compact mode)
    await expect(page.locator('button[aria-label="Switch to card view"]')).toBeVisible();
  });
});
