import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class GrokExtractor extends BaseExtractor {
  platform = 'grok';

  matches(): boolean {
    return window.location.hostname === 'grok.com';
  }

  getConversationId(): string {
    // Grok URLs: /chat/{id} or /conversation/{id}
    const match = window.location.pathname.match(/\/(?:chat|conversation)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    try {
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'Grok') return title;

      // Try active sidebar item
      const active = document.querySelector(
        '[class*="active"] [class*="title"], [aria-selected="true"]'
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
      const messageEls = document.querySelectorAll(
        '[class*="message"], [data-testid*="message"], [class*="turn"], [class*="chat-row"]'
      );

      if (messageEls.length === 0) return [];

      messageEls.forEach((el) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        let role: 'user' | 'assistant' = 'assistant';

        // Role detection via class names or data attributes
        const classes = (el.className || '').toString();
        const parentClasses = (el.parentElement?.className || '').toString();
        const testId = el.getAttribute('data-testid') || '';

        if (
          classes.includes('user') || parentClasses.includes('user') ||
          classes.includes('human') || parentClasses.includes('human') ||
          testId.includes('user')
        ) {
          role = 'user';
        }

        if (
          classes.includes('bot') || parentClasses.includes('bot') ||
          classes.includes('assistant') || parentClasses.includes('assistant') ||
          classes.includes('grok') || parentClasses.includes('grok') ||
          testId.includes('bot') || testId.includes('assistant')
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

      console.log(`[WIMS Grok] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Grok] Extraction error:', error);
      return [];
    }
  }
}
