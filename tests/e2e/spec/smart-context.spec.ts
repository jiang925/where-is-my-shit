/**
 * E2E Tests for Smart Context Feature
 * Tests the related conversations functionality.
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test.describe('Smart Context', () => {
  test('related conversations endpoint returns valid structure', async ({ request, apiKey, baseURL }) => {
    // First ingest two related conversations
    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: 'smart-context-conv-1',
        platform: 'chatgpt',
        content: 'How do I implement authentication in FastAPI using JWT tokens?',
        role: 'user',
        timestamp: new Date().toISOString(),
        title: 'FastAPI Authentication',
      },
    });

    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: 'smart-context-conv-2',
        platform: 'claude',
        content: 'FastAPI JWT middleware setup and token validation patterns',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        title: 'JWT Middleware Guide',
      },
    });

    // Get related conversations for conv-1
    const response = await request.get(
      `${baseURL}/api/v1/conversations/smart-context-conv-1/related`,
      { headers: { 'X-API-Key': apiKey } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('conversation_id');
    expect(data).toHaveProperty('related');
    expect(Array.isArray(data.related)).toBe(true);
    expect(data.conversation_id).toBe('smart-context-conv-1');

    // If related items exist, verify structure
    if (data.related.length > 0) {
      const related = data.related[0];
      expect(related).toHaveProperty('conversation_id');
      expect(related).toHaveProperty('platform');
      expect(related).toHaveProperty('title');
      expect(related).toHaveProperty('similarity_score');
      expect(typeof related.similarity_score).toBe('number');
      expect(related.similarity_score).toBeGreaterThanOrEqual(0);
      expect(related.similarity_score).toBeLessThanOrEqual(1);
    }
  });

  test('related conversations respects limit parameter', async ({ request, apiKey, baseURL }) => {
    const response = await request.get(
      `${baseURL}/api/v1/conversations/non-existent/related?limit=2`,
      { headers: { 'X-API-Key': apiKey } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.related)).toBe(true);
    // Should return empty array or at most 2 items
    expect(data.related.length).toBeLessThanOrEqual(2);
  });

  test('search with related context works end-to-end', async ({ page, apiKey, request, baseURL }) => {
    // Setup: Ingest test data
    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: 'e2e-context-conv',
        platform: 'chatgpt',
        content: 'React hooks best practices and patterns for state management',
        role: 'user',
        timestamp: new Date().toISOString(),
        title: 'React Hooks Guide',
      },
    });

    // Navigate and authenticate
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.getByLabel('API Key').fill(apiKey);
    await page.getByRole('button', { name: 'Connect' }).click();

    // Wait for search interface
    await expect(page.getByPlaceholder('Search your history...')).toBeVisible();

    // Perform search
    const searchResponse = page.waitForResponse(
      res => res.url().includes('/api/v1/search') && res.status() === 200
    );

    await page.getByPlaceholder('Search your history...').fill('React hooks');
    const response = await searchResponse;
    const data = await response.json();

    // Verify search results
    expect(data.groups).toBeDefined();
    expect(data.count).toBeGreaterThan(0);

    // Verify results appear in UI
    await expect(page.getByText('React').first()).toBeVisible();
  });
});
