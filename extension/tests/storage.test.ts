import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import {
  getSettings,
  setSettings,
  getSeenFingerprints,
  addSeenFingerprint,
  clearSeenFingerprints,
} from '../src/lib/storage';

describe('storage', () => {
  beforeEach(() => {
    resetChromeStorage();
  });

  describe('getSettings', () => {
    it('returns default settings when none saved', async () => {
      const settings = await getSettings();
      expect(settings.captureEnabled).toBe(true);
      expect(settings.serverUrl).toBe('http://localhost:8000');
      expect(settings.lastCaptureTimestamp).toBe(0);
      expect(settings.apiKey).toBe('');
    });

    it('merges saved settings with defaults', async () => {
      await chrome.storage.local.set({
        settings: { apiKey: 'test-key' },
      });
      const settings = await getSettings();
      expect(settings.apiKey).toBe('test-key');
      expect(settings.captureEnabled).toBe(true); // default preserved
    });
  });

  describe('setSettings', () => {
    it('updates partial settings', async () => {
      await setSettings({ apiKey: 'my-key' });
      const settings = await getSettings();
      expect(settings.apiKey).toBe('my-key');
      expect(settings.captureEnabled).toBe(true);
    });

    it('overwrites existing values', async () => {
      await setSettings({ serverUrl: 'http://example.com' });
      await setSettings({ serverUrl: 'http://other.com' });
      const settings = await getSettings();
      expect(settings.serverUrl).toBe('http://other.com');
    });
  });

  describe('getSeenFingerprints', () => {
    it('returns empty array when none stored', async () => {
      const fps = await getSeenFingerprints();
      expect(fps).toEqual([]);
    });
  });

  describe('addSeenFingerprint', () => {
    it('adds fingerprint to front of list', async () => {
      await addSeenFingerprint('fp1');
      await addSeenFingerprint('fp2');
      const fps = await getSeenFingerprints();
      expect(fps[0]).toBe('fp2');
      expect(fps[1]).toBe('fp1');
    });

    it('enforces max size with LRU eviction', async () => {
      for (let i = 0; i < 5; i++) {
        await addSeenFingerprint(`fp${i}`, 3);
      }
      const fps = await getSeenFingerprints();
      expect(fps.length).toBe(3);
      expect(fps[0]).toBe('fp4');
    });
  });

  describe('clearSeenFingerprints', () => {
    it('removes all fingerprints', async () => {
      await addSeenFingerprint('fp1');
      await clearSeenFingerprints();
      const fps = await getSeenFingerprints();
      expect(fps).toEqual([]);
    });
  });
});
