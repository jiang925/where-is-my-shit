import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class LeChatExtractor extends BaseExtractor {
  platform = 'lechat';

  matches(): boolean {
    return window.location.hostname === 'chat.mistral.ai';
  }

  getConversationId(): string {
    // Le Chat URLs: /chat/{id}
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'Le Chat' && title !== 'Mistral AI') return title;

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
      // Le Chat is a clean React SPA with standard message containers
      const messageEls = document.querySelectorAll(
        '[data-role], [class*="message-content"], [class*="chat-message"]'
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
          if (classes.includes('user')) role = 'user';
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

      console.log(`[WIMS LeChat] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS LeChat] Extraction error:', error);
      return [];
    }
  }
}
