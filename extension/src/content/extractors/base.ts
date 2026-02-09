export interface ExtractedMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;        // ISO 8601
  conversationId: string;
  conversationTitle: string;
  platform: string;
  url: string;
  fingerprint?: string;
}

export abstract class BaseExtractor {
  abstract platform: string;
  abstract matches(): boolean;
  abstract extractMessages(): ExtractedMessage[];
  abstract getConversationTitle(): string;
  abstract getConversationId(): string;

  /**
   * Extract text content from an element, handling images and other non-text content
   */
  protected extractTextContent(element: Element): string {
    // Clone element to avoid mutating DOM
    const clone = element.cloneNode(true) as Element;

    // Replace images with reference text per user decision
    clone.querySelectorAll('img').forEach(img => {
      const alt = img.getAttribute('alt') || 'unnamed';
      const textNode = document.createTextNode(`[Image: ${alt}]`);
      img.parentNode?.replaceChild(textNode, img);
    });

    // Replace file attachments with references
    // (platform-specific selectors handled in subclasses)

    return clone.textContent?.trim() || '';
  }
}
