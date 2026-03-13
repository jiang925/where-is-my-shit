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

test.describe('Open in Terminal', () => {

  test('terminal button visible for file-path URL in search results', async ({ page, apiKey, request }) => {
    // Ingest a dev session with a file path as URL
    await ingest(request, apiKey, {
      conversation_id: 'terminal-test-conv',
      platform: 'claude-code',
      content: 'Debugging the authentication module',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Session abc12345',
      url: '/Users/test/projects/myapp',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'authentication module');
    await searchResponse;
    await page.waitForTimeout(500);

    // The "Terminal" button should be visible on the result card
    const terminalBtn = page.locator('button[aria-label="Open in terminal"]').first();
    // Or it might be the text "Terminal" in the CopyablePath
    const terminalText = page.locator('text=Terminal').first();
    await expect(terminalText).toBeVisible();
  });

  test('terminal button visible in conversation panel for dev sessions', async ({ page, apiKey, request }) => {
    await ingest(request, apiKey, {
      conversation_id: 'terminal-panel-conv',
      platform: 'claude-code',
      content: 'How do I fix this race condition?',
      role: 'user',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      title: 'Session def67890',
      url: '/Users/test/projects/myapp',
    });
    await ingest(request, apiKey, {
      conversation_id: 'terminal-panel-conv',
      platform: 'claude-code',
      content: 'You can use a mutex to prevent the race condition.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Session def67890',
      url: '/Users/test/projects/myapp',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'race condition');
    await searchResponse;
    await page.waitForTimeout(500);

    // Open conversation panel
    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // "Open in Terminal" link should be visible in the panel header
    const terminalLink = page.locator('button[aria-label="Open in terminal"]').first();
    await expect(terminalLink).toBeVisible();
  });
});
