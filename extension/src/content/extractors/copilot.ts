import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class CopilotExtractor extends BaseExtractor {
  platform = 'copilot';

  matches(): boolean {
    return window.location.hostname === 'copilot.microsoft.com';
  }

  getConversationId(): string {
    // Copilot URLs may contain /c/{id} or /sl/{id}, or embed an ID in data attributes
    const match = window.location.pathname.match(/\/(?:c|sl|chats)\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Fallback: check for a conversation ID in data attributes on the page
    const threadEl = document.querySelector('[data-convid], [data-conversation-id]');
    if (threadEl) {
      return threadEl.getAttribute('data-convid') ||
             threadEl.getAttribute('data-conversation-id') || '';
    }

    return `copilot-${Date.now()}`;
  }

  getConversationTitle(): string {
    try {
      const title = document.querySelector('title')?.textContent?.trim();
      if (title && title !== 'Microsoft Copilot' && title !== 'Copilot') return title;

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
      // Copilot uses Fluent UI / Web Components with Shadow DOM.
      // Try standard selectors first, then look into shadow roots.
      let messageEls = document.querySelectorAll(
        '[class*="message"], cib-message-group, [data-content], [class*="turn"]'
      );

      // If no results, attempt to reach into shadow DOM of known Copilot components
      if (messageEls.length === 0) {
        const shadowHost = document.querySelector('cib-serp, #b_sydConvCont');
        if (shadowHost?.shadowRoot) {
          const inner = shadowHost.shadowRoot.querySelectorAll(
            'cib-chat-turn, cib-message-group, [class*="message"]'
          );
          if (inner.length > 0) messageEls = inner;
        }
      }

      if (messageEls.length === 0) return [];

      messageEls.forEach((el) => {
        const content = this.extractTextContent(el);
        if (!content.trim()) return;

        let role: 'user' | 'assistant' = 'assistant';

        // Role detection via data attributes
        const source = el.getAttribute('data-content') || el.getAttribute('source') || '';
        if (source === 'user') role = 'user';

        // Role detection via class names
        const classes = (el.className || '').toString();
        const parentClasses = (el.parentElement?.className || '').toString();
        if (classes.includes('user') || parentClasses.includes('user')) role = 'user';
        if (classes.includes('bot') || parentClasses.includes('bot')) role = 'assistant';

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

      console.log(`[WIMS Copilot] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Copilot] Extraction error:', error);
      return [];
    }
  }
}
