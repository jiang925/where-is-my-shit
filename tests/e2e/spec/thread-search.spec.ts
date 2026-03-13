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

test.describe('In-Thread Search', () => {

  test.beforeEach(async ({ request, apiKey }) => {
    // Ingest a multi-message conversation
    const convId = 'thread-search-conv';
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'How do I use Python decorators?',
      role: 'user',
      timestamp: new Date(Date.now() - 180000).toISOString(),
      title: 'Python Decorators',
    });
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'Decorators in Python are functions that modify the behavior of other functions. They use the @decorator syntax.',
      role: 'assistant',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      title: 'Python Decorators',
    });
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'Can you show me a caching decorator example?',
      role: 'user',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      title: 'Python Decorators',
    });
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'Here is an example of a simple caching decorator using functools.lru_cache.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Python Decorators',
    });
  });

  test('search input appears in conversation panel with multiple messages', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Search and open the conversation
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'Python Decorators');
    await searchResponse;
    await page.waitForTimeout(500);

    // Click result to open panel
    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Thread search input should be visible
    const threadSearch = page.locator('input[aria-label="Search in conversation"]').first();
    await expect(threadSearch).toBeVisible();
  });

  test('typing in thread search shows match count', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'Python Decorators');
    await searchResponse;
    await page.waitForTimeout(500);

    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Type in thread search
    const threadSearch = page.locator('input[aria-label="Search in conversation"]').first();
    await threadSearch.fill('caching');
    await page.waitForTimeout(200);

    // Match count should appear (e.g., "2/4")
    const matchIndicator = page.locator('text=/\\d+\\/\\d+/').first();
    await expect(matchIndicator).toBeVisible();
  });

  test('thread search highlights matching text', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'Python Decorators');
    await searchResponse;
    await page.waitForTimeout(500);

    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Type search query
    const threadSearch = page.locator('input[aria-label="Search in conversation"]').first();
    await threadSearch.fill('decorator');
    await page.waitForTimeout(200);

    // Highlighted text should appear
    const marks = page.locator('mark');
    const markCount = await marks.count();
    expect(markCount).toBeGreaterThan(0);
  });

  test('non-matching messages are dimmed', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'Python Decorators');
    await searchResponse;
    await page.waitForTimeout(500);

    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Search for something only in some messages
    const threadSearch = page.locator('input[aria-label="Search in conversation"]').first();
    await threadSearch.fill('caching');
    await page.waitForTimeout(200);

    // Some messages should have opacity-30 (dimmed)
    const dimmedMessages = page.locator('.opacity-30');
    const dimmedCount = await dimmedMessages.count();
    expect(dimmedCount).toBeGreaterThan(0);
  });
});
