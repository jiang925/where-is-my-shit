import { test, expect } from '../fixtures/auth';
import { test as dbTest } from '../fixtures/database';

// Test auth fixture - page should have X-API-Key header
test('authenticatedPage injects API key header', async ({ authenticatedPage, request, baseURL }) => {
  // This endpoint requires API key - if header missing, should return 403
  const response = await request.post(`${baseURL}/api/v1/search`, {
    data: { query: 'test', limit: 1 },
  });

  // With auth fixture, this should succeed (or fail for different reasons, not auth)
  // The key point is it doesn't fail with 403 Forbidden
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
