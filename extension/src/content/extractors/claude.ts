import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class ClaudeExtractor extends BaseExtractor {
  platform = 'claude';

  /**
   * Check if current page is a Claude conversation
   */
  matches(): boolean {
    return window.location.hostname === 'claude.ai';
  }

  /**
   * Get conversation ID from URL
   */
  getConversationId(): string {
    const path = window.location.pathname;
    // Claude conversations live at /chat/{uuid}
    const match = path.match(/\/chat\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }
    // No conversation ID on new chat page
    return '';
  }

  /**
   * Get conversation title from DOM
   */
  getConversationTitle(): string {
    try {
      let title: string | null = null;

      // 1. Button with data-testid for conversation header
      title = document.querySelector('[data-testid="chat-title"]')?.textContent?.trim() || null;
      if (title) return title;

      // 2. Active sidebar conversation item
      title = document.querySelector('nav [aria-current="page"]')?.textContent?.trim() || null;
      if (title) return title;

      // 3. Header area h1 or h2
      title = document.querySelector('header h1, header h2')?.textContent?.trim() || null;
      if (title && title !== 'Claude') return title;

      // 4. Any element with conversation title role
      title = document.querySelector('[data-conversation-title]')?.textContent?.trim() || null;
      if (title) return title;

      // 5. Page title fallback (strip " - Claude" suffix)
      const pageTitle = document.title.replace(/\s*[-–]\s*Claude\s*$/, '').trim();
      if (pageTitle && pageTitle !== 'Claude') return pageTitle;

      return 'Untitled Claude Conversation';
    } catch (error) {
      console.warn('[WIMS Claude] Error getting conversation title:', error);
      return 'Untitled Claude Conversation';
    }
  }

  /**
   * Extract messages from DOM
   */
  extractMessages(): ExtractedMessage[] {
    const conversationId = this.getConversationId();
    if (!conversationId) {
      console.log('[WIMS Claude] No conversation ID in URL, skipping extraction');
      return [];
    }

    const conversationTitle = this.getConversationTitle();
    const url = window.location.href;
    const messages: ExtractedMessage[] = [];

    try {
      let messageElements: NodeListOf<Element> | null = null;

      // 1. Primary: data-testid based selectors
      messageElements = document.querySelectorAll('[data-testid="user-message"], [data-testid="ai-message"]');
      if (messageElements.length === 0) {
        // 2. Role-based selectors (Claude uses human/assistant terminology)
        messageElements = document.querySelectorAll('[data-role="user"], [data-role="assistant"]');
      }
      if (messageElements.length === 0) {
        // 3. Class-based: Claude renders messages in alternating containers
        messageElements = document.querySelectorAll('.font-user-message, .font-claude-message');
      }
      if (messageElements.length === 0) {
        // 4. Broader: message content containers with role indicators
        messageElements = document.querySelectorAll('[class*="human"], [class*="assistant"]');
      }
      if (messageElements.length === 0) {
        // 5. Generic: any turn-based message containers
        messageElements = document.querySelectorAll('[class*="Message"], [class*="message-content"]');
      }

      if (messageElements.length === 0) {
        console.log('[WIMS Claude] No message elements found — DOM may have changed');
        return [];
      }

      messageElements.forEach((element) => {
        try {
          let role: 'user' | 'assistant' = 'assistant';

          // Determine role from data attributes
          const testId = element.getAttribute('data-testid') || '';
          const dataRole = element.getAttribute('data-role') || '';
          const classes = element.className;
          const parentClasses = element.parentElement?.className || '';

          if (
            testId.includes('user') ||
            dataRole === 'user' ||
            classes.includes('human') ||
            classes.includes('user') ||
            parentClasses.includes('human') ||
            parentClasses.includes('user')
          ) {
            role = 'user';
          }

          const content = this.extractContentWithSpecialHandling(element);
          if (!content.trim()) {
            return;
          }

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
          console.warn('[WIMS Claude] Error extracting message:', error);
        }
      });

      console.log(`[WIMS Claude] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Claude] Fatal error during extraction:', error);
      return [];
    }
  }

  /**
   * Extract content with special handling for code blocks, images, and artifacts
   */
  private extractContentWithSpecialHandling(element: Element): string {
    const clone = element.cloneNode(true) as Element;

    // Handle images
    clone.querySelectorAll('img').forEach(img => {
      const alt = img.getAttribute('alt') || 'unnamed';
      const textNode = document.createTextNode(`[Image: ${alt}]`);
      img.parentNode?.replaceChild(textNode, img);
    });

    // Handle code blocks
    clone.querySelectorAll('pre code, code').forEach(codeEl => {
      const code = codeEl.textContent || '';

      let language = '';
      const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
      if (langClass) {
        language = langClass.replace('language-', '');
      }

      // Check for code block header (Claude shows language labels)
      const header = codeEl.closest('pre')?.previousElementSibling;
      if (header && header.textContent && !language) {
        language = header.textContent.trim().toLowerCase();
      }

      let wrapped: string;
      if (codeEl.tagName === 'CODE' && codeEl.parentElement?.tagName === 'PRE') {
        wrapped = `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
      } else {
        wrapped = `\`${code}\``;
      }

      const textNode = document.createTextNode(wrapped);
      codeEl.parentNode?.replaceChild(textNode, codeEl);
    });

    // Handle Claude artifacts (rendered previews) — replace with reference
    clone.querySelectorAll('[class*="artifact"], [data-testid*="artifact"]').forEach(artifactEl => {
      const title = artifactEl.getAttribute('aria-label') ||
                    artifactEl.getAttribute('title') ||
                    artifactEl.querySelector('h1, h2, h3')?.textContent?.trim() ||
                    'Artifact';
      const textNode = document.createTextNode(`[Artifact: ${title}]`);
      artifactEl.parentNode?.replaceChild(textNode, artifactEl);
    });

    // Handle file attachments
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
