/**
 * E2E Tests for Conversation Threading Feature
 * Tests thread creation, management, and linking.
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';

test.describe('Conversation Threads', () => {
  test('can create a new thread', async ({ request, apiKey, baseURL }) => {
    const response = await request.post(`${baseURL}/api/v1/threads`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        name: 'Project Alpha Architecture',
        description: 'Architecture decisions for Project Alpha',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data.name).toBe('Project Alpha Architecture');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('conversations');
    expect(Array.isArray(data.conversations)).toBe(true);
  });

  test('can add conversation to thread', async ({ request, apiKey, baseURL }) => {
    // Create thread first
    const threadResponse = await request.post(`${baseURL}/api/v1/threads`, {
      headers: { 'X-API-Key': apiKey },
      data: { name: 'Test Thread', description: 'Test' },
    });
    const thread = await threadResponse.json();
    const threadId = thread.id;

    // Add conversation to thread
    const addResponse = await request.post(
      `${baseURL}/api/v1/threads/${threadId}/conversations`,
      {
        headers: { 'X-API-Key': apiKey },
        data: {
          conversation_id: 'test-conv-for-thread',
          relationship_type: 'continues',
          position: 0,
        },
      }
    );

    expect(addResponse.status()).toBe(200);
    const result = await addResponse.json();
    expect(result.success).toBe(true);
  });

  test('can get thread with conversations', async ({ request, apiKey, baseURL }) => {
    // Create thread
    const threadResponse = await request.post(`${baseURL}/api/v1/threads`, {
      headers: { 'X-API-Key': apiKey },
      data: { name: 'Retrieval Test Thread' },
    });
    const thread = await threadResponse.json();

    // Get thread
    const getResponse = await request.get(
      `${baseURL}/api/v1/threads/${thread.id}`,
      { headers: { 'X-API-Key': apiKey } }
    );

    expect(getResponse.status()).toBe(200);
    const data = await getResponse.json();

    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('conversations');
    expect(data.id).toBe(thread.id);
  });

  test('can list threads for a conversation', async ({ request, apiKey, baseURL }) => {
    // Ingest a conversation first
    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: 'thread-list-test-conv',
        platform: 'chatgpt',
        content: 'Test content',
        role: 'user',
        timestamp: new Date().toISOString(),
        title: 'Test Conversation',
      },
    });

    // Get threads for conversation
    const response = await request.get(
      `${baseURL}/api/v1/conversations/thread-list-test-conv/threads`,
      { headers: { 'X-API-Key': apiKey } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('threads');
    expect(Array.isArray(data.threads)).toBe(true);
  });

  test('thread list returns summary structure', async ({ request, apiKey, baseURL }) => {
    // Create a thread first
    await request.post(`${baseURL}/api/v1/threads`, {
      headers: { 'X-API-Key': apiKey },
      data: { name: 'Summary Test Thread', description: 'Testing summary' },
    });

    // List threads for any conversation
    const response = await request.get(
      `${baseURL}/api/v1/conversations/any-conv/threads`,
      { headers: { 'X-API-Key': apiKey } }
    );

    const data = await response.json();

    // If threads exist, verify summary structure
    if (data.threads.length > 0) {
      const thread = data.threads[0];
      expect(thread).toHaveProperty('id');
      expect(thread).toHaveProperty('name');
      expect(thread).toHaveProperty('description');
      expect(thread).toHaveProperty('conversation_count');
      expect(typeof thread.conversation_count).toBe('number');
    }
  });
});
