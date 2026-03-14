import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

async function ingest(request: any, apiKey: string, data: Record<string, any>) {
  const response = await request.post('/api/v1/ingest', {
    headers: { 'X-API-Key': apiKey },
    data,
  });
  expect(response.status()).toBe(201);
}

test.describe('Sync API', () => {

  test('sync status returns instance info', async ({ request, apiKey }) => {
    const response = await request.get('/api/v1/sync/status', {
      headers: { 'X-API-Key': apiKey },
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('total_messages');
    expect(data).toHaveProperty('total_conversations');
    expect(data).toHaveProperty('platforms');
    expect(data).toHaveProperty('server_time');
  });

  test('sync changes returns messages after timestamp', async ({ request, apiKey }) => {
    // Ingest a test message with a known timestamp
    const now = new Date();
    await ingest(request, apiKey, {
      conversation_id: 'sync-changes-test-1',
      platform: 'chatgpt',
      content: 'Sync changes test message for E2E validation',
      role: 'user',
      timestamp: now.toISOString(),
      title: 'Sync Changes Test',
    });

    // Fetch all changes since epoch
    const response = await request.get('/api/v1/sync/changes?since=0', {
      headers: { 'X-API-Key': apiKey },
    });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('messages');
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('server_time');

    // Verify the ingested message appears in results
    const found = data.messages.some(
      (m: any) => m.conversation_id === 'sync-changes-test-1'
    );
    expect(found).toBe(true);
  });

  test('sync push inserts new messages', async ({ request, apiKey }) => {
    const runId = Date.now().toString(36);
    const messages = [
      {
        id: `sync-push-msg-1-${runId}`,
        conversation_id: `sync-push-test-${runId}`,
        platform: 'claude',
        title: 'Sync Push Test',
        content: 'First pushed message for sync E2E',
        role: 'user',
        timestamp: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: `sync-push-msg-2-${runId}`,
        conversation_id: `sync-push-test-${runId}`,
        platform: 'claude',
        title: 'Sync Push Test',
        content: 'Second pushed message for sync E2E',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      },
    ];

    // First push: both messages should be inserted
    const response1 = await request.post('/api/v1/sync/push', {
      headers: { 'X-API-Key': apiKey },
      data: { messages },
    });
    expect(response1.status()).toBe(200);

    const data1 = await response1.json();
    expect(data1).toHaveProperty('received');
    expect(data1).toHaveProperty('inserted');
    expect(data1).toHaveProperty('skipped_duplicates');
    expect(data1.received).toBe(2);
    expect(data1.inserted).toBe(2);

    // Second push with the SAME messages: should be skipped as duplicates
    const response2 = await request.post('/api/v1/sync/push', {
      headers: { 'X-API-Key': apiKey },
      data: { messages },
    });
    expect(response2.status()).toBe(200);

    const data2 = await response2.json();
    expect(data2.skipped_duplicates).toBeGreaterThan(0);
  });
});

test.describe('Conversation Merge', () => {

  test('merge conversations reassigns messages', async ({ request, apiKey }) => {
    // Ingest messages into two separate conversations
    await ingest(request, apiKey, {
      conversation_id: 'merge-source-1',
      platform: 'chatgpt',
      content: 'Source conversation message for merge test',
      role: 'user',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      title: 'Merge Source',
    });
    await ingest(request, apiKey, {
      conversation_id: 'merge-target-1',
      platform: 'chatgpt',
      content: 'Target conversation message for merge test',
      role: 'user',
      timestamp: new Date().toISOString(),
      title: 'Merge Target',
    });

    // Merge source into target
    const mergeResponse = await request.post('/api/v1/conversations/merge', {
      headers: { 'X-API-Key': apiKey },
      data: {
        source_ids: ['merge-source-1'],
        target_id: 'merge-target-1',
      },
    });
    expect(mergeResponse.status()).toBe(200);

    const mergeData = await mergeResponse.json();
    expect(mergeData).toHaveProperty('target_id');
    expect(mergeData).toHaveProperty('merged_sources');
    expect(mergeData).toHaveProperty('total_messages');
    expect(mergeData.target_id).toBe('merge-target-1');
    expect(mergeData.merged_sources).toContain('merge-source-1');

    // Verify the target thread now contains messages from both conversations
    const threadResponse = await request.get('/api/v1/thread/merge-target-1', {
      headers: { 'X-API-Key': apiKey },
    });
    expect(threadResponse.status()).toBe(200);

    const threadData = await threadResponse.json();
    const contents = threadData.items.map((item: any) => item.content);
    expect(contents).toContain('Source conversation message for merge test');
    expect(contents).toContain('Target conversation message for merge test');
  });

  test('merge with new title updates all messages', async ({ request, apiKey }) => {
    // Ingest messages into source and target
    await ingest(request, apiKey, {
      conversation_id: 'merge-src-2',
      platform: 'claude',
      content: 'Source message for title merge test',
      role: 'user',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      title: 'Old Source Title',
    });
    await ingest(request, apiKey, {
      conversation_id: 'merge-tgt-2',
      platform: 'claude',
      content: 'Target message for title merge test',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      title: 'Old Target Title',
    });

    // Merge with a new title
    const mergeResponse = await request.post('/api/v1/conversations/merge', {
      headers: { 'X-API-Key': apiKey },
      data: {
        source_ids: ['merge-src-2'],
        target_id: 'merge-tgt-2',
        new_title: 'Merged Conversation',
      },
    });
    expect(mergeResponse.status()).toBe(200);

    // Verify the target thread has the updated title on all messages
    const threadResponse = await request.get('/api/v1/thread/merge-tgt-2', {
      headers: { 'X-API-Key': apiKey },
    });
    expect(threadResponse.status()).toBe(200);

    const threadData = await threadResponse.json();
    expect(threadData.items.length).toBeGreaterThan(0);

    for (const item of threadData.items) {
      expect(item.title).toBe('Merged Conversation');
    }
  });

  test('merge rejects target in source list', async ({ request, apiKey }) => {
    const response = await request.post('/api/v1/conversations/merge', {
      headers: { 'X-API-Key': apiKey },
      data: {
        source_ids: ['some-conv-1', 'some-conv-2'],
        target_id: 'some-conv-1',
      },
    });
    expect(response.status()).toBe(400);
  });
});
