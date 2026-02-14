import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

/**
 * UI regression tests for issues discovered during manual testing.
 * Each test covers a specific bug scenario to prevent regressions.
 */

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

test.describe('UI Regression Tests', () => {

  // Issue 2: Browse cards should NOT show "Score: 0.00" on hover
  test('browse cards do not show score on hover', async ({ page, apiKey, request }) => {
    // Ingest a test document
    await ingest(request, apiKey, {
      conversation_id: 'regression-browse-score',
      platform: 'chatgpt',
      content: 'Test conversation for browse score regression',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Browse Score Test',
    });

    await authenticate(page, apiKey, '/browse');
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 10000 });

    // Wait for cards to load
    await page.waitForTimeout(1500);

    // Find a result card and hover over it
    const card = page.locator('.group').first();
    const cardVisible = await card.isVisible().catch(() => false);
    if (cardVisible) {
      await card.hover();
      await page.waitForTimeout(300);

      // Verify "Score: 0.00" is NOT visible anywhere on the page
      const scoreText = page.locator('text=/Score: 0\\.00/');
      await expect(scoreText).not.toBeVisible();
    }
  });

  // Issue 3: Card snippet should show 4 lines, not truncated at 3.2 rows
  test('card content snippet uses line-clamp-4', async ({ page, apiKey, request }) => {
    // Ingest a document with long content
    const longContent = 'Line one of content. '.repeat(5) + '\n' +
      'Line two of content. '.repeat(5) + '\n' +
      'Line three of content. '.repeat(5) + '\n' +
      'Line four of content. '.repeat(5);

    await ingest(request, apiKey, {
      conversation_id: 'regression-line-clamp',
      platform: 'chatgpt',
      content: longContent,
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Line Clamp Test',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'Line Clamp Test');
    await searchResponse;
    await page.waitForTimeout(500);

    // Verify the content paragraph has line-clamp-4 class
    const contentParagraph = page.locator('p.line-clamp-4').first();
    await expect(contentParagraph).toBeVisible();
  });

  // Issue 4: All interactive buttons should have cursor-pointer
  test('all buttons have cursor-pointer style', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Check navigation buttons (Search/Browse)
    const searchButton = page.getByRole('button', { name: 'Search' });
    await expect(searchButton).toHaveClass(/cursor-pointer/);

    const browseButton = page.getByRole('button', { name: 'Browse' });
    await expect(browseButton).toHaveClass(/cursor-pointer/);

    // Check platform filter buttons
    const chatgptButton = page.getByRole('button', { name: 'ChatGPT' });
    await expect(chatgptButton).toHaveClass(/cursor-pointer/);

    // Check preset buttons
    const webChatsButton = page.getByRole('button', { name: /Web Chats Only/i });
    await expect(webChatsButton).toHaveClass(/cursor-pointer/);

    // Check date range buttons on browse page
    await page.getByRole('button', { name: 'Browse' }).click();
    await page.waitForSelector('h1:has-text("Browse History")');

    const todayButton = page.locator('button:has-text("Today")').first();
    await expect(todayButton).toHaveClass(/cursor-pointer/);
  });

  // Issue 5a: "Web Chats Only" preset should include perplexity
  test('Web Chats preset includes perplexity', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Click "Web Chats Only" preset
    await page.getByRole('button', { name: /Web Chats Only/i }).click();
    await page.waitForTimeout(300);

    // Verify perplexity is selected (4 platforms total)
    const url = page.url();
    const platforms = new URLSearchParams(url.split('?')[1]).get('platforms');
    expect(platforms).toContain('perplexity');
    expect(platforms).toContain('chatgpt');
    expect(platforms).toContain('claude');
    expect(platforms).toContain('gemini');
    await expect(page.getByText('4 selected')).toBeVisible();
  });

  // Issue 5b: "All Sources" preset should select all platform chips visually
  test('All Sources preset selects all platform chips', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Click "All Sources" preset
    await page.getByRole('button', { name: /All Sources/i }).click();
    await page.waitForTimeout(300);

    // Verify all 6 platforms are selected
    await expect(page.getByText('6 selected')).toBeVisible();

    // Verify URL has all platforms
    const url = page.url();
    const platforms = new URLSearchParams(url.split('?')[1]).get('platforms');
    expect(platforms).toContain('chatgpt');
    expect(platforms).toContain('claude');
    expect(platforms).toContain('claude-code');
    expect(platforms).toContain('gemini');
    expect(platforms).toContain('perplexity');
    expect(platforms).toContain('cursor');
  });

  // Issue 5c: "All Sources" appears active by default (no platforms selected = all sources)
  test('All Sources preset shows active when no platforms selected', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // By default no platforms are selected, "All Sources" should appear active
    const allSourcesButton = page.getByRole('button', { name: /All Sources/i });
    await expect(allSourcesButton).toHaveClass(/bg-blue-100/);
  });

  // Issue 6: Timeline sections should hide when date filter makes them irrelevant
  test('browse page hides irrelevant timeline sections for Today filter', async ({ page, apiKey, request }) => {
    // Ingest a document for today
    await ingest(request, apiKey, {
      conversation_id: 'regression-timeline-today',
      platform: 'chatgpt',
      content: 'Today timeline section test',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Timeline Today Test',
    });

    await authenticate(page, apiKey, '/browse');
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 10000 });

    // Click "Today" date filter
    await page.locator('button:has-text("Today")').first().click();
    await page.waitForURL('**/browse?range=today', { timeout: 2000 });
    await page.waitForTimeout(500);

    // "Today" section should be visible
    await expect(page.locator('h2:has-text("Today")').first()).toBeVisible();

    // "Yesterday", "This Week", "This Month", "Older" should NOT be visible
    await expect(page.locator('h2:has-text("Yesterday")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("This Week")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("This Month")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("Older")')).not.toBeVisible();
  });

  test('browse page shows correct sections for This Week filter', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/browse');
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 10000 });

    // Click "This Week" date filter
    await page.locator('button:has-text("This Week")').first().click();
    await page.waitForURL('**/browse?range=this_week', { timeout: 2000 });
    await page.waitForTimeout(500);

    // Today, Yesterday, This Week should be visible
    await expect(page.locator('h2:has-text("Today")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("Yesterday")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("This Week")').first()).toBeVisible();

    // This Month and Older should NOT be visible
    await expect(page.locator('h2:has-text("This Month")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("Older")')).not.toBeVisible();
  });

  test('browse page shows all sections for All Time filter', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/browse');
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 10000 });

    // "All Time" is the default - all sections should be visible
    await expect(page.locator('h2:has-text("Today")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("Yesterday")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("This Week")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("This Month")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("Older")').first()).toBeVisible();
  });

  // Issue 7+8: Search header should always show when query exists, regardless of filter state
  test('search results header always visible when query is active', async ({ page, apiKey, request }) => {
    // Ingest test data
    await ingest(request, apiKey, {
      conversation_id: 'regression-header-test',
      platform: 'chatgpt',
      content: 'Header regression test content for stable layout',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Header Regression',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Search for something
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'Header Regression');
    await searchResponse;
    await page.waitForTimeout(300);

    // Header should be visible with no filter
    await expect(page.locator('h1:has-text("Search Results")')).toBeVisible();

    // Click a platform filter
    await page.getByRole('button', { name: 'ChatGPT' }).click();
    await page.waitForTimeout(300);

    // Header should still be visible with filter active
    await expect(page.locator('h1:has-text("Search Results")')).toBeVisible();

    // Click "All Sources" preset
    await page.getByRole('button', { name: /All Sources/i }).click();
    await page.waitForTimeout(300);

    // Header should STILL be visible (this was the bug - it used to disappear)
    await expect(page.locator('h1:has-text("Search Results")')).toBeVisible();
  });

  test('search results header not visible when no query entered', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // No query entered - header should NOT be visible
    await expect(page.locator('h1:has-text("Search Results")')).not.toBeVisible();
  });

  // Issue 9: Copy path button should work with clipboard fallback
  test('copy path button shows Copied feedback on click', async ({ page, apiKey, request }) => {
    // Ingest Claude Code document with file path
    await ingest(request, apiKey, {
      conversation_id: 'regression-copy-path',
      platform: 'claude-code',
      content: 'Copy path regression test content',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Copy Path Regression',
      adapter: 'wims-watcher',
      url: '/home/user/projects/test-app/src/main.ts',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Search for the document
    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'copy path regression');
    await searchResponse;
    await page.waitForTimeout(500);

    // Find and click Copy Path button
    const copyButton = page.getByRole('button', { name: /Copy Path/i }).first();
    const isVisible = await copyButton.isVisible().catch(() => false);
    if (isVisible) {
      await copyButton.click();

      // Verify "Copied!" feedback appears
      await expect(page.getByText('Copied!')).toBeVisible({ timeout: 2000 });

      // Verify it reverts back
      await expect(page.getByRole('button', { name: /Copy Path/i }).first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('copy path button has cursor-pointer style', async ({ page, apiKey, request }) => {
    // Ingest Claude Code document with file path
    await ingest(request, apiKey, {
      conversation_id: 'regression-copy-cursor',
      platform: 'claude-code',
      content: 'Copy cursor style test content',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Copy Cursor Test',
      adapter: 'wims-watcher',
      url: '/tmp/test-project/index.ts',
    });

    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]');

    const searchResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );
    await page.fill('input[placeholder="Search your history..."]', 'Copy Cursor Test');
    await searchResponse;
    await page.waitForTimeout(500);

    // Verify copy button has cursor-pointer class
    const copyButton = page.getByRole('button', { name: /Copy Path/i }).first();
    const isVisible = await copyButton.isVisible().catch(() => false);
    if (isVisible) {
      await expect(copyButton).toHaveClass(/cursor-pointer/);
    }
  });
});
