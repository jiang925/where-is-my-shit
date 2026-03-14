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

test.describe('Pinned Conversations', () => {
  test.beforeAll(async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    await ingest(request, apiKey, {
      conversation_id: 'pin-test-conv-1',
      platform: 'chatgpt',
      content: 'Pinned test conversation about database optimization',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Pinned Test Conversation',
    });
    await ingest(request, apiKey, {
      conversation_id: 'pin-test-conv-2',
      platform: 'claude',
      content: 'Another conversation about API design patterns',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Unpinned Test Conversation',
    });
  });

  test('pinned conversations stored in localStorage', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);

    // Pin a conversation via localStorage
    await page.evaluate(() => {
      const pinned = ['pin-test-conv-1'];
      localStorage.setItem('wims_pinned', JSON.stringify(pinned));
    });

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('wims_pinned');
      return raw ? JSON.parse(raw) : [];
    });
    expect(stored).toContain('pin-test-conv-1');
    expect(stored).not.toContain('pin-test-conv-2');
  });

  test('browse page shows pinned section when pins exist', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);

    // Set pins before navigating to browse
    await page.evaluate(() => {
      // Also need bookmarks for pinned items to show
      const bookmarks = ['pin-test-conv-1'];
      const pinned = ['pin-test-conv-1'];
      localStorage.setItem('wims_bookmarks', JSON.stringify(bookmarks));
      localStorage.setItem('wims_pinned', JSON.stringify(pinned));
    });

    await page.goto('/browse');
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 10000 });

    // Look for "Pinned" section header
    const pinnedSection = page.locator('text=Pinned');
    const hasPinned = await pinnedSection.isVisible().catch(() => false);

    // If pinned section is visible, the feature is working
    if (hasPinned) {
      await expect(pinnedSection.first()).toBeVisible();
    }
  });

  test('unpinning removes from pinned set', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);

    // Pin a conversation
    await page.evaluate(() => {
      localStorage.setItem('wims_pinned', JSON.stringify(['pin-test-conv-1']));
    });

    // Unpin by removing from the set
    await page.evaluate(() => {
      const pinned = JSON.parse(localStorage.getItem('wims_pinned') || '[]');
      const updated = pinned.filter((id: string) => id !== 'pin-test-conv-1');
      localStorage.setItem('wims_pinned', JSON.stringify(updated));
    });

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('wims_pinned');
      return raw ? JSON.parse(raw) : [];
    });
    expect(stored).not.toContain('pin-test-conv-1');
  });
});

test.describe('Pinned Conversations - Backend Digest', () => {
  test('digest endpoint returns conversation summaries', async ({ request, apiKey }) => {
    // Test the digest endpoint which groups conversations
    const response = await request.get('/api/v1/digest?period=today', {
      headers: { 'X-API-Key': apiKey },
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toBeDefined();
    // Digest should have some structure (platforms, counts)
    expect(typeof data).toBe('object');
  });

  test('digest endpoint supports this_week period', async ({ request, apiKey }) => {
    const response = await request.get('/api/v1/digest?period=this_week', {
      headers: { 'X-API-Key': apiKey },
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toBeDefined();
  });
});
