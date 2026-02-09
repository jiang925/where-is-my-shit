import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class GeminiExtractor extends BaseExtractor {
  platform = 'gemini';

  /**
   * Check if current page is a Gemini conversation
   */
  matches(): boolean {
    return window.location.hostname === 'gemini.google.com';
  }

  /**
   * Get conversation ID from URL
   */
  getConversationId(): string {
    const path = window.location.pathname;
    // Gemini conversations live at /app/{conversation_id}
    const match = path.match(/\/app\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }

    // Fallback: generate ID from URL hash or use timestamp
    if (window.location.hash) {
      return window.location.hash.substring(1);
    }

    // Last resort: timestamp-based ID for new/unnamed conversations
    return `gemini-${Date.now()}`;
  }

  /**
   * Get conversation title from DOM
   */
  getConversationTitle(): string {
    try {
      let title: string | null = null;

      // Try multiple selectors in order
      // 1. Data attribute (if Gemini uses one)
      title = document.querySelector('[data-conversation-title]')?.textContent?.trim() || null;
      if (title) return title;

      // 2. H1 header
      title = document.querySelector('h1.conversation-title')?.textContent?.trim() || null;
      if (title) return title;

      // 3. Generic h1 (might be page title)
      const h1 = document.querySelector('h1')?.textContent?.trim();
      if (h1 && h1 !== 'Gemini') {
        return h1;
      }

      // 4. Chat window header
      title = document.querySelector('.chat-window header')?.textContent?.trim() || null;
      if (title) return title;

      // 5. Active sidebar item
      title = document.querySelector('nav [aria-selected="true"]')?.textContent?.trim() || null;
      if (title) return title;

      // Fallback
      return 'Untitled Gemini Conversation';
    } catch (error) {
      console.warn('[WIMS Gemini] Error getting conversation title:', error);
      return 'Untitled Gemini Conversation';
    }
  }

  /**
   * Extract messages from DOM
   */
  extractMessages(): ExtractedMessage[] {
    const conversationId = this.getConversationId();
    const conversationTitle = this.getConversationTitle();
    const url = window.location.href;
    const messages: ExtractedMessage[] = [];

    try {
      // Try multiple selectors for message elements
      let messageElements: NodeListOf<Element> | null = null;

      // 1. Data attribute approach
      messageElements = document.querySelectorAll('[data-message-id]');
      if (messageElements.length === 0) {
        // 2. Class-based selectors for conversation containers
        messageElements = document.querySelectorAll('.conversation-container .message-content');
      }
      if (messageElements.length === 0) {
        // 3. Role-based class names (user query vs model response)
        messageElements = document.querySelectorAll('.model-response-text, .user-query-text');
      }
      if (messageElements.length === 0) {
        // 4. Generic message containers
        messageElements = document.querySelectorAll('message-content');
      }
      if (messageElements.length === 0) {
        // 5. Broader turn-based containers
        messageElements = document.querySelectorAll('[class*="turn"], [class*="message"]');
      }

      if (messageElements.length === 0) {
        console.log('[WIMS Gemini] No message elements found — DOM may have changed or no messages present');
        return [];
      }

      messageElements.forEach((element) => {
        try {
          // Extract role
          let role: 'user' | 'assistant' = 'assistant';

          // Check for role indicators in classes or attributes
          const classes = element.className;
          const parentClasses = element.parentElement?.className || '';

          // User indicators
          if (
            classes.includes('user') ||
            classes.includes('query') ||
            parentClasses.includes('user') ||
            parentClasses.includes('query') ||
            element.getAttribute('data-role') === 'user'
          ) {
            role = 'user';
          }

          // Assistant indicators (default)
          if (
            classes.includes('model') ||
            classes.includes('assistant') ||
            classes.includes('response') ||
            parentClasses.includes('model') ||
            parentClasses.includes('assistant') ||
            parentClasses.includes('response') ||
            element.getAttribute('data-role') === 'assistant'
          ) {
            role = 'assistant';
          }

          // Extract content with special handling
          const content = this.extractContentWithSpecialHandling(element);
          if (!content.trim()) {
            return; // Skip empty messages
          }

          // Use current time as timestamp (Gemini doesn't show per-message timestamps)
          const timestamp = new Date().toISOString();

          messages.push({
            content,
            role,
            timestamp,
            conversationId,
            conversationTitle,
            platform: this.platform,
            url
          });
        } catch (error) {
          console.warn('[WIMS Gemini] Error extracting message:', error);
        }
      });

      console.log(`[WIMS Gemini] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Gemini] Fatal error during extraction:', error);
      return [];
    }
  }

  /**
   * Extract content with special handling for code blocks, images, and files
   */
  private extractContentWithSpecialHandling(element: Element): string {
    // Clone to avoid mutating DOM
    const clone = element.cloneNode(true) as Element;

    // Handle images: replace with [Image: alt]
    clone.querySelectorAll('img').forEach(img => {
      const alt = img.getAttribute('alt') || 'unnamed';
      const textNode = document.createTextNode(`[Image: ${alt}]`);
      img.parentNode?.replaceChild(textNode, img);
    });

    // Handle code blocks: keep inline with markdown-style backticks
    clone.querySelectorAll('pre code, code').forEach(codeEl => {
      const code = codeEl.textContent || '';

      // Check for language label
      let language = '';
      const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
      if (langClass) {
        language = langClass.replace('language-', '');
      }

      // Wrap in markdown code block
      let wrapped: string;
      if (codeEl.tagName === 'CODE' && codeEl.parentElement?.tagName === 'PRE') {
        // Multi-line code block
        wrapped = `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
      } else {
        // Inline code
        wrapped = `\`${code}\``;
      }

      const textNode = document.createTextNode(wrapped);
      codeEl.parentNode?.replaceChild(textNode, codeEl);
    });

    // Handle file attachments (if present)
    clone.querySelectorAll('[class*="attachment"], [class*="file"]').forEach(fileEl => {
      const fileName = fileEl.textContent?.trim() ||
                       fileEl.getAttribute('aria-label') ||
                       fileEl.getAttribute('title') ||
                       'unknown';
      const textNode = document.createTextNode(`[File: ${fileName}]`);
      fileEl.parentNode?.replaceChild(textNode, fileEl);
    });

    return clone.textContent?.trim() || '';
  }
}
