import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

// Helper: authenticate and navigate to a page
async function authenticate(page: any, apiKey: string, path: string = '/') {
  await page.goto('/');
  await page.evaluate((key: string) => localStorage.setItem('wims_api_key', key), apiKey);
  await page.goto(path);
}

// Helper: ingest a test document
async function ingest(request: any, apiKey: string, data: Record<string, any>) {
  const response = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data,
  });
  expect(response.status()).toBe(201);
}

test.describe('Export Conversation', () => {

  test('export button appears in conversation panel', async ({ page, apiKey, request }) => {
    // Ingest a conversation with multiple messages
    const convId = 'export-test-conv';
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'How do I use React hooks?',
      role: 'user',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      title: 'React Hooks Guide',
    });
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'React hooks allow you to use state and other React features in function components.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'React Hooks Guide',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Search and open the conversation
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'React Hooks Guide');
    await searchResponse;
    await page.waitForTimeout(500);

    // Click the first result to open the conversation panel
    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Verify the export button is visible (first() because desktop+mobile panels both render)
    const exportButton = page.locator('button[aria-label="Export as markdown"]').first();
    await expect(exportButton).toBeVisible();
  });

  test('export button triggers download', async ({ page, apiKey, request }) => {
    const convId = 'export-download-test';
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'claude',
      content: 'What is TypeScript?',
      role: 'user',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      title: 'TypeScript Intro',
    });
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'claude',
      content: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'TypeScript Intro',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'TypeScript Intro');
    await searchResponse;
    await page.waitForTimeout(500);

    // Open the conversation panel
    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Listen for the download event before clicking
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button[aria-label="Export as markdown"]').first().click(),
    ]);

    // Verify a download was triggered
    expect(download.suggestedFilename()).toContain('.md');

    // Read and verify the content
    const path = await download.path();
    expect(path).toBeTruthy();

    // Use fs to read the temp file
    const fs = require('fs');
    const content = fs.readFileSync(path!, 'utf-8');
    expect(content).toContain('# TypeScript Intro');
    expect(content).toContain('## User');
    expect(content).toContain('## Assistant');
    expect(content).toContain('What is TypeScript?');
    expect(content).toContain('TypeScript is a strongly typed programming language');
  });
});
