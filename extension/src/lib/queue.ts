import { IngestPayload } from '../types/message';
import { ApiClient, AuthError } from './api';
import { getSettings } from './storage';

interface QueuedItem {
  id: string;
  payload: IngestPayload;
  timestamp: number;
  retryCount: number;
}

export class OfflineQueue {
  private readonly STORAGE_KEY = 'wims_queue';
  private readonly MAX_RETRIES = 10;
  private isProcessing = false;

  /**
   * Add payload to queue and trigger processing
   */
  async enqueue(payload: IngestPayload): Promise<void> {
    const item: QueuedItem = {
      id: crypto.randomUUID(),
      payload,
      timestamp: Date.now(),
      retryCount: 0
    };

    const queue = await this.getQueue();
    queue.push(item);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: queue });

    // Trigger immediate processing attempt
    await this.processQueue();
  }

  /**
   * Process all queued items, retrying failures
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const queue = await this.getQueue();
      const remaining: QueuedItem[] = [];
      const settings = await getSettings();
      const client = new ApiClient(settings.serverUrl);

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        try {
          await client.sendMessage(item.payload);
          // Success - don't add to remaining
          console.log(`[WIMS Queue] Successfully sent message ${item.id}`);
        } catch (error) {
          if (error instanceof AuthError) {
            console.warn('[WIMS Queue] Auth error encountered, stopping queue processing');
            // Add current failed item and all remaining items back to queue
            remaining.push(item);
            remaining.push(...queue.slice(i + 1));
            await chrome.storage.local.set({ [this.STORAGE_KEY]: remaining });
            throw error;
          }

          item.retryCount++;

          if (item.retryCount < this.MAX_RETRIES) {
            remaining.push(item);
            console.log(`[WIMS Queue] Failed to send ${item.id}, retry ${item.retryCount}/${this.MAX_RETRIES}`);
          } else {
            console.error(`[WIMS Queue] Dropped item ${item.id} after ${this.MAX_RETRIES} retries`);
          }
        }
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: remaining });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current queue size
   */
  async getQueueSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  private async getQueue(): Promise<QueuedItem[]> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  }
}
