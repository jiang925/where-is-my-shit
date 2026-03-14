import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class PoeExtractor extends BaseExtractor {
  platform = 'poe';

  matches(): boolean {
    return window.location.hostname === 'poe.com';
  }

  getConversationId(): string {
    // Poe URLs: /chat/{id} or /s/{id}
    const match = window.location.pathname.match(/\/(?:chat|s)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'Poe') return title;

      // Try active sidebar item (Poe uses CSS modules so class names are hashed)
      const active = document.querySelector(
        '[class*="ChatHeader"] [class*="title"], [class*="sidebar"] [class*="active"]'
      )?.textContent?.trim();
      if (active) return active;

      return 'Untitled Conversation';
    } catch {
      return 'Untitled Conversation';
    }
  }

  extractMessages(): ExtractedMessage[] {
    const conversationId = this.getConversationId();
    if (!conversationId) return [];

    const conversationTitle = this.getConversationTitle();
    const url = window.location.href;
    const messages: ExtractedMessage[] = [];

    try {
      // Poe uses CSS module class names (hashed). Match partial class patterns.
      const messageEls = document.querySelectorAll(
        '[class*="Message_chatMessage"], [class*="ChatMessage"], [class*="message_row"]'
      );

      if (messageEls.length === 0) return [];

      messageEls.forEach((el) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        let role: 'user' | 'assistant' = 'assistant';

        // Poe marks human vs bot messages in parent class names
        const classes = (el.className || '').toString();
        const parentClasses = (el.parentElement?.className || '').toString();

        if (
          classes.includes('human') || classes.includes('Human') ||
          parentClasses.includes('human') || parentClasses.includes('Human') ||
          el.getAttribute('data-role') === 'human' ||
          el.getAttribute('data-role') === 'user'
        ) {
          role = 'user';
        }

        if (
          classes.includes('bot') || classes.includes('Bot') ||
          parentClasses.includes('bot') || parentClasses.includes('Bot') ||
          el.getAttribute('data-role') === 'bot' ||
          el.getAttribute('data-role') === 'assistant'
        ) {
          role = 'assistant';
        }

        messages.push({
          content,
          role,
          timestamp: new Date().toISOString(),
          conversationId,
          conversationTitle,
          platform: this.platform,
          url
        });
      });

      console.log(`[WIMS Poe] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Poe] Extraction error:', error);
      return [];
    }
  }
}
