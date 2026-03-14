import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class DeepSeekExtractor extends BaseExtractor {
  platform = 'deepseek';

  matches(): boolean {
    return window.location.hostname === 'chat.deepseek.com';
  }

  getConversationId(): string {
    // DeepSeek URLs: /a/chat/s/{id}
    const match = window.location.pathname.match(/\/(?:a\/)?chat\/s\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      // Try the page title first
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'DeepSeek') return title;

      // Try active sidebar item
      const active = document.querySelector('.ds-sidebar-item--active, [class*="active"] a')?.textContent?.trim();
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
      // DeepSeek uses a chat container with alternating user/assistant messages
      // Try multiple selectors
      const messageEls = document.querySelectorAll(
        '[class*="message-content"], [class*="chat-message"], .markdown-body'
      );

      if (messageEls.length === 0) return [];

      messageEls.forEach((el, idx) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        // Infer role from position or class
        let role: 'user' | 'assistant' = idx % 2 === 0 ? 'user' : 'assistant';
        const parent = el.closest('[class*="user"], [class*="human"]');
        if (parent) role = 'user';
        const assistantParent = el.closest('[class*="assistant"], [class*="bot"]');
        if (assistantParent) role = 'assistant';

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

      console.log(`[WIMS DeepSeek] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS DeepSeek] Extraction error:', error);
      return [];
    }
  }
}
