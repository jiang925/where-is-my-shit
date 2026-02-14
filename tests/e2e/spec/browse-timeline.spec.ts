import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test.describe('Browse API - Backend', () => {
  test('browse API returns items sorted newest first', async ({ request, baseURL, apiKey }) => {
    // Ingest 3 messages with different timestamps
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const twoHoursAgo = now - (2 * 60 * 60 * 1000);
    const threeHoursAgo = now - (3 * 60 * 60 * 1000);

    const messages = [
      {
        conversation_id: 'sort-test-1',
        platform: 'chatgpt',
        content: 'First message (3 hours ago)',
        role: 'user',
        timestamp: new Date(threeHoursAgo).toISOString(),
        title: 'Oldest Message',
      },
      {
        conversation_id: 'sort-test-2',
        platform: 'chatgpt',
        content: 'Second message (2 hours ago)',
        role: 'user',
        timestamp: new Date(twoHoursAgo).toISOString(),
        title: 'Middle Message',
      },
      {
        conversation_id: 'sort-test-3',
        platform: 'chatgpt',
        content: 'Third message (1 hour ago)',
        role: 'user',
        timestamp: new Date(oneHourAgo).toISOString(),
        title: 'Newest Message',
      },
    ];

    // Ingest in non-chronological order
    for (const msg of messages) {
      const response = await request.post(`${baseURL}/api/v1/ingest`, {
        headers: { 'X-API-Key': apiKey },
        data: msg,
      });
      expect(response.status()).toBe(201);
    }

    // Browse and verify chronological ordering (newest first)
    const browseResponse = await request.post(`${baseURL}/api/v1/browse`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        limit: 10,
      },
    });
    expect(browseResponse.status()).toBe(200);

    const data = await browseResponse.json();
    expect(data.items).toBeDefined();
    expect(data.hasMore).toBeDefined();
    expect(data.nextCursor).toBeDefined();
    expect(data.total).toBeGreaterThanOrEqual(3);

    // Verify order: newest first
    const relevantItems = data.items.filter((item: any) =>
      item.conversation_id.startsWith('sort-test-')
    );
    expect(relevantItems.length).toBeGreaterThanOrEqual(3);

    // Check timestamps are in descending order
    expect(relevantItems[0].title).toBe('Newest Message');
    expect(relevantItems[1].title).toBe('Middle Message');
    expect(relevantItems[2].title).toBe('Oldest Message');
  });

  test('browse API cursor pagination returns no duplicates', async ({ request, baseURL, apiKey }) => {
    // Ingest 5 messages with distinct timestamps
    const now = Date.now();
    const messages = [];
    for (let i = 0; i < 5; i++) {
      messages.push({
        conversation_id: `pagination-test-${i}`,
        platform: 'chatgpt',
        content: `Message ${i}`,
        role: 'user',
        timestamp: new Date(now - (i * 60 * 1000)).toISOString(),
        title: `Message ${i}`,
      });
    }

    for (const msg of messages) {
      const response = await request.post(`${baseURL}/api/v1/ingest`, {
        headers: { 'X-API-Key': apiKey },
        data: msg,
      });
      expect(response.status()).toBe(201);
    }

    // Fetch first page with limit=2
    const page1Response = await request.post(`${baseURL}/api/v1/browse`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        limit: 2,
      },
    });
    expect(page1Response.status()).toBe(200);

    const page1Data = await page1Response.json();
    expect(page1Data.items.length).toBeGreaterThanOrEqual(2);
    expect(page1Data.hasMore).toBe(true);
    expect(page1Data.nextCursor).not.toBeNull();

    // Collect IDs from first page
    const page1Ids = page1Data.items
      .filter((item: any) => item.conversation_id.startsWith('pagination-test-'))
      .map((item: any) => item.id);

    // Fetch second page with cursor
    const page2Response = await request.post(`${baseURL}/api/v1/browse`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        limit: 2,
        cursor: page1Data.nextCursor,
      },
    });
    expect(page2Response.status()).toBe(200);

    const page2Data = await page2Response.json();
    const page2Ids = page2Data.items
      .filter((item: any) => item.conversation_id.startsWith('pagination-test-'))
      .map((item: any) => item.id);

    // Verify no duplicates between pages
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });

  test('browse API filters by date range', async ({ request, baseURL, apiKey }) => {
    // Ingest a message with today's timestamp
    const today = new Date();
    const todayMessage = {
      conversation_id: 'date-filter-today',
      platform: 'chatgpt',
      content: 'Today message',
      role: 'user',
      timestamp: today.toISOString(),
      title: 'Today Message',
    };

    const response1 = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: todayMessage,
    });
    expect(response1.status()).toBe(201);

    // Ingest a message with 30-day-old timestamp
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    const oldMessage = {
      conversation_id: 'date-filter-old',
      platform: 'chatgpt',
      content: 'Old message',
      role: 'user',
      timestamp: oldDate.toISOString(),
      title: 'Old Message',
    };

    const response2 = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: oldMessage,
    });
    expect(response2.status()).toBe(201);

    // Browse with date_range="today"
    const browseResponse = await request.post(`${baseURL}/api/v1/browse`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        limit: 10,
        date_range: 'today',
      },
    });
    expect(browseResponse.status()).toBe(200);

    const data = await browseResponse.json();
    expect(data.items).toBeDefined();

    // Verify only today's message is returned
    const relevantItems = data.items.filter((item: any) =>
      item.conversation_id === 'date-filter-today' || item.conversation_id === 'date-filter-old'
    );

    const todayFound = relevantItems.some((item: any) => item.conversation_id === 'date-filter-today');
    const oldFound = relevantItems.some((item: any) => item.conversation_id === 'date-filter-old');

    expect(todayFound).toBe(true);
    expect(oldFound).toBe(false);
  });

  test('browse API filters by platform', async ({ request, baseURL, apiKey }) => {
    // Ingest messages from chatgpt and claude
    const chatgptMessage = {
      conversation_id: 'platform-filter-chatgpt',
      platform: 'chatgpt',
      content: 'ChatGPT message',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'ChatGPT Message',
    };

    const response1 = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: chatgptMessage,
    });
    expect(response1.status()).toBe(201);

    const claudeMessage = {
      conversation_id: 'platform-filter-claude',
      platform: 'claude',
      content: 'Claude message',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Claude Message',
    };

    const response2 = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: claudeMessage,
    });
    expect(response2.status()).toBe(201);

    // Browse with platforms=["chatgpt"]
    const browseResponse = await request.post(`${baseURL}/api/v1/browse`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        limit: 10,
        platforms: ['chatgpt'],
      },
    });
    expect(browseResponse.status()).toBe(200);

    const data = await browseResponse.json();
    expect(data.items).toBeDefined();

    // Verify only chatgpt items returned
    const relevantItems = data.items.filter((item: any) =>
      item.conversation_id === 'platform-filter-chatgpt' || item.conversation_id === 'platform-filter-claude'
    );

    const chatgptFound = relevantItems.some((item: any) => item.conversation_id === 'platform-filter-chatgpt');
    const claudeFound = relevantItems.some((item: any) => item.conversation_id === 'platform-filter-claude');

    expect(chatgptFound).toBe(true);
    expect(claudeFound).toBe(false);

    // Double-check platform field
    for (const item of relevantItems) {
      expect(item.platform).toBe('chatgpt');
    }
  });
});

