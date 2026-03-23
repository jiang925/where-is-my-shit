/**
 * E2E Tests for Saved Searches Feature
 * Tests saving, retrieving, and managing saved searches.
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test.describe('Saved Searches', () => {
  test('can create a saved search', async ({ request, apiKey, baseURL }) => {
    const response = await request.post(`${baseURL}/api/v1/saved-searches`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        name: 'Python Async Patterns',
        query: 'asyncio patterns',
        filters: { platforms: ['claude-code'], has_code: true },
        digest_enabled: true,
        digest_frequency: 'weekly',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data.name).toBe('Python Async Patterns');
    expect(data).toHaveProperty('query');
    expect(data.query).toBe('asyncio patterns');
    expect(data).toHaveProperty('filters');
    expect(data.filters).toEqual({ platforms: ['claude-code'], has_code: true });
    expect(data).toHaveProperty('digest_enabled');
    expect(data.digest_enabled).toBe(true);
    expect(data).toHaveProperty('digest_frequency');
    expect(data.digest_frequency).toBe('weekly');
  });

  test('can list saved searches', async ({ request, apiKey, baseURL }) => {
    // Create a saved search first
    await request.post(`${baseURL}/api/v1/saved-searches`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        name: 'List Test Search',
        query: 'test query',
        filters: {},
        digest_enabled: false,
      },
    });

    // List saved searches
    const response = await request.get(`${baseURL}/api/v1/saved-searches`, {
      headers: { 'X-API-Key': apiKey },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);

    // If items exist, verify structure
    if (data.items.length > 0) {
      const item = data.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('query');
      expect(item).toHaveProperty('filters');
      expect(item).toHaveProperty('digest_enabled');
      expect(item).toHaveProperty('digest_frequency');
    }
  });

  test('can get a single saved search', async ({ request, apiKey, baseURL }) => {
    // Create a saved search
    const createResponse = await request.post(`${baseURL}/api/v1/saved-searches`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        name: 'Get Test Search',
        query: 'get test',
        filters: {},
      },
    });
    const created = await createResponse.json();

    // Get the saved search
    const response = await request.get(
      `${baseURL}/api/v1/saved-searches/${created.id}`,
      { headers: { 'X-API-Key': apiKey } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data.id).toBe(created.id);
    expect(data.name).toBe('Get Test Search');
  });

  test('returns 404 for non-existent saved search', async ({ request, apiKey, baseURL }) => {
    const response = await request.get(
      `${baseURL}/api/v1/saved-searches/non-existent-id`,
      { headers: { 'X-API-Key': apiKey } }
    );

    expect(response.status()).toBe(404);
  });

  test('can create saved search without digest', async ({ request, apiKey, baseURL }) => {
    const response = await request.post(`${baseURL}/api/v1/saved-searches`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        name: 'No Digest Search',
        query: 'simple search',
        filters: {},
        digest_enabled: false,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.digest_enabled).toBe(false);
  });

  test('saved search API returns correct filter types', async ({ request, apiKey, baseURL }) => {
    // Create with various filter types
    const response = await request.post(`${baseURL}/api/v1/saved-searches`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        name: 'Complex Filters',
        query: 'complex',
        filters: {
          platforms: ['chatgpt', 'claude'],
          date_range: 'this_week',
          has_code: true,
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data.filters).toHaveProperty('platforms');
    expect(Array.isArray(data.filters.platforms)).toBe(true);
    expect(data.filters).toHaveProperty('date_range');
    expect(data.filters).toHaveProperty('has_code');
  });
});
