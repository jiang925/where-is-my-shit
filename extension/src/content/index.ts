import { ExtractedMessage } from '../types/message';
import { getSettings } from '../lib/storage';
import { BaseExtractor } from './extractors/base';
import { MessageObserver } from './observers/mutation-observer';
import { ChatGPTExtractor } from './extractors/chatgpt';
import { ClaudeExtractor } from './extractors/claude';
import { CopilotExtractor } from './extractors/copilot';
import { DeepSeekExtractor } from './extractors/deepseek';
import { DoubaoExtractor } from './extractors/doubao';
import { GeminiExtractor } from './extractors/gemini';
import { GrokExtractor } from './extractors/grok';
import { HuggingChatExtractor } from './extractors/huggingchat';
import { KimiExtractor } from './extractors/kimi';
import { LeChatExtractor } from './extractors/lechat';
import { PerplexityExtractor } from './extractors/perplexity';
import { PoeExtractor } from './extractors/poe';
import { QwenExtractor } from './extractors/qwen';

console.log('[WIMS Content] Script loaded on:', window.location.href);

let observer: MessageObserver | null = null;

/**
 * Initialize content script
 */
async function init() {
  // Check if capture is enabled
  const settings = await getSettings();
  if (!settings.captureEnabled) {
    console.log('[WIMS Content] Capture disabled, exiting');
    return;
  }

  // Instantiate all extractors
  const extractors: BaseExtractor[] = [
    new ChatGPTExtractor(),
    new ClaudeExtractor(),
    new CopilotExtractor(),
    new DeepSeekExtractor(),
    new DoubaoExtractor(),
    new GeminiExtractor(),
    new GrokExtractor(),
    new HuggingChatExtractor(),
    new KimiExtractor(),
    new LeChatExtractor(),
    new PerplexityExtractor(),
    new PoeExtractor(),
    new QwenExtractor(),
  ];

  // Find matching extractor
  const extractor = extractors.find(e => e.matches());
  if (!extractor) {
    console.log('[WIMS Content] No matching extractor for this page');
    return;
  }

  console.log(`[WIMS Content] Matched extractor: ${extractor.platform}`);

  // Create and start observer
  observer = new MessageObserver();
  observer.start(extractor, handleNewMessages);

  // Add scroll listener with debounce (500ms)
  let scrollTimeout: number | null = null;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = window.setTimeout(() => {
      if (observer) {
        observer.triggerCheck();
      }
    }, 500);
  });

  // Listen for storage changes to enable/disable capture dynamically
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings.captureEnabled === false && observer) {
        console.log('[WIMS Content] Capture disabled, stopping observer');
        observer.stop();
        observer = null;
      } else if (newSettings.captureEnabled === true && !observer) {
        console.log('[WIMS Content] Capture enabled, restarting observer');
        init();
      }
    }
  });

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (observer) {
      observer.stop();
    }
  });
}

/**
 * Handle new messages from observer
 */
function handleNewMessages(messages: ExtractedMessage[], conversationTitle: string) {
  if (messages.length === 0) return;

  console.log(`[WIMS Content] Sending ${messages.length} new messages to service worker`);

  chrome.runtime.sendMessage({
    type: 'MESSAGES_CAPTURED',
    payload: {
      messages,
      conversationTitle
    }
  }).catch(err => {
    console.error('[WIMS Content] Failed to send messages:', err);
  });
}

// Start initialization
init().catch(err => {
  console.error('[WIMS Content] Initialization error:', err);
});
