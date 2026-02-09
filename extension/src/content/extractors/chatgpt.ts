import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class ChatGPTExtractor extends BaseExtractor {
  platform = 'chatgpt';

  /**
   * Check if current page is a ChatGPT conversation
   */
  matches(): boolean {
    if (window.location.hostname !== 'chatgpt.com') {
      return false;
    }

    const path = window.location.pathname;
    // Match conversation pages (/c/{uuid}) or main page with active conversation (/)
    return path.startsWith('/c/') || path === '/';
  }

  /**
   * Get conversation ID from URL
   */
  getConversationId(): string {
    const path = window.location.pathname;
    // Extract UUID from /c/{uuid}
    const match = path.match(/\/c\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }
    // No conversation ID on main page without /c/ path
    return '';
  }

  /**
   * Get conversation title from DOM
   */
  getConversationTitle(): string {
    try {
      // Try multiple selectors in order
      let title: string | null = null;

      // 1. h1 element (ChatGPT shows conversation title as h1)
      title = document.querySelector('h1')?.textContent?.trim() || null;
      if (title) return title;

      // 2. data-testid attribute
      title = document.querySelector('[data-testid="conversation-title"]')?.textContent?.trim() || null;
      if (title) return title;

      // 3. Active sidebar item
      title = document.querySelector('nav a.bg-token-sidebar-surface-secondary')?.textContent?.trim() || null;
      if (title) return title;

      // Fallback
      return 'Untitled Conversation';
    } catch (error) {
      console.warn('[WIMS ChatGPT] Error getting conversation title:', error);
      return 'Untitled Conversation';
    }
  }

  /**
   * Extract messages from DOM
   */
  extractMessages(): ExtractedMessage[] {
    const conversationId = this.getConversationId();
    if (!conversationId) {
      console.log('[WIMS ChatGPT] No conversation ID in URL, skipping extraction');
      return [];
    }

    const conversationTitle = this.getConversationTitle();
    const url = window.location.href;
    const messages: ExtractedMessage[] = [];

    try {
      // Try multiple selectors for message elements
      let messageElements: NodeListOf<Element> | null = null;

      // 1. Primary: data-message-id attribute
      messageElements = document.querySelectorAll('[data-message-id]');
      if (messageElements.length === 0) {
        // 2. Fallback: article tags
        messageElements = document.querySelectorAll('article');
      }
      if (messageElements.length === 0) {
        // 3. Last resort: class-based selection
        messageElements = document.querySelectorAll('[class*="agent-turn"], [class*="human-turn"]');
      }

      if (messageElements.length === 0) {
        console.log('[WIMS ChatGPT] No message elements found — DOM may have changed');
        return [];
      }

      messageElements.forEach((element) => {
        try {
          // Extract role
          let role: 'user' | 'assistant' = 'assistant';
          const roleAttr = element.getAttribute('data-message-author-role');
          if (roleAttr === 'user') {
            role = 'user';
          } else if (roleAttr) {
            role = 'assistant';
          } else {
            // Infer from DOM structure or classes if no attribute
            const classes = element.className;
            if (classes.includes('user') || classes.includes('human')) {
              role = 'user';
            }
          }

          // Extract content with special handling for code blocks and images
          let content = this.extractContentWithSpecialHandling(element);
          if (!content.trim()) {
            return; // Skip empty messages
          }

          // Use current time as timestamp (ChatGPT doesn't show per-message timestamps)
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
          console.warn('[WIMS ChatGPT] Error extracting message:', error);
        }
      });

      console.log(`[WIMS ChatGPT] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS ChatGPT] Fatal error during extraction:', error);
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

      // Check for code block header (common in ChatGPT)
      const header = codeEl.parentElement?.querySelector('[class*="code-header"]');
      if (header && header.textContent) {
        language = header.textContent.trim();
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
