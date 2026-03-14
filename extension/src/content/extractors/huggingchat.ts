import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class HuggingChatExtractor extends BaseExtractor {
  platform = 'huggingchat';

  matches(): boolean {
    return window.location.hostname === 'huggingface.co'
      && window.location.pathname.startsWith('/chat');
  }

  getConversationId(): string {
    // HuggingChat URLs: /chat/conversation/{id}
    const match = window.location.pathname.match(/\/chat\/conversation\/([a-f0-9]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      // Try the conversation title in the sidebar
      const active = document.querySelector('[class*="conversation"][class*="active"]')?.textContent?.trim();
      if (active) return active;

      // Fallback to page title
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'HuggingChat') return title;

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
      // HuggingChat messages have data-message-role attributes or role-based classes
      const messageEls = document.querySelectorAll(
        '[data-message-role], .message-row, [class*="message"]'
      );

      if (messageEls.length === 0) return [];

      messageEls.forEach((el) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        let role: 'user' | 'assistant' = 'assistant';
        const roleAttr = el.getAttribute('data-message-role');
        if (roleAttr === 'user') {
          role = 'user';
        } else if (!roleAttr) {
          // Infer from classes
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

      console.log(`[WIMS HuggingChat] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS HuggingChat] Extraction error:', error);
      return [];
    }
  }
}
