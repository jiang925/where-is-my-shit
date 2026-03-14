import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class DoubaoExtractor extends BaseExtractor {
  platform = 'doubao';

  matches(): boolean {
    const hostname = window.location.hostname;
    return hostname === 'www.doubao.com' || hostname === 'doubao.com';
  }

  getConversationId(): string {
    // Doubao URLs: /chat/{id} or /thread/{id}
    const match = window.location.pathname.match(/\/(?:chat|thread)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'Doubao' && title !== '豆包') return title;

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
        '[class*="message"], [class*="chat-message"], [data-role]'
      );

      if (messageEls.length === 0) return [];

      messageEls.forEach((el) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        let role: 'user' | 'assistant' = 'assistant';
        const roleAttr = el.getAttribute('data-role');
        if (roleAttr === 'user') {
          role = 'user';
        } else if (!roleAttr) {
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

      console.log(`[WIMS Doubao] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Doubao] Extraction error:', error);
      return [];
    }
  }
}
