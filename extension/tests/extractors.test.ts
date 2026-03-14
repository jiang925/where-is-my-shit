import { describe, it, expect, beforeEach } from 'vitest';
import { ChatGPTExtractor } from '../src/content/extractors/chatgpt';
import { ClaudeExtractor } from '../src/content/extractors/claude';
import { GeminiExtractor } from '../src/content/extractors/gemini';
import { PerplexityExtractor } from '../src/content/extractors/perplexity';
import { DeepSeekExtractor } from '../src/content/extractors/deepseek';
import { HuggingChatExtractor } from '../src/content/extractors/huggingchat';
import { LeChatExtractor } from '../src/content/extractors/lechat';

// Helper to set window.location
function setLocation(url: string) {
  // jsdom requires deleting before reassigning window.location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).location;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).location = new URL(url);
}

describe('ChatGPTExtractor', () => {
  const extractor = new ChatGPTExtractor();

  it('has correct platform', () => {
    expect(extractor.platform).toBe('chatgpt');
  });

  describe('matches', () => {
    it('matches chatgpt.com', () => {
      setLocation('https://chatgpt.com/c/abc-123');
      expect(extractor.matches()).toBe(true);
    });

    it('matches chatgpt.com root', () => {
      setLocation('https://chatgpt.com/');
      expect(extractor.matches()).toBe(true);
    });

    it('does not match other domains', () => {
      setLocation('https://example.com/');
      expect(extractor.matches()).toBe(false);
    });
  });

  describe('getConversationId', () => {
    it('extracts UUID from /c/ path', () => {
      setLocation('https://chatgpt.com/c/abc-def-123');
      expect(extractor.getConversationId()).toBe('abc-def-123');
    });

    it('returns empty string for root path', () => {
      setLocation('https://chatgpt.com/');
      expect(extractor.getConversationId()).toBe('');
    });
  });

  describe('getConversationTitle', () => {
    beforeEach(() => {
      setLocation('https://chatgpt.com/c/test');
      document.body.innerHTML = '';
    });

    it('extracts title from h1', () => {
      document.body.innerHTML = '<h1>My Chat</h1>';
      expect(extractor.getConversationTitle()).toBe('My Chat');
    });

    it('falls back to Untitled Conversation', () => {
      document.body.innerHTML = '';
      expect(extractor.getConversationTitle()).toBe('Untitled Conversation');
    });
  });

  describe('extractMessages', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('returns empty array when no conversation ID', () => {
      setLocation('https://chatgpt.com/');
      expect(extractor.extractMessages()).toEqual([]);
    });

    it('returns empty array when no message elements', () => {
      setLocation('https://chatgpt.com/c/abc-def-123');
      document.body.innerHTML = '<div>No messages here</div>';
      expect(extractor.extractMessages()).toEqual([]);
    });

    it('extracts messages from data-message-id elements', () => {
      setLocation('https://chatgpt.com/c/abc-def-123');
      document.body.innerHTML = `
        <div data-message-id="m1" data-message-author-role="user">Hello AI</div>
        <div data-message-id="m2" data-message-author-role="assistant">Hello human</div>
      `;
      const fresh = new ChatGPTExtractor();
      const msgs = fresh.extractMessages();
      expect(msgs.length).toBe(2);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('Hello AI');
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].content).toBe('Hello human');
      expect(msgs[0].platform).toBe('chatgpt');
      expect(msgs[0].conversationId).toBe('abc-def-123');
    });
  });
});

describe('ClaudeExtractor', () => {
  const extractor = new ClaudeExtractor();

  it('has correct platform', () => {
    expect(extractor.platform).toBe('claude');
  });

  describe('matches', () => {
    it('matches claude.ai', () => {
      setLocation('https://claude.ai/chat/abc123');
      expect(extractor.matches()).toBe(true);
    });

    it('does not match other domains', () => {
      setLocation('https://example.com/');
      expect(extractor.matches()).toBe(false);
    });
  });

  describe('getConversationId', () => {
    it('extracts ID from /chat/ path', () => {
      setLocation('https://claude.ai/chat/abc-123-def');
      expect(extractor.getConversationId()).toBe('abc-123-def');
    });

    it('returns empty for non-chat paths', () => {
      setLocation('https://claude.ai/');
      expect(extractor.getConversationId()).toBe('');
    });
  });
});

describe('GeminiExtractor', () => {
  const extractor = new GeminiExtractor();

  it('has correct platform', () => {
    expect(extractor.platform).toBe('gemini');
  });

  describe('matches', () => {
    it('matches gemini.google.com', () => {
      setLocation('https://gemini.google.com/app/abc123');
      expect(extractor.matches()).toBe(true);
    });
  });
});

describe('PerplexityExtractor', () => {
  const extractor = new PerplexityExtractor();

  it('has correct platform', () => {
    expect(extractor.platform).toBe('perplexity');
  });

  describe('matches', () => {
    it('matches perplexity.ai', () => {
      setLocation('https://www.perplexity.ai/search/test');
      expect(extractor.matches()).toBe(true);
    });
  });
});

describe('DeepSeekExtractor', () => {
  const extractor = new DeepSeekExtractor();

  it('has correct platform', () => {
    expect(extractor.platform).toBe('deepseek');
  });

  describe('matches', () => {
    it('matches chat.deepseek.com', () => {
      setLocation('https://chat.deepseek.com/a/chat/s/abc123');
      expect(extractor.matches()).toBe(true);
    });

    it('does not match other domains', () => {
      setLocation('https://deepseek.com/');
      expect(extractor.matches()).toBe(false);
    });
  });

  describe('getConversationId', () => {
    it('extracts ID from /a/chat/s/ path', () => {
      setLocation('https://chat.deepseek.com/a/chat/s/abc123');
      expect(extractor.getConversationId()).toBe('abc123');
    });

    it('extracts ID from /chat/s/ path', () => {
      setLocation('https://chat.deepseek.com/chat/s/abc123');
      expect(extractor.getConversationId()).toBe('abc123');
    });
  });
});

describe('HuggingChatExtractor', () => {
  const extractor = new HuggingChatExtractor();

  it('has correct platform', () => {
    expect(extractor.platform).toBe('huggingchat');
  });

  describe('matches', () => {
    it('matches huggingface.co/chat', () => {
      setLocation('https://huggingface.co/chat/conversation/abc123');
      expect(extractor.matches()).toBe(true);
    });

    it('does not match non-chat huggingface pages', () => {
      setLocation('https://huggingface.co/models');
      expect(extractor.matches()).toBe(false);
    });
  });

  describe('getConversationId', () => {
    it('extracts hex ID from conversation path', () => {
      setLocation('https://huggingface.co/chat/conversation/abc123def');
      expect(extractor.getConversationId()).toBe('abc123def');
    });
  });
});

describe('LeChatExtractor', () => {
  const extractor = new LeChatExtractor();

  it('has correct platform', () => {
    expect(extractor.platform).toBe('lechat');
  });

  describe('matches', () => {
    it('matches chat.mistral.ai', () => {
      setLocation('https://chat.mistral.ai/chat/abc123');
      expect(extractor.matches()).toBe(true);
    });
  });

  describe('getConversationId', () => {
    it('extracts ID from /chat/ path', () => {
      setLocation('https://chat.mistral.ai/chat/abc-123');
      expect(extractor.getConversationId()).toBe('abc-123');
    });
  });
});
