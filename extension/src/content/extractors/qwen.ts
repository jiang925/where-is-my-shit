import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class QwenExtractor extends BaseExtractor {
  platform = 'qwen';

  matches(): boolean {
    return window.location.hostname.includes('qwen');
  }

  getConversationId(): string {
    // Qwen URLs: /chat/{id} or similar patterns
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'Qwen' && title !== 'Qwen Chat') return title;

      const active = document.querySelector('[class*="active"] [class*="title"]')?.textContent?.trim();
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
      const messageEls = document.querySelectorAll(
        '[class*="message"], [class*="chat-message"]'
      );

      if (messageEls.length === 0) return [];

      messageEls.forEach((el) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        let role: 'user' | 'assistant' = 'assistant';
        const classes = el.className;
        if (classes.includes('user') || classes.includes('human')) role = 'user';
        const parent = el.closest('[class*="user"], [class*="human"]');
        if (parent) role = 'user';

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

      console.log(`[WIMS Qwen] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Qwen] Extraction error:', error);
      return [];
    }
  }
}
