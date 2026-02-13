import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test.describe('Backend Platform Filtering', () => {
  test('accepts single platform string (backward compatibility)', async ({ request, baseURL, apiKey }) => {
    // Setup: Ingest test data with different platforms
    const chatgptData = {
      conversation_id: 'filter-test-1',
      platform: 'chatgpt',
      content: 'ChatGPT conversation about API design',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'API Design Discussion',
    };

    const ingestResponse1 = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: chatgptData,
    });
    expect(ingestResponse1.status()).toBe(201);

    const claudeData = {
      conversation_id: 'filter-test-2',
      platform: 'claude',
      content: 'Claude conversation about database optimization',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Database Discussion',
    };

    const ingestResponse2 = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: claudeData,
    });
    expect(ingestResponse2.status()).toBe(201);

    // Test: Search with single platform string
    const searchResponse = await request.post(`${baseURL}/api/v1/search`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'conversation',
        limit: 10,
        platform: 'chatgpt',  // String (backward compatibility)
      },
    });
    expect(searchResponse.status()).toBe(200);

    const data = await searchResponse.json();
    expect(data.groups).toBeDefined();
    expect(data.count).toBeGreaterThan(0);

    // Verify all results are from chatgpt platform
    for (const group of data.groups) {
      for (const result of group.results) {
        expect(result.meta.source).toBe('chatgpt');
      }
    }
  });

  test('filters by list of platform strings', async ({ request, baseURL, apiKey }) => {
    // Setup: Ingest test data with different platforms
    const platforms = ['chatgpt', 'gemini', 'claude-code'];

    for (const platform of platforms) {
      const ingestResponse = await request.post(`${baseURL}/api/v1/ingest`, {
        headers: { 'X-API-Key': apiKey },
        data: {
          conversation_id: `multi-filter-${platform}`,
          platform,
          content: `${platform} conversation about testing`,
          role: 'user',
          timestamp: new Date().toISOString(),
          title: `${platform} Testing`,
        },
      });
      expect(ingestResponse.status()).toBe(201);
    }

    // Test: Search with multiple platforms (OR logic)
    const searchResponse = await request.post(`${baseURL}/api/v1/search`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'conversation',
        limit: 10,
        platform: ['chatgpt', 'gemini'],  // Array (new functionality)
      },
    });
    expect(searchResponse.status()).toBe(200);

    const data = await searchResponse.json();
    expect(data.groups).toBeDefined();
    expect(data.count).toBeGreaterThan(0);

    // Verify results are only from chatgpt or gemini
    for (const group of data.groups) {
      for (const result of group.results) {
        expect(['chatgpt', 'gemini']).toContain(result.meta.source);
      }
    }
  });

  test('filters out invalid platform values', async ({ request, baseURL, apiKey }) => {
    // Setup: Ingest valid platform data
    const ingestResponse = await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: 'invalid-filter-test',
        platform: 'chatgpt',
        content: 'Valid chatgpt conversation',
        role: 'user',
        timestamp: new Date().toISOString(),
        title: 'Valid Platform Test',
      },
    });
    expect(ingestResponse.status()).toBe(201);

    // Test: Search with mixed valid and invalid platforms
    const searchResponse = await request.post(`${baseURL}/api/v1/search`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'conversation',
        limit: 10,
        platform: ['chatgpt', 'invalid-platform', 'malicious-sql'],  // Includes invalid values
      },
    });
    expect(searchResponse.status()).toBe(200);

    const data = await searchResponse.json();
    // Should only return chatgpt results (invalid platforms filtered out)
    if (data.count > 0) {
      for (const group of data.groups) {
        for (const result of group.results) {
          expect(result.meta.source).toBe('chatgpt');
        }
      }
    }
  });

  test('returns all results when no platform filter provided', async ({ request, baseURL, apiKey }) => {
    // Setup: Ingest multiple platforms
    const platforms = ['chatgpt', 'claude', 'gemini'];

    for (const platform of platforms) {
      const ingestResponse = await request.post(`${baseURL}/api/v1/ingest`, {
        headers: { 'X-API-Key': apiKey },
        data: {
          conversation_id: `no-filter-${platform}`,
          platform,
          content: `${platform} conversation without filter`,
          role: 'user',
          timestamp: new Date().toISOString(),
          title: `No Filter Test - ${platform}`,
        },
      });
      expect(ingestResponse.status()).toBe(201);
    }

    // Test: Search without platform filter
    const searchResponse = await request.post(`${baseURL}/api/v1/search`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'conversation',
        limit: 10,
        platform: undefined,  // No filter
      },
    });
    expect(searchResponse.status()).toBe(200);

    const data = await searchResponse.json();
    expect(data.count).toBeGreaterThan(0);

    // Verify results include all platforms
    const foundPlatforms = new Set();
    for (const group of data.groups) {
      for (const result of group.results) {
        foundPlatforms.add(result.meta.source);
      }
    }

    // Should have at least some platforms present
    expect(foundPlatforms.size).toBeGreaterThan(0);
  });

  test('handles conversation_id filter with platform filter', async ({ request, baseURL, apiKey }) => {
    // Setup: Ingest test data
    const conv1Data = {
      conversation_id: 'combined-filter-1',
      platform: 'chatgpt',
      content: 'Conversation 1 from chatgpt',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Combined Filter Test 1',
    };

    const conv2Data = {
      conversation_id: 'combined-filter-2',
      platform: 'claude',
      content: 'Conversation 2 from claude',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Combined Filter Test 2',
    };

    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: conv1Data,
    });

    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: conv2Data,
    });

    // Test: Search with both conversation_id and platform filters (AND logic)
    const searchResponse = await request.post(`${baseURL}/api/v1/search`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'conversation',
        limit: 10,
        conversation_id: 'combined-filter-1',
        platform: 'chatgpt',
      },
    });
    expect(searchResponse.status()).toBe(200);

    const data = await searchResponse.json();
    expect(data.groups).toBeDefined();

    // Verify results match both filters
    if (data.count > 0) {
      for (const group of data.groups) {
        expect(group.conversation_id).toBe('combined-filter-1');
        for (const result of group.results) {
          expect(result.meta.source).toBe('chatgpt');
        }
      }
    }
  });
});
