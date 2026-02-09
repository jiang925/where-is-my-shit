import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from '../extractors/base';
import { generateFingerprint } from '../../lib/fingerprint';
import { getSeenFingerprints, addSeenFingerprint } from '../../lib/storage';

type NewMessagesCallback = (messages: ExtractedMessage[], conversationTitle: string) => void;

export class MessageObserver {
  private observer: MutationObserver | null = null;
  private extractor: BaseExtractor | null = null;
  private callback: NewMessagesCallback | null = null;
  private seenFingerprints: Set<string> = new Set();
  private processTimeout: number | null = null;
  private readonly DEBOUNCE_MS = 1000;

  /**
   * Start observing DOM changes
   */
  async start(extractor: BaseExtractor, onNewMessages: NewMessagesCallback): Promise<void> {
    this.extractor = extractor;
    this.callback = onNewMessages;

    // Load seen fingerprints from storage
    const seen = await getSeenFingerprints();
    this.seenFingerprints = new Set(seen);
    console.log(`[WIMS Observer] Loaded ${this.seenFingerprints.size} seen fingerprints`);

    // Create MutationObserver with childList and subtree only
    // NO attributes, NO characterData per research pitfall #2
    this.observer = new MutationObserver(() => {
      this.debouncedProcess();
    });

    // Observe main element or body
    const target = document.querySelector('main') || document.body;
    this.observer.observe(target, {
      childList: true,
      subtree: true
    });

    console.log('[WIMS Observer] Started observing DOM changes');

    // Do initial extraction immediately
    await this.processMessages();
  }

  /**
   * Trigger check manually (called on scroll)
   */
  triggerCheck(): void {
    this.debouncedProcess();
  }

  /**
   * Stop observing
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }
    console.log('[WIMS Observer] Stopped');
  }

  /**
   * Debounced processing to avoid excessive extraction
   */
  private debouncedProcess(): void {
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
    }
    this.processTimeout = window.setTimeout(() => {
      this.processMessages();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Process messages from extractor with deduplication
   */
  private async processMessages(): Promise<void> {
    if (!this.extractor || !this.callback) return;

    try {
      // Extract messages from DOM
      const messages = this.extractor.extractMessages();
      if (messages.length === 0) {
        return;
      }

      console.log(`[WIMS Observer] Extracted ${messages.length} messages from DOM`);

      // Get conversation title
      const conversationTitle = this.extractor.getConversationTitle();

      // Deduplicate messages
      const newMessages: ExtractedMessage[] = [];

      for (const msg of messages) {
        // Generate fingerprint
        const fingerprint = await generateFingerprint(
          msg.conversationId,
          msg.role,
          msg.content
        );

        // Check if we've seen this message before
        if (!this.seenFingerprints.has(fingerprint)) {
          // New message
          msg.fingerprint = fingerprint;
          newMessages.push(msg);

          // Add to in-memory set and persist
          this.seenFingerprints.add(fingerprint);
          await addSeenFingerprint(fingerprint);
        }
      }

      if (newMessages.length > 0) {
        console.log(`[WIMS Observer] Found ${newMessages.length} new messages (${messages.length - newMessages.length} duplicates filtered)`);
        this.callback(newMessages, conversationTitle);
      }
    } catch (error) {
      console.error('[WIMS Observer] Error processing messages:', error);
    }
  }
}
