import { ExtractedMessage } from '../../types/message';
import { BaseExtractor } from './base';

export class PerplexityExtractor extends BaseExtractor {
  platform = 'perplexity';

  /**
   * Check if current page is a Perplexity thread
   */
  matches(): boolean {
    return window.location.hostname === 'www.perplexity.ai';
  }

  /**
   * Get conversation ID from URL
   */
  getConversationId(): string {
    const path = window.location.pathname;

    // Perplexity uses /search/{query-slug}-{id} or /thread/{id} patterns
    // Try /search/ pattern first
    let match = path.match(/\/search\/[^/]+-([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }

    // Try /thread/ pattern
    match = path.match(/\/thread\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }

    // Try generic ID extraction from path
    match = path.match(/\/([a-zA-Z0-9_-]+)$/);
    if (match) {
      return match[1];
    }

    // Fallback: timestamp-based ID for new searches
    return `perplexity-${Date.now()}`;
  }

  /**
   * Get conversation title from DOM
   */
  getConversationTitle(): string {
    try {
      let title: string | null = null;

      // 1. H1 header (Perplexity shows query as title)
      title = document.querySelector('h1')?.textContent?.trim() || null;
      if (title && title !== 'Perplexity') {
        return title;
      }

      // 2. Class-based title selector
      title = document.querySelector('[class*="Title"]')?.textContent?.trim() || null;
      if (title) return title;

      // 3. Meta tag for page title
      title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || null;
      if (title && title !== 'Perplexity') {
        return title;
      }

      // 4. First user query as fallback
      const firstQuery = document.querySelector('[class*="Query"]')?.textContent?.trim();
      if (firstQuery) {
        // Truncate if too long
        return firstQuery.length > 100 ? firstQuery.substring(0, 100) + '...' : firstQuery;
      }

      // Fallback
      return 'Untitled Perplexity Thread';
    } catch (error) {
      console.warn('[WIMS Perplexity] Error getting conversation title:', error);
      return 'Untitled Perplexity Thread';
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
      // Perplexity shows Q&A pairs - need to extract both queries and answers
      let messageElements: NodeListOf<Element> | null = null;

      // 1. Class-based selectors for query and answer blocks
      messageElements = document.querySelectorAll('[class*="Query"], [class*="Answer"]');
      if (messageElements.length === 0) {
        // 2. Role-based containers
        messageElements = document.querySelectorAll('[role="article"], [role="region"]');
      }
      if (messageElements.length === 0) {
        // 3. Generic message/turn containers
        messageElements = document.querySelectorAll('[class*="message"], [class*="turn"]');
      }
      if (messageElements.length === 0) {
        // 4. Prose/answer sections
        messageElements = document.querySelectorAll('[class*="prose"], .answer-section');
      }

      if (messageElements.length === 0) {
        console.log('[WIMS Perplexity] No message elements found — DOM may have changed or no messages present');
        return [];
      }

      messageElements.forEach((element) => {
        try {
          // Extract role
          let role: 'user' | 'assistant' = 'assistant';

          // Check for role indicators
          const classes = element.className;
          const parentClasses = element.parentElement?.className || '';

          // User query indicators
          if (
            classes.includes('Query') ||
            classes.includes('query') ||
            classes.includes('user') ||
            classes.includes('question') ||
            parentClasses.includes('Query') ||
            parentClasses.includes('query') ||
            parentClasses.includes('user')
          ) {
            role = 'user';
          }

          // Assistant/answer indicators
          if (
            classes.includes('Answer') ||
            classes.includes('answer') ||
            classes.includes('response') ||
            classes.includes('assistant') ||
            parentClasses.includes('Answer') ||
            parentClasses.includes('answer') ||
            parentClasses.includes('response')
          ) {
            role = 'assistant';
          }

          // Extract content with special handling
          const content = this.extractContentWithSpecialHandling(element);
          if (!content.trim()) {
            return; // Skip empty messages
          }

          // Use current time as timestamp
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
          console.warn('[WIMS Perplexity] Error extracting message:', error);
        }
      });

      console.log(`[WIMS Perplexity] Extracted ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('[WIMS Perplexity] Fatal error during extraction:', error);
      return [];
    }
  }

  /**
   * Extract content with special handling for code blocks, images, citations, and files
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

    // Handle citations: Perplexity uses numbered citations like [1], [2]
    // Keep them as inline text - they're important context
    clone.querySelectorAll('[class*="citation"], sup a').forEach(citation => {
      const citationText = citation.textContent?.trim() || '';
      if (citationText) {
        // Convert to inline citation format if not already
        const formatted = citationText.match(/^\[\d+\]$/) ? citationText : `[${citationText}]`;
        const textNode = document.createTextNode(formatted);
        citation.parentNode?.replaceChild(textNode, citation);
      }
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
