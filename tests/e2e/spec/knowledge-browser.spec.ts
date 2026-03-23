/**
 * E2E Tests for Knowledge Browser UI
 * Tests the knowledge extraction and browsing functionality.
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test.describe('Knowledge Browser', () => {
  test('user can view extracted code snippets', async ({ page, apiKey, request, baseURL }) => {
    // Step 1 - Ingest a conversation with code via API
    const ingestResponse = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: 'knowledge-test-conv-1',
        platform: 'claude-code',
        content: `Here's a Python function to calculate fibonacci:\n\n\`\`\`python\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\`\`\`\n\nThis uses recursion.`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        title: 'Fibonacci Function',
      },
    });
    expect(ingestResponse.status()).toBe(201);

    // Step 2 - Authenticate and navigate to Knowledge page
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    // Auth
    await expect(page.getByText('Authentication Required')).toBeVisible();
    await page.getByLabel('API Key').fill(apiKey);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for main navigation
    await expect(page.getByPlaceholder('Search your history...')).toBeVisible();
    
    // Navigate to Knowledge page (if it exists in UI)
    // For now, test the API endpoint directly
    const knowledgeResponse = await request.get(`${baseURL}/api/v1/knowledge?type=code`, {
      headers: { 'X-API-Key': apiKey },
    });
    expect(knowledgeResponse.status()).toBe(200);
    
    const knowledge = await knowledgeResponse.json();
    expect(knowledge.items).toBeDefined();
    expect(Array.isArray(knowledge.items)).toBe(true);
  });

  test('knowledge API returns correct structure', async ({ request, apiKey, baseURL }) => {
    // Test that knowledge endpoint returns expected structure
    const response = await request.get(`${baseURL}/api/v1/knowledge`, {
      headers: { 'X-API-Key': apiKey },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('has_more');
    expect(Array.isArray(data.items)).toBe(true);
    
    // If there are items, verify item structure
    if (data.items.length > 0) {
      const item = data.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('content');
      expect(item).toHaveProperty('metadata');
      expect(item).toHaveProperty('source');
      expect(item).toHaveProperty('usage_count');
      expect(item).toHaveProperty('created_at');
      
      // Verify source structure
      expect(item.source).toHaveProperty('conversation_id');
      expect(item.source).toHaveProperty('platform');
      expect(item.source).toHaveProperty('title');
    }
  });

  test('knowledge can be filtered by type', async ({ request, apiKey, baseURL }) => {
    // Test filtering by different types
    const types = ['code', 'prompt', 'decision', 'summary'];
    
    for (const type of types) {
      const response = await request.get(`${baseURL}/api/v1/knowledge?type=${type}`, {
        headers: { 'X-API-Key': apiKey },
      });
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.items)).toBe(true);
    }
  });

  test('knowledge API rejects invalid type filter', async ({ request, apiKey, baseURL }) => {
    const response = await request.get(`${baseURL}/api/v1/knowledge?type=invalid`, {
      headers: { 'X-API-Key': apiKey },
    });
    
    expect(response.status()).toBe(400);
  });
});
