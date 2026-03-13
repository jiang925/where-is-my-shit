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

test.describe('Stats Page', () => {

  test('stats page loads and shows Statistics header', async ({ page, apiKey }) => {
    await authenticate(page, apiKey, '/stats');

    // Wait for the Statistics heading to appear
    await expect(page.locator('h1:has-text("Statistics")')).toBeVisible({ timeout: 10000 });
  });

  test('stats page shows summary cards after ingesting data', async ({ page, apiKey, request }) => {
    // Ingest test data so stats have something to report
    await ingest(request, apiKey, {
      conversation_id: 'stats-test-conv-1',
      platform: 'chatgpt',
      content: 'Stats page test message one',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Stats Test 1',
    });
    await ingest(request, apiKey, {
      conversation_id: 'stats-test-conv-2',
      platform: 'claude',
      content: 'Stats page test message two',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Stats Test 2',
    });

    await authenticate(page, apiKey, '/stats');
    await expect(page.locator('h1:has-text("Statistics")')).toBeVisible({ timeout: 10000 });

    // Wait for the stats API response to complete
    await page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/stats') && res.status() === 200,
      { timeout: 10000 },
    );
    // Brief wait for React to render
    await page.waitForTimeout(500);

    // Verify summary cards are visible
    await expect(page.getByText('Total Conversations')).toBeVisible();
    await expect(page.getByText('Total Messages')).toBeVisible();
  });

  test('stats page shows platform breakdown chart', async ({ page, apiKey, request }) => {
    // Ingest data across multiple platforms
    await ingest(request, apiKey, {
      conversation_id: 'stats-platform-chatgpt',
      platform: 'chatgpt',
      content: 'Platform breakdown test chatgpt',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Stats Platform ChatGPT',
    });
    await ingest(request, apiKey, {
      conversation_id: 'stats-platform-claude',
      platform: 'claude',
      content: 'Platform breakdown test claude',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Stats Platform Claude',
    });

    await authenticate(page, apiKey, '/stats');
    await expect(page.locator('h1:has-text("Statistics")')).toBeVisible({ timeout: 10000 });

    // Wait for stats data to load
    await page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/stats') && res.status() === 200,
      { timeout: 10000 },
    );
    await page.waitForTimeout(500);

    // Verify platform breakdown heading is present
    await expect(page.getByText('Conversations by Platform')).toBeVisible();

    // Verify activity over time heading is present
    await expect(page.getByText('Activity Over Time')).toBeVisible();
  });

  test('granularity selector cycles through Day, Week, Month', async ({ page, apiKey, request }) => {
    // Ingest at least one message so stats are not empty
    await ingest(request, apiKey, {
      conversation_id: 'stats-granularity-test',
      platform: 'chatgpt',
      content: 'Granularity selector test message',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Granularity Test',
    });

    await authenticate(page, apiKey, '/stats');
    await expect(page.locator('h1:has-text("Statistics")')).toBeVisible({ timeout: 10000 });

    // Wait for initial data load
    await page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/stats') && res.status() === 200,
      { timeout: 10000 },
    );

    // Verify all three granularity buttons exist
    const dayButton = page.locator('button:has-text("Day")');
    const weekButton = page.locator('button:has-text("Week")');
    const monthButton = page.locator('button:has-text("Month")');

    await expect(dayButton).toBeVisible();
    await expect(weekButton).toBeVisible();
    await expect(monthButton).toBeVisible();

    // Day should be active by default (bg-blue-600 class)
    await expect(dayButton).toHaveClass(/bg-blue-600/);

    // Click Week and verify it becomes active
    const weekResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/stats') && res.url().includes('granularity=week'),
      { timeout: 10000 },
    );
    await weekButton.click();
    await weekResponse;
    await expect(weekButton).toHaveClass(/bg-blue-600/);
    await expect(dayButton).not.toHaveClass(/bg-blue-600/);

    // Click Month and verify it becomes active
    const monthResponse = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/stats') && res.url().includes('granularity=month'),
      { timeout: 10000 },
    );
    await monthButton.click();
    await monthResponse;
    await expect(monthButton).toHaveClass(/bg-blue-600/);
    await expect(weekButton).not.toHaveClass(/bg-blue-600/);
  });

  test('stats API returns valid data structure', async ({ request, apiKey, baseURL }) => {
    // Ingest a message so stats are non-empty
    await ingest(request, apiKey, {
      conversation_id: 'stats-api-structure-test',
      platform: 'chatgpt',
      content: 'Stats API structure test message',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Stats API Test',
    });

    // Call the stats API directly
    const response = await request.get(`${baseURL}/api/v1/stats?granularity=day`, {
      headers: { 'X-API-Key': apiKey },
    });
    expect(response.status()).toBe(200);

    const data = await response.json();

    // Validate response structure
    expect(data.total_messages).toBeDefined();
    expect(data.total_conversations).toBeDefined();
    expect(data.by_platform).toBeDefined();
    expect(data.conversations_by_platform).toBeDefined();
    expect(data.activity).toBeDefined();

    // Counts should be positive (we just ingested data)
    expect(data.total_messages).toBeGreaterThan(0);
    expect(data.total_conversations).toBeGreaterThan(0);

    // Activity should be an array of entries
    expect(Array.isArray(data.activity)).toBe(true);
    expect(data.activity.length).toBeGreaterThan(0);

    // Each activity entry should have date and count
    for (const entry of data.activity) {
      expect(entry.date).toBeDefined();
      expect(typeof entry.count).toBe('number');
    }
  });
});
