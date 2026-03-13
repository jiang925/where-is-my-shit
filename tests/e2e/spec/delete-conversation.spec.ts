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

test.describe('Delete Conversation', () => {

  const convId = 'delete-e2e-conv';

  test.beforeEach(async ({ request, apiKey }) => {
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'What is a closure in JavaScript?',
      role: 'user',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      title: 'JavaScript Closures',
    });
    await ingest(request, apiKey, {
      conversation_id: convId,
      platform: 'chatgpt',
      content: 'A closure is a function that captures variables from its outer scope.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'JavaScript Closures',
    });
  });

  test('delete button visible in conversation panel', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'JavaScript Closures');
    await searchResponse;
    await page.waitForTimeout(500);

    // Open conversation panel
    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Delete button should be visible
    const deleteBtn = page.locator('button[aria-label="Delete conversation"]').first();
    await expect(deleteBtn).toBeVisible();
  });

  test('delete shows confirmation dialog', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'JavaScript Closures');
    await searchResponse;
    await page.waitForTimeout(500);

    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Click delete button
    await page.locator('button[aria-label="Delete conversation"]').first().click();

    // Confirmation dialog should appear
    await expect(page.locator('text=Delete conversation?')).toBeVisible();
    await expect(page.locator('button[aria-label="Confirm delete"]')).toBeVisible();
    await expect(page.locator('text=Cancel')).toBeVisible();
  });

  test('cancel dismiss confirmation dialog', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'JavaScript Closures');
    await searchResponse;
    await page.waitForTimeout(500);

    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Open and cancel delete
    await page.locator('button[aria-label="Delete conversation"]').first().click();
    await expect(page.locator('text=Delete conversation?')).toBeVisible();

    // Click Cancel
    await page.locator('text=Cancel').click();

    // Dialog should disappear, panel should still be open
    await expect(page.locator('text=Delete conversation?')).not.toBeVisible();
    await expect(page.locator('input[aria-label="Search in conversation"]').first()).toBeVisible();
  });

  test('confirm delete removes conversation and closes panel', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'JavaScript Closures');
    await searchResponse;
    await page.waitForTimeout(500);

    await page.locator('.group').first().click();
    await page.waitForTimeout(500);

    // Confirm delete
    await page.locator('button[aria-label="Delete conversation"]').first().click();

    const deleteResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/conversations/') && res.request().method() === 'DELETE'
    );
    await page.locator('button[aria-label="Confirm delete"]').click();
    await deleteResponse;
    await page.waitForTimeout(500);

    // Panel should be closed (no thread search input visible)
    await expect(page.locator('input[aria-label="Search in conversation"]')).not.toBeVisible();
  });
});
