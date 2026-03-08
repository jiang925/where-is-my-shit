import { ExtractedMessage, IngestPayload } from '../types/message';
import { OfflineQueue } from '../lib/queue';
import { getSettings, setSettings } from '../lib/storage';
import { ApiClient, AuthError, BrowseItem } from '../lib/api';

type MessageType = 'MESSAGES_CAPTURED' | 'GET_STATUS' | 'TOGGLE_CAPTURE' | 'GET_RECENT';

interface MessagePayload {
  type: MessageType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}

interface CapturePayload {
  messages: ExtractedMessage[];
  conversationTitle: string;
}

interface StatusResponse {
  queueSize: number;
  serverOnline: boolean;
  lastCaptureTimestamp: number;
}

// Global queue instance
const queue = new OfflineQueue();

// Cache for recent items (avoids hitting API on every popup open)
let cachedRecent: { items: BrowseItem[]; fetchedAt: number } | null = null;
const RECENT_CACHE_TTL = 30_000; // 30 seconds

console.log('[WIMS] Service worker initialized');

/**
 * Handle authentication errors
 */
async function handleAuthError() {
  console.log('[WIMS] Authentication failed (Invalid API Key)');
  await chrome.action.setBadgeText({ text: 'KEY' });
  await chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
}

/**
 * Clear authentication error state
 */
async function clearAuthError() {
  console.log('[WIMS] Authentication error cleared');
  await chrome.action.setBadgeText({ text: '' });
}

/**
 * Listen for storage changes to detect settings updates
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue;
    // If we have an API key now, clear the auth error
    if (newSettings?.apiKey) {
      clearAuthError();
      // Resume queue processing
      queue.processQueue().catch(err => {
         if (err instanceof AuthError) handleAuthError();
         else console.error('[WIMS] Queue processing error after settings update:', err);
      });
    }
  }
});

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message: MessagePayload, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'MESSAGES_CAPTURED') {
        const payload = message.payload as CapturePayload;
        await handleMessagesCaptured(payload);
        sendResponse({ success: true });
      } else if (message.type === 'GET_STATUS') {
        const status = await getStatus();
        sendResponse(status);
      } else if (message.type === 'TOGGLE_CAPTURE') {
        await handleToggleCapture(message.payload.enabled);
        sendResponse({ success: true });
      } else if (message.type === 'GET_RECENT') {
        const recent = await getRecentItems();
        sendResponse(recent);
      }
    } catch (error) {
      console.error('[WIMS Service Worker] Error handling message:', error);
      sendResponse({ success: false, error: String(error) });
    }
  })();

  // Return true to indicate async response
  return true;
});

/**
 * Handle captured messages from content script
 */
async function handleMessagesCaptured(payload: CapturePayload): Promise<void> {
  const { messages, conversationTitle } = payload;

  console.log(`[WIMS] Processing ${messages.length} captured messages`);

  // Convert each ExtractedMessage to IngestPayload and enqueue
  for (const msg of messages) {
    const ingestPayload: IngestPayload = {
      conversation_id: msg.conversationId,
      platform: msg.platform,
      title: conversationTitle,
      content: msg.content,
      role: msg.role,
      timestamp: msg.timestamp,
      url: msg.url
    };

    try {
      await queue.enqueue(ingestPayload);
    } catch (error) {
      if (error instanceof AuthError) {
        await handleAuthError();
        // Continue loop to ensure all messages are at least enqueued (OfflineQueue saves before processing)
      } else {
        throw error;
      }
    }
  }

  // Update last capture timestamp
  await setSettings({ lastCaptureTimestamp: Date.now() });

  console.log(`[WIMS] Enqueued ${messages.length} messages for processing`);
}

/**
 * Get current status for popup
 */
async function getStatus(): Promise<StatusResponse> {
  const settings = await getSettings();
  const queueSize = await queue.getQueueSize();

  // Check server health
  const client = new ApiClient(settings.serverUrl);
  const serverOnline = await client.checkHealth();

  return {
    queueSize,
    serverOnline,
    lastCaptureTimestamp: settings.lastCaptureTimestamp
  };
}

/**
 * Get recent items from server with caching
 * Returns cached items if cache is fresh, otherwise fetches from server
 */
async function getRecentItems(): Promise<{ items: BrowseItem[]; serverOnline: boolean }> {
  const now = Date.now();

  // Return cached data if fresh
  if (cachedRecent && (now - cachedRecent.fetchedAt) < RECENT_CACHE_TTL) {
    return { items: cachedRecent.items, serverOnline: true };
  }

  // Check if server is online first
  const settings = await getSettings();
  const client = new ApiClient(settings.serverUrl);
  const serverOnline = await client.checkHealth();

  if (!serverOnline) {
    return { items: cachedRecent?.items || [], serverOnline: false };
  }

  try {
    const response = await client.browse(5);
    cachedRecent = { items: response.items, fetchedAt: now };
    return { items: response.items, serverOnline: true };
  } catch (error) {
    console.error('[WIMS] Failed to fetch recent items:', error);
    return { items: cachedRecent?.items || [], serverOnline: true };
  }
}

/**
 * Toggle capture on/off
 */
async function handleToggleCapture(enabled: boolean): Promise<void> {
  await setSettings({ captureEnabled: enabled });
  console.log(`[WIMS] Capture ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Set up periodic queue processing
 */
chrome.alarms.create('processQueue', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'processQueue') {
    console.log('[WIMS] Processing queue on alarm');
    queue.processQueue().catch(async (err) => {
      if (err instanceof AuthError) {
        await handleAuthError();
      } else {
        console.error('[WIMS] Queue processing error:', err);
      }
    });
  }
});

/**
 * Process queue immediately on service worker startup
 */
queue.processQueue().catch(async (err) => {
  if (err instanceof AuthError) {
    await handleAuthError();
  } else {
    console.error('[WIMS] Initial queue processing error:', err);
  }
});
