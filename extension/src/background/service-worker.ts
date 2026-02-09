import { ExtractedMessage, IngestPayload } from '../types/message';
import { OfflineQueue } from '../lib/queue';
import { getSettings, setSettings } from '../lib/storage';
import { ApiClient } from '../lib/api';

type MessageType = 'MESSAGES_CAPTURED' | 'GET_STATUS' | 'TOGGLE_CAPTURE';

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

console.log('[WIMS] Service worker initialized');

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message: MessagePayload, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'MESSAGES_CAPTURED') {
        await handleMessagesCaptured(message.payload as CapturePayload);
        sendResponse({ success: true });
      } else if (message.type === 'GET_STATUS') {
        const status = await getStatus();
        sendResponse(status);
      } else if (message.type === 'TOGGLE_CAPTURE') {
        await handleToggleCapture(message.payload.enabled);
        sendResponse({ success: true });
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

    await queue.enqueue(ingestPayload);
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
    queue.processQueue().catch(err => {
      console.error('[WIMS] Queue processing error:', err);
    });
  }
});

/**
 * Process queue immediately on service worker startup
 */
queue.processQueue().catch(err => {
  console.error('[WIMS] Initial queue processing error:', err);
});
