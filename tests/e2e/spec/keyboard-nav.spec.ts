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

test.describe('Keyboard Navigation', () => {

  test('arrow down moves focus to first result card', async ({ page, apiKey, request }) => {
    // Ingest test data
    await ingest(request, apiKey, {
      conversation_id: 'kb-nav-test-1',
      platform: 'chatgpt',
      content: 'Keyboard navigation test message alpha',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'KB Nav Alpha',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Search
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'keyboard navigation alpha');
    await searchResponse;
    await page.waitForTimeout(500);

    // Press arrow down — should focus first result
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // The focused card should have the focus ring class
    const focusedCard = page.locator('.ring-2.ring-blue-100').first();
    await expect(focusedCard).toBeVisible();
  });

  test('enter key opens conversation panel for focused result', async ({ page, apiKey, request }) => {
    await ingest(request, apiKey, {
      conversation_id: 'kb-nav-enter-test',
      platform: 'chatgpt',
      content: 'Keyboard enter test for conversation panel',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'KB Enter Test',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'keyboard enter test');
    await searchResponse;
    await page.waitForTimeout(500);

    // Arrow down to first result, then Enter
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // URL should now contain ?conversation=
    expect(page.url()).toContain('conversation=');
  });

  test('slash key focuses search input from non-input element', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Explicitly blur the input and focus a non-input element
    await page.evaluate(() => {
      const input = document.querySelector('input#search') as HTMLInputElement;
      input?.blur();
      const btn = document.querySelector('button[title="Disconnect / Change API Key"]') as HTMLElement;
      btn?.focus();
    });
    await page.waitForTimeout(100);

    // Verify input is no longer active
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTag).toBe('BUTTON');

    // Press '/' via keyboard
    await page.keyboard.press('/');
    await page.waitForTimeout(300);

    // Debug: check what has focus now
    const debugInfo = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        id: (el as HTMLElement)?.id,
        placeholder: (el as HTMLInputElement)?.placeholder,
        value: (el as HTMLInputElement)?.value,
      };
    });
    // The input should have focus; if '/' ended up as text in input, that's also evidence the focus worked
    const focused = debugInfo.id === 'search' || debugInfo.placeholder === 'Search your history...';
    expect({ focused, debugInfo }).toEqual(expect.objectContaining({ focused: true }));
  });

  test('arrow up from first result moves focus back to search bar', async ({ page, apiKey, request }) => {
    await ingest(request, apiKey, {
      conversation_id: 'kb-nav-up-test',
      platform: 'chatgpt',
      content: 'Keyboard arrow up test returns to search',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'KB Up Test',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'keyboard arrow up test');
    await searchResponse;
    await page.waitForTimeout(500);

    // Navigate down then back up
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // Search input should be focused again
    const isFocused = await page.evaluate(() =>
      document.activeElement?.getAttribute('placeholder') === 'Search your history...'
    );
    expect(isFocused).toBe(true);
  });

  test('escape clears keyboard focus', async ({ page, apiKey, request }) => {
    await ingest(request, apiKey, {
      conversation_id: 'kb-nav-esc-test',
      platform: 'chatgpt',
      content: 'Keyboard escape test clears focus',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'KB Esc Test',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'keyboard escape test');
    await searchResponse;
    await page.waitForTimeout(500);

    // Navigate to first result
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Verify focus ring exists
    let focusedCards = await page.locator('.ring-2.ring-blue-100').count();
    expect(focusedCards).toBeGreaterThan(0);

    // Press escape to clear focus
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Focus ring should be gone
    focusedCards = await page.locator('.ring-2.ring-blue-100').count();
    expect(focusedCards).toBe(0);
  });

  test('keyboard hint is visible in initial state', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Verify keyboard hints are visible
    await expect(page.locator('kbd:has-text("/")')).toBeVisible();
  });
});
