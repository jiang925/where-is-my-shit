import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import { ApiClient, AuthError } from '../src/lib/api';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    resetChromeStorage();
    client = new ApiClient('http://localhost:8000');
    // Set up API key in storage
    chrome.storage.local.set({ settings: { apiKey: 'test-key' } });
  });

  describe('AuthError', () => {
    it('has correct name', () => {
      const err = new AuthError('test');
      expect(err.name).toBe('AuthError');
      expect(err.message).toBe('test');
      expect(err instanceof Error).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('throws AuthError when no API key', async () => {
      await chrome.storage.local.set({ settings: { apiKey: '' } });
      await expect(
        client.sendMessage({
          content: 'test',
          role: 'user',
          platform: 'chatgpt',
          conversation_id: 'conv1',
          title: 'Test',
          url: 'https://example.com',
        })
      ).rejects.toThrow(AuthError);
    });

    it('sends correct request to server', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{}', { status: 200 })
      );

      const payload = {
        content: 'Hello',
        role: 'user' as const,
        platform: 'chatgpt',
        conversation_id: 'conv1',
        title: 'Test',
        url: 'https://chatgpt.com/c/conv1',
      };

      await client.sendMessage(payload);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/ingest',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );

      fetchSpy.mockRestore();
    });

    it('throws AuthError on 401 response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      await expect(
        client.sendMessage({
          content: 'test',
          role: 'user',
          platform: 'chatgpt',
          conversation_id: 'conv1',
          title: 'Test',
          url: 'https://example.com',
        })
      ).rejects.toThrow(AuthError);

      vi.restoreAllMocks();
    });

    it('throws on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Server Error', { status: 500 })
      );

      await expect(
        client.sendMessage({
          content: 'test',
          role: 'user',
          platform: 'chatgpt',
          conversation_id: 'conv1',
          title: 'Test',
          url: 'https://example.com',
        })
      ).rejects.toThrow('Server responded with 500');

      vi.restoreAllMocks();
    });
  });

  describe('checkHealth', () => {
    it('returns true on 200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('OK', { status: 200 })
      );
      expect(await client.checkHealth()).toBe(true);
      vi.restoreAllMocks();
    });

    it('returns false on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      expect(await client.checkHealth()).toBe(false);
      vi.restoreAllMocks();
    });

    it('returns false on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Error', { status: 500 })
      );
      expect(await client.checkHealth()).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('browse', () => {
    it('returns browse response', async () => {
      const mockResponse = {
        items: [{ id: '1', conversation_id: 'c1', timestamp: 123, platform: 'chatgpt', title: 'Test', content: 'Hello', url: '' }],
        nextCursor: null,
        hasMore: false,
        total: 1,
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.browse(5);
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
      vi.restoreAllMocks();
    });
  });
});
