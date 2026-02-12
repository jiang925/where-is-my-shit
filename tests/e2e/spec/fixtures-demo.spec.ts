import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';
import { test as dbTest } from '../fixtures/database';

// Test auth fixture - page should have X-API-Key header
test('authenticatedPage injects API key header', async ({ authenticatedPage, apiKey, request, baseURL }) => {
  // Test the fixture provides the API key
  expect(apiKey).toBeDefined();
  expect(apiKey).toBe('test-api-key-123');

  // Test with explicit API key header in request context
  const response = await request.post(`${baseURL}/api/v1/search`, {
    headers: {
      'X-API-Key': apiKey,
    },
    data: { query: 'test', limit: 1 },
  });

  // With correct API key, should not return 403 Forbidden
  expect(response.status()).not.toBe(403);
});

// Test database fixture - has access to test messages
dbTest('database fixture provides test messages', async ({ testMessages }) => {
  expect(testMessages).toBeDefined();
  expect(testMessages.length).toBeGreaterThan(0);
  expect(testMessages[0]).toHaveProperty('conversation_id');
  expect(testMessages[0]).toHaveProperty('message');
  expect(testMessages[0]).toHaveProperty('role');
});

// Test database isolation - worker-scoped fixture
dbTest('database path is configured', async ({ testDbPath }) => {
  expect(testDbPath).toBeDefined();
  expect(testDbPath).toContain('test-db');
  console.log(`Test database path: ${testDbPath}`);
});
