import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

async function authenticate(page: any, apiKey: string, path: string = '/') {
  await page.goto('/');
  await page.evaluate((key: string) => localStorage.setItem('wims_api_key', key), apiKey);
  await page.goto(path);
}

async function ingest(request: any, apiKey: string, data: Record<string, any>) {
  const response = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data,
  });
  expect(response.status()).toBe(201);
}

test.describe('Search Operators', () => {

  test('from: filter returns only matching platform results', async ({ request, apiKey }) => {
    // Ingest a chatgpt message
    await ingest(request, apiKey, {
      conversation_id: 'op-from-test-chatgpt',
      platform: 'chatgpt',
      content: 'Kubernetes cluster orchestration and pod scheduling strategies',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'K8s From Filter Test - ChatGPT',
    });

    // Ingest a claude message with similar content
    await ingest(request, apiKey, {
      conversation_id: 'op-from-test-claude',
      platform: 'claude',
      content: 'Kubernetes deployment manifests and service mesh configuration',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'K8s From Filter Test - Claude',
    });

    // Search with platform filter set to chatgpt (simulating from:chatgpt)
    const searchResponse = await request.post('/api/v1/search', {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'kubernetes',
        limit: 20,
        platform: 'chatgpt',
      },
    });
    expect(searchResponse.status()).toBe(200);

    const data = await searchResponse.json();
    expect(data.groups).toBeDefined();
    expect(data.count).toBeGreaterThan(0);

    // Verify all results are from chatgpt platform only
    for (const group of data.groups) {
      for (const result of group.results) {
        expect(result.meta.source).toBe('chatgpt');
      }
    }
  });

  test('before:/after: date filters return correctly scoped results', async ({ request, apiKey }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Ingest a recent message (today)
    await ingest(request, apiKey, {
      conversation_id: 'op-date-test-recent',
      platform: 'chatgpt',
      content: 'Recent database migration using Alembic and SQLAlchemy patterns',
      role: 'user',
      timestamp: now.toISOString(),
      title: 'Date Filter Test - Recent',
    });

    // Ingest an older message (30 days ago)
    await ingest(request, apiKey, {
      conversation_id: 'op-date-test-old',
      platform: 'chatgpt',
      content: 'Older database migration strategies with Alembic revision history',
      role: 'user',
      timestamp: thirtyDaysAgo.toISOString(),
      title: 'Date Filter Test - Old',
    });

    // Compute boundary dates for filtering
    // "after" date: 7 days ago (should include recent, exclude old)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const afterDateStr = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    // Search with after_date filter
    const afterResponse = await request.post('/api/v1/search', {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'database migration Alembic',
        limit: 20,
        after_date: afterDateStr,
      },
    });
    expect(afterResponse.status()).toBe(200);

    const afterData = await afterResponse.json();
    expect(afterData.groups).toBeDefined();

    // All results should have timestamps >= 7 days ago
    for (const group of afterData.groups) {
      for (const result of group.results) {
        // created_at is a unix timestamp
        const resultDate = new Date(result.meta.created_at * 1000);
        expect(resultDate.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());
      }
    }

    // "before" date: 7 days ago (should include old, exclude recent)
    const beforeDateStr = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    const beforeResponse = await request.post('/api/v1/search', {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'database migration Alembic',
        limit: 20,
        before_date: beforeDateStr,
      },
    });
    expect(beforeResponse.status()).toBe(200);

    const beforeData = await beforeResponse.json();
    expect(beforeData.groups).toBeDefined();

    // All results should have timestamps < 7 days ago
    const beforeBoundary = new Date(beforeDateStr + 'T00:00:00');
    for (const group of beforeData.groups) {
      for (const result of group.results) {
        const resultDate = new Date(result.meta.created_at * 1000);
        expect(resultDate.getTime()).toBeLessThan(beforeBoundary.getTime());
      }
    }
  });

  test('has:code filter returns only messages containing code blocks', async ({ request, apiKey }) => {
    // Ingest a message WITH code blocks
    await ingest(request, apiKey, {
      conversation_id: 'op-code-test-with',
      platform: 'chatgpt',
      content: 'Here is a Python decorator example:\n```python\ndef cache(func):\n    memo = {}\n    def wrapper(*args):\n        if args not in memo:\n            memo[args] = func(*args)\n        return memo[args]\n    return wrapper\n```\nThis caches function results.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Code Block Test - With Code',
    });

    // Ingest a message WITHOUT code blocks
    await ingest(request, apiKey, {
      conversation_id: 'op-code-test-without',
      platform: 'chatgpt',
      content: 'Python decorators are a powerful feature for modifying function behavior without changing the function itself.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Code Block Test - Without Code',
    });

    // Search WITHOUT has_code to confirm results exist
    const baseResponse = await request.post('/api/v1/search', {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'Python decorator cache function',
        limit: 20,
      },
    });
    expect(baseResponse.status()).toBe(200);
    const baseData = await baseResponse.json();
    expect(baseData.count).toBeGreaterThan(0);

    // Search WITH has_code filter
    const searchResponse = await request.post('/api/v1/search', {
      headers: { 'X-API-Key': apiKey },
      data: {
        query: 'Python decorator cache function',
        limit: 20,
        has_code: true,
      },
    });
    expect(searchResponse.status()).toBe(200);

    const data = await searchResponse.json();
    expect(data.groups).toBeDefined();

    // has_code should return fewer or equal results than without it
    expect(data.count).toBeLessThanOrEqual(baseData.count);

    // All returned results must contain code blocks (triple backticks)
    for (const group of data.groups) {
      for (const result of group.results) {
        expect(result.content).toContain('```');
      }
    }
  });

  test('UI from: operator triggers search with platform filter', async ({ page, apiKey }) => {
    await authenticate(page, apiKey);
    await page.waitForSelector('input[placeholder="Search your history..."]', { timeout: 10000 });

    // Set up response listener BEFORE typing (SearchBar has 300ms debounce)
    const searchResponsePromise = page.waitForResponse(
      (res: any) => res.url().includes('/api/v1/search') && res.status() === 200
    );

    // Type a query with from: operator
    await page.fill('input[placeholder="Search your history..."]', 'from:chatgpt test query');

    // Wait for the search API call
    const response = await searchResponsePromise;
    expect(response.status()).toBe(200);

    // Verify the request body included the platform filter
    const requestBody = response.request().postDataJSON();
    expect(requestBody).toBeDefined();

    // The UI parseSearchOperators extracts from:chatgpt and sends platform: ["chatgpt"]
    expect(requestBody.platform).toBeDefined();
    const platformValue = Array.isArray(requestBody.platform)
      ? requestBody.platform
      : [requestBody.platform];
    expect(platformValue).toContain('chatgpt');

    // The cleaned query should not contain "from:chatgpt"
    expect(requestBody.query).not.toContain('from:');
    expect(requestBody.query).toContain('test query');
  });
});