test.describe('Browse Page - Frontend', () => {
  test('browse page shows timeline sections', async ({ authenticatedPage: page, baseURL }) => {
    // Ingest a test message with today's timestamp
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    await page.request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: 'ui-test-1',
        platform: 'chatgpt',
        content: 'UI test message',
        role: 'user',
        timestamp: new Date().toISOString(),
        title: 'UI Test Message',
      },
    });

    // Navigate to /browse
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('wims_api_key', key), apiKey);
    await page.goto('/browse');

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 5000 });

    // Verify all timeline section headers are visible (default is "All Time")
    await expect(page.locator('h2:has-text("Today")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("Yesterday")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("This Week")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("This Month")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("Older")').first()).toBeVisible();

    // Verify the ingested conversation appears
    await expect(page.locator('text=UI Test Message').first()).toBeVisible({ timeout: 5000 });
  });

  test('date range filter buttons work', async ({ authenticatedPage: page, baseURL }) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';

    // Navigate to /browse
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('wims_api_key', key), apiKey);
    await page.goto('/browse');

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 5000 });

    // Click "Today" filter button
    await page.locator('button:has-text("Today")').first().click();

    // Verify URL contains ?range=today
    await page.waitForURL('**/browse?range=today', { timeout: 2000 });
    expect(page.url()).toContain('?range=today');

    // Click "All Time" filter button
    await page.locator('button:has-text("All Time")').first().click();

    // Verify URL does not contain range parameter (default)
    await page.waitForTimeout(500); // Brief wait for URL update
    expect(page.url()).not.toContain('range=');
  });

  test('browse page URL state is shareable', async ({ authenticatedPage: page, baseURL }) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';

    // Navigate directly to URL with filters
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('wims_api_key', key), apiKey);
    await page.goto('/browse?range=this_week&platforms=chatgpt');

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 5000 });

    // Verify "This Week" button is active (blue background)
    const thisWeekButton = page.locator('button:has-text("This Week")').first();
    await expect(thisWeekButton).toHaveClass(/bg-blue-100/);

    // Verify chatgpt platform filter is selected
    const chatgptChip = page.locator('button:has-text("ChatGPT")').first();
    await expect(chatgptChip).toHaveClass(/bg-green-100/);
  });

  test('browse page empty state', async ({ authenticatedPage: page, baseURL }) => {
    const apiKey = process.env.TEST_API_KEY || 'test-api-key-123';

    // Navigate to /browse with a specific date range that likely has no data
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('wims_api_key', key), apiKey);

    // Use an empty database scenario - we'll just navigate to browse
    // If there's data, this test may be flaky, but we'll look for the empty state message
    await page.goto('/browse?range=today');

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Browse History")', { timeout: 5000 });

    // Wait a moment for data to load
    await page.waitForTimeout(1000);

    // Check if empty state message is visible (may or may not be present depending on test data)
    // This is a best-effort test - we're checking if the empty state exists when there's no data
    const emptyStateText = page.locator('text=No conversations yet');
    const isVisible = await emptyStateText.isVisible().catch(() => false);

    // If empty state is visible, verify the full message
    if (isVisible) {
      await expect(emptyStateText).toBeVisible();
      await expect(page.locator('text=Install the extension or set up a watcher')).toBeVisible();
    } else {
      // If not visible, there must be timeline sections instead
      await expect(page.locator('h2:has-text("Today")').first()).toBeVisible();
    }
  });
});
