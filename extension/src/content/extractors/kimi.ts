import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class KimiExtractor extends BaseExtractor {
  platform = 'kimi';

  matches(): boolean {
    const hostname = window.location.hostname;
    return hostname.includes('kimi.com') || hostname.includes('kimi.moonshot.cn');
  }

  getConversationId(): string {
    // Kimi URLs: /chat/{id}
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'Kimi' && title !== 'Kimi Chat') return title;

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
        '[class*="message"], [data-testid*="message"]'
      );

      if (messageEls.length === 0) return [];

      messageEls.forEach((el) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        let role: 'user' | 'assistant' = 'assistant';
        const testId = el.getAttribute('data-testid') || '';
        if (testId.includes('user')) {
          role = 'user';
        } else {
          const classes = el.className;
          if (classes.includes('user') || classes.includes('human')) role = 'user';
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

      console.log(`[WIMS Kimi] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Kimi] Extraction error:', error);
      return [];
    }
  }
}
