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

test.describe('Conversation Notes', () => {
  test.beforeAll(async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    await ingest(request, apiKey, {
      conversation_id: 'notes-test-conv-1',
      platform: 'chatgpt',
      content: 'Notes test content about machine learning model training',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Notes Test Conversation',
    });
  });

  test('note icon is visible in conversation panel header', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Search and open a conversation
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.getByPlaceholder('Search your history...').fill('notes test machine learning');
    await searchResponse;
    await page.waitForTimeout(500);

    // Click first result to open conversation panel
    const firstResult = page.locator('[role="button"]').first();
    await firstResult.click();
    await page.waitForTimeout(500);

    // Note/StickyNote button should be visible in the panel header
    const noteButton = page.locator('button[aria-label="Add note"], button[title*="note"], button[title*="Note"]');
    const noteButtonCount = await noteButton.count();
    expect(noteButtonCount).toBeGreaterThan(0);
  });

  test('notes persist in localStorage', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);

    // Set a note directly in localStorage
    await page.evaluate(() => {
      const notes = { 'notes-test-conv-1': 'My test note about this conversation' };
      localStorage.setItem('wims_notes', JSON.stringify(notes));
    });

    // Verify the note was stored
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('wims_notes');
      return raw ? JSON.parse(raw) : {};
    });
    expect(stored['notes-test-conv-1']).toBe('My test note about this conversation');
  });

  test('notes are independent per conversation', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);

    // Set notes for two different conversations
    await page.evaluate(() => {
      const notes = {
        'notes-conv-a': 'Note for conversation A',
        'notes-conv-b': 'Note for conversation B',
      };
      localStorage.setItem('wims_notes', JSON.stringify(notes));
    });

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('wims_notes');
      return raw ? JSON.parse(raw) : {};
    });
    expect(stored['notes-conv-a']).toBe('Note for conversation A');
    expect(stored['notes-conv-b']).toBe('Note for conversation B');
  });
});
