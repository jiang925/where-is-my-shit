# Phase 2: Web Intelligence - Research

**Researched:** 2026-02-05
**Domain:** Chrome Extension Development (Manifest V3) + AI Chat Platform DOM Scraping
**Confidence:** HIGH

## Summary

This phase requires building a Chromium-based browser extension that captures AI chat conversations from ChatGPT, Gemini, and Perplexity in real-time and sends them to the local WIMS FastAPI server for indexing. The extension must implement offline-first architecture with queue/retry logic, checkpoint-based deduplication using message fingerprints, and a pluggable extractor pattern for platform-specific DOM scraping.

The standard approach uses Manifest V3 with TypeScript, content scripts with MutationObserver for real-time DOM monitoring, chrome.storage.local for offline queueing, and service workers for background processing. All major extensions in this space follow similar patterns: content scripts observe DOM changes, extract structured data, fingerprint messages for deduplication, queue failed requests locally, and retry when connectivity returns.

Key challenges include: DOM selectors that change frequently across platforms, managing MutationObserver performance with large conversation threads, implementing robust offline queueing without data loss, and handling lazy-loaded content when users scroll through conversation history.

**Primary recommendation:** Use TypeScript + Webpack + MutationObserver pattern with chrome.storage.local for queue persistence and SHA-256 fingerprinting for deduplication.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Capture Strategy:**
- Global on/off toggle — single switch for all capture, no per-site toggles
- Checkpoint mechanism with message fingerprints/hashes for deduplication — web UIs don't always load full conversations on page load
- Capture on scroll — when user scrolls up and lazy-loaded history appears, capture those messages too
- Capture conversation titles from sidebar/header for search context and grouping
- Minimal popup UI: global on/off toggle, server connection status, last capture timestamp

**Content Extraction:**
- Non-text content (images, files, artifacts): capture references only (e.g., "[Image: screenshot.png]"), not the content itself
- Messages indexed separately with role labels ("user" / "assistant") — enables searching by role
- Deep linking: best effort to link to specific message, fall back to conversation page if not possible

**Platform Handling:**
- Implementation order: ChatGPT first, then Gemini and Perplexity as follow-ups within this phase
- ChatGPT: standard chat interface only (/c/ URLs) — skip canvas, shared links, playground
- Pluggable extractor architecture — each platform is a separate module with a shared interface, making it easy to add new platforms later
- Scope limited to the three roadmap platforms (ChatGPT, Gemini, Perplexity) — additional platforms are future work

**Server Communication:**
- Queue and retry when WIMS server is unreachable — store locally (IndexedDB/chrome.storage), deliver when server comes back
- Server URL configured by user in extension settings (not auto-discovered)

**Extension Environment:**
- Extension should work as a Chrome/Edge extension (Chromium-based)
- The popup is minimal by design — just a toggle and status, not a full management UI

### Claude's Discretion

- Capture mechanism implementation (MutationObserver vs polling vs hybrid)
- Conversation identifier strategy (platform URL IDs vs WIMS-generated)
- Code block extraction granularity
- Visual capture indicator (icon color, badge, or silent)
- Message batching/debouncing strategy
- Whether Phase 1 API needs extension-specific endpoints

### Deferred Ideas (OUT OF SCOPE)

- Additional platforms (Claude.ai, Grok, etc.) — future iteration using the pluggable extractor pattern
- Canvas/artifact content capture — beyond standard chat
- Shared conversation link capture

</user_constraints>

## Standard Stack

The established libraries/tools for Chrome extension development with DOM scraping and offline-first architecture:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **TypeScript** | 5.0+ | Type-safe development | Industry standard for Chrome extensions, prevents runtime errors, excellent IDE support |
| **Webpack** | 5.x | Module bundler | Most mature bundler for Chrome extensions, handles manifest.json, supports multiple entry points |
| **Manifest V3** | Current | Extension API | Mandatory for new extensions in 2026, service workers replace background pages |
| **chrome.storage** | Built-in | Extension storage | Purpose-built for extensions, accessible across all contexts (service worker + content scripts) |
| **MutationObserver** | Built-in Web API | DOM change detection | Native browser API, significantly faster than polling, required since Mutation Events deprecated |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@types/chrome** | Latest | TypeScript definitions | Always - provides complete typing for Chrome extension APIs |
| **ts-loader** | Latest | TypeScript loader for webpack | Always - compiles TypeScript in webpack build pipeline |
| **copy-webpack-plugin** | Latest | Copy static assets | Always - copies manifest.json, icons, HTML files to dist |
| **SubtleCrypto (Web Crypto API)** | Built-in | SHA-256 hashing | Message fingerprinting for deduplication |
| **webextension-polyfill** | Optional | Cross-browser compatibility | Only if targeting Firefox (Chrome-specific is fine for this project) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **Webpack** | **Vite + CRXJS** | Vite is faster but CRXJS plugin has fewer production examples for complex extensions (as of 2026). Webpack is more battle-tested. |
| **chrome.storage.local** | **IndexedDB** | IndexedDB has more capacity but chrome.storage is simpler, works in service workers, and sufficient for queue storage |
| **MutationObserver** | **Polling (setInterval)** | Polling wastes CPU cycles, misses rapid changes, blocked by performance best practices |
| **TypeScript** | **Plain JavaScript** | JS lacks type safety, increases runtime errors in complex message passing scenarios |

**Installation:**
```bash
npm install --save-dev \
  typescript \
  webpack webpack-cli \
  ts-loader \
  copy-webpack-plugin \
  @types/chrome
```

## Architecture Patterns

### Recommended Project Structure

```
extension/
├── manifest.json                # V3 manifest
├── src/
│   ├── background/
│   │   └── service-worker.ts   # Background service worker (V3)
│   ├── content/
│   │   ├── index.ts            # Content script entry point
│   │   ├── observers/
│   │   │   └── mutation-observer.ts
│   │   └── extractors/
│   │       ├── base.ts         # Abstract base extractor
│   │       ├── chatgpt.ts      # ChatGPT extractor
│   │       ├── gemini.ts       # Gemini extractor
│   │       └── perplexity.ts   # Perplexity extractor
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts            # Minimal UI: toggle + status
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   ├── options.ts          # Settings page (server URL)
│   │   └── options.css
│   ├── lib/
│   │   ├── storage.ts          # chrome.storage wrapper
│   │   ├── queue.ts            # Offline queue + retry logic
│   │   ├── fingerprint.ts      # SHA-256 message hashing
│   │   └── api.ts              # WIMS server API client
│   └── types/
│       ├── message.ts          # Message structure types
│       └── platform.ts         # Platform enum + types
├── dist/                        # Build output (gitignored)
├── webpack.config.js
├── tsconfig.json
└── package.json
```

### Pattern 1: Pluggable Extractor Architecture

**What:** Abstract base class defining common interface for platform-specific extractors
**When to use:** When supporting multiple platforms with different DOM structures
**Example:**
```typescript
// src/content/extractors/base.ts
export interface ExtractedMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  messageId: string;
  url: string;
}

export abstract class BaseExtractor {
  abstract platform: string;
  abstract matches(): boolean;
  abstract extractMessages(): ExtractedMessage[];
  abstract getConversationTitle(): string;
  abstract getConversationId(): string;

  // Common utility methods
  protected generateFingerprint(message: ExtractedMessage): Promise<string> {
    const text = `${message.conversationId}|${message.role}|${message.content}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// src/content/extractors/chatgpt.ts
export class ChatGPTExtractor extends BaseExtractor {
  platform = 'chatgpt';

  matches(): boolean {
    return window.location.hostname === 'chatgpt.com' &&
           window.location.pathname.startsWith('/c/');
  }

  extractMessages(): ExtractedMessage[] {
    // ChatGPT-specific DOM queries
    const messages: ExtractedMessage[] = [];
    const messageElements = document.querySelectorAll('[data-message-id]');

    messageElements.forEach(el => {
      const role = el.getAttribute('data-message-author-role') as 'user' | 'assistant';
      const content = this.extractContent(el);
      const messageId = el.getAttribute('data-message-id') || '';

      messages.push({
        content,
        role,
        timestamp: new Date(),
        conversationId: this.getConversationId(),
        messageId,
        url: window.location.href
      });
    });

    return messages;
  }

  getConversationId(): string {
    // Extract from URL: /c/abc123
    const match = window.location.pathname.match(/\/c\/([^\/]+)/);
    return match ? match[1] : '';
  }

  getConversationTitle(): string {
    const titleEl = document.querySelector('[data-testid="conversation-title"]');
    return titleEl?.textContent || 'Untitled Conversation';
  }

  private extractContent(element: Element): string {
    // Handle code blocks separately
    const codeBlocks = element.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      block.textContent = `[Code: ${block.className}]\n${block.textContent}`;
    });

    // Handle images
    const images = element.querySelectorAll('img');
    images.forEach(img => {
      img.replaceWith(document.createTextNode(`[Image: ${img.alt || 'unnamed'}]`));
    });

    return element.textContent || '';
  }
}
```

### Pattern 2: MutationObserver with Debouncing

**What:** Watch DOM for new messages, debounce processing to avoid excessive API calls
**When to use:** Real-time capture of dynamically loaded content
**Example:**
```typescript
// src/content/observers/mutation-observer.ts
export class MessageObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private readonly DEBOUNCE_MS = 1000;
  private seenFingerprints = new Set<string>();

  start(extractor: BaseExtractor, onNewMessages: (messages: ExtractedMessage[]) => void) {
    const config: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: false  // Don't watch attributes for performance
    };

    this.observer = new MutationObserver(() => {
      this.debouncedProcess(extractor, onNewMessages);
    });

    // Observe the main content area
    const targetNode = document.querySelector('main') || document.body;
    this.observer.observe(targetNode, config);

    // Initial extraction
    this.processMessages(extractor, onNewMessages);
  }

  private debouncedProcess(extractor: BaseExtractor, callback: (messages: ExtractedMessage[]) => void) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.processMessages(extractor, callback);
    }, this.DEBOUNCE_MS);
  }

  private async processMessages(extractor: BaseExtractor, callback: (messages: ExtractedMessage[]) => void) {
    const messages = extractor.extractMessages();
    const newMessages: ExtractedMessage[] = [];

    for (const message of messages) {
      const fingerprint = await extractor.generateFingerprint(message);

      if (!this.seenFingerprints.has(fingerprint)) {
        this.seenFingerprints.add(fingerprint);
        newMessages.push(message);
      }
    }

    if (newMessages.length > 0) {
      callback(newMessages);
    }
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
```

### Pattern 3: Offline Queue with Retry Logic

**What:** Store failed requests locally, retry when server becomes available
**When to use:** Always for extension-to-server communication
**Example:**
```typescript
// src/lib/queue.ts
interface QueuedRequest {
  id: string;
  messages: ExtractedMessage[];
  timestamp: number;
  retryCount: number;
}

export class OfflineQueue {
  private readonly STORAGE_KEY = 'wims_queue';
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY_MS = 5000;
  private isProcessing = false;

  async enqueue(messages: ExtractedMessage[]): Promise<void> {
    const item: QueuedRequest = {
      id: crypto.randomUUID(),
      messages,
      timestamp: Date.now(),
      retryCount: 0
    };

    const queue = await this.getQueue();
    queue.push(item);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: queue });

    // Trigger immediate processing attempt
    this.processQueue();
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const queue = await this.getQueue();
      const remaining: QueuedRequest[] = [];

      for (const item of queue) {
        try {
          await this.sendToServer(item.messages);
          // Success - don't add to remaining
        } catch (error) {
          item.retryCount++;

          if (item.retryCount < this.MAX_RETRIES) {
            remaining.push(item);
          } else {
            console.error(`Dropped queued item ${item.id} after ${this.MAX_RETRIES} retries`);
          }
        }
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: remaining });

      // Schedule next retry if items remain
      if (remaining.length > 0) {
        setTimeout(() => this.processQueue(), this.RETRY_DELAY_MS);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async getQueue(): Promise<QueuedRequest[]> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  }

  private async sendToServer(messages: ExtractedMessage[]): Promise<void> {
    const config = await this.getConfig();

    for (const message of messages) {
      const response = await fetch(`${config.serverUrl}/api/v1/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: message.conversationId,
          platform: message.platform,
          title: message.conversationTitle,
          content: message.content,
          role: message.role,
          timestamp: message.timestamp.toISOString(),
          url: message.url
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    }
  }

  private async getConfig(): Promise<{ serverUrl: string }> {
    const result = await chrome.storage.sync.get('serverUrl');
    return { serverUrl: result.serverUrl || 'http://localhost:8000' };
  }
}
```

### Pattern 4: Message Passing (Content Script ↔ Service Worker)

**What:** Communication between content scripts and background service worker
**When to use:** Coordinating capture state, relaying messages to queue
**Example:**
```typescript
// Content script sends captured messages to service worker
chrome.runtime.sendMessage({
  type: 'MESSAGES_CAPTURED',
  payload: { messages: extractedMessages }
});

// Service worker receives and queues
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MESSAGES_CAPTURED') {
    const queue = new OfflineQueue();
    queue.enqueue(message.payload.messages);
    sendResponse({ success: true });
  }
});
```

### Anti-Patterns to Avoid

- **Observing entire document.body with all options enabled:** Causes severe performance degradation. Use specific selectors and minimal config (childList + subtree only).
- **Storing large message content in chrome.storage.sync:** Sync storage has 8KB per item limit. Use chrome.storage.local for queue.
- **Direct CSS selector dependencies on platform DOM:** Selectors change frequently. Use data attributes or semantic queries where possible, abstract in extractor layer.
- **Blocking service worker with long-running operations:** Service workers shut down after 30s of inactivity. Use alarms API for periodic tasks.
- **Forgetting to disconnect MutationObserver:** Causes memory leaks and continued processing after user leaves page.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **SHA-256 hashing** | Custom hash function | `crypto.subtle.digest('SHA-256', data)` | Web Crypto API is native, hardware-accelerated, collision-resistant |
| **Debouncing** | Custom setTimeout wrapper | Lodash `debounce` (if already in deps) or simple wrapper | Edge cases like leading/trailing calls, cancel handling |
| **Deep object comparison** | Manual JSON.stringify comparison | Object fingerprinting via stable properties | JSON.stringify is unreliable (key order), use deterministic content-based hash |
| **UUID generation** | Math.random() based IDs | `crypto.randomUUID()` | Native, cryptographically secure, proper RFC 4122 format |
| **Chrome API Promise wrappers** | Manual promisify utils | Native promise support (Chrome 90+) | Modern Chrome APIs support promises directly |

**Key insight:** Chrome extension APIs and Web Platform APIs have matured significantly. Native solutions are more performant and better tested than custom implementations.

## Common Pitfalls

### Pitfall 1: DOM Selectors Break Across Platform Updates

**What goes wrong:** ChatGPT, Gemini, and Perplexity frequently change their DOM structure, CSS classes, and data attributes. Hardcoded selectors like `.message-content-block` suddenly stop working.

**Why it happens:** AI chat platforms iterate rapidly on UI/UX. Class names are often generated by CSS-in-JS libraries and include random hashes. Platforms don't provide stable APIs for third-party extensions.

**How to avoid:**
1. Use pluggable extractor pattern to isolate platform-specific code
2. Prefer semantic HTML queries (`article`, `[role="article"]`) over CSS classes
3. Implement fallback strategies (multiple selector attempts)
4. Add comprehensive logging to detect extraction failures
5. Consider using chatgpt.js-style abstraction libraries if they exist and are maintained

**Warning signs:**
- Extraction suddenly returns empty arrays
- Console errors about null elements
- User reports no new conversations being captured

### Pitfall 2: MutationObserver Performance Degradation with Large Conversations

**What goes wrong:** Long conversations (100+ messages) cause MutationObserver callback to fire excessively, blocking the main thread and making the page sluggish.

**Why it happens:** Each new message triggers mutations on ancestor nodes. Without debouncing, the callback fires dozens of times per second during active chat sessions. Processing full DOM extraction on each call is expensive.

**How to avoid:**
1. Implement debouncing (1-2 second delay)
2. Use `childList: true, subtree: true` only, disable `attributes` and `characterData`
3. Process only new nodes in mutation records, not full re-extraction
4. Maintain in-memory set of seen message fingerprints to skip duplicates
5. Consider throttling: only observe when tab is active, pause when hidden

**Warning signs:**
- Page becomes unresponsive during chat
- High CPU usage in DevTools profiler
- Browser tab shows "Page Unresponsive" warning

### Pitfall 3: Losing Queued Messages on Extension Update

**What goes wrong:** Users lose pending messages when the extension updates or Chrome restarts.

**Why it happens:** chrome.storage.local is persistent, but in-memory queue state is lost. Service workers terminate after 30 seconds of inactivity. Developers forget to restore queue state on service worker startup.

**How to avoid:**
1. Store queue state exclusively in chrome.storage.local, never in memory
2. Implement queue restoration in service worker startup listener
3. Use chrome.alarms API for periodic queue processing (survives restarts)
4. Add queue size monitoring and log warnings if queue grows unbounded

**Warning signs:**
- Queue size increases but messages never get processed
- Users report missing messages after extension updates
- Storage quota warnings

### Pitfall 4: Race Condition with Lazy-Loaded History

**What goes wrong:** When users scroll up to view old messages, the platform lazy-loads them into the DOM. MutationObserver detects them as "new" even though they're already indexed.

**Why it happens:** Checkpoint-based deduplication fingerprints aren't persisted across sessions. Extension treats lazy-loaded history as new content.

**How to avoid:**
1. Persist message fingerprints in chrome.storage.local with conversation ID as key
2. Check fingerprint cache before queueing messages
3. Implement fingerprint cache eviction (e.g., keep last 1000 per conversation)
4. Use timestamps to detect old messages (compare message timestamp to last sync)

**Warning signs:**
- Duplicate messages appearing in search results
- Storage quota filling up rapidly
- Users report seeing same message multiple times

### Pitfall 5: Service Worker Termination Mid-Request

**What goes wrong:** Background service worker terminates after 30 seconds of inactivity, interrupting in-flight API requests to WIMS server.

**Why it happens:** Manifest V3 uses event-driven service workers, not persistent background pages. Long-running operations don't keep the worker alive.

**How to avoid:**
1. Use fetch API with timeout (10 second max per request)
2. Implement proper queue persistence BEFORE sending request
3. Mark items as "in-flight" and retry on service worker restart
4. Use chrome.alarms for periodic queue processing (survives termination)
5. Batch small messages to reduce request count

**Warning signs:**
- Requests hang indefinitely
- Service worker logs show sudden termination
- Queue items stuck in "processing" state

### Pitfall 6: Checkpoint Fingerprints Grow Unbounded

**What goes wrong:** Storing every message fingerprint forever exhausts chrome.storage.local quota (10MB).

**Why it happens:** Active users generate thousands of messages per week. Each SHA-256 hash is 64 characters. Without eviction, storage fills up.

**How to avoid:**
1. Implement LRU cache with max size (e.g., 10,000 fingerprints)
2. Store fingerprints per conversation, evict old conversations
3. Use bloom filter for space-efficient deduplication (small false positive rate acceptable)
4. Periodic cleanup: remove fingerprints for conversations older than 30 days

**Warning signs:**
- chrome.storage.local quota exceeded errors
- Deduplication stops working
- Extension settings fail to save

## Code Examples

Verified patterns from official sources and established community practices:

### Example 1: Manifest V3 Declaration

```json
{
  "manifest_version": 3,
  "name": "WIMS Capture",
  "version": "1.0.0",
  "description": "Capture AI chat conversations for local search",
  "permissions": [
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "http://localhost/*"
  ],
  "background": {
    "service_worker": "dist/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*"
      ],
      "js": ["dist/content/index.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Example 2: Content Script Entry Point

```typescript
// src/content/index.ts
import { ChatGPTExtractor } from './extractors/chatgpt';
import { GeminiExtractor } from './extractors/gemini';
import { PerplexityExtractor } from './extractors/perplexity';
import { MessageObserver } from './observers/mutation-observer';
import { BaseExtractor, ExtractedMessage } from './extractors/base';

class ContentScriptMain {
  private observer: MessageObserver | null = null;
  private extractor: BaseExtractor | null = null;

  async init() {
    // Check if capture is enabled
    const { captureEnabled } = await chrome.storage.sync.get('captureEnabled');
    if (!captureEnabled) return;

    // Detect platform and instantiate appropriate extractor
    const extractors = [
      new ChatGPTExtractor(),
      new GeminiExtractor(),
      new PerplexityExtractor()
    ];

    this.extractor = extractors.find(e => e.matches()) || null;
    if (!this.extractor) {
      console.log('[WIMS] No matching platform extractor found');
      return;
    }

    console.log(`[WIMS] Initialized ${this.extractor.platform} extractor`);

    // Start observing
    this.observer = new MessageObserver();
    this.observer.start(this.extractor, (messages) => {
      this.handleNewMessages(messages);
    });

    // Listen for scroll events (lazy-loaded history)
    window.addEventListener('scroll', () => {
      this.observer?.triggerCheck();
    });
  }

  private handleNewMessages(messages: ExtractedMessage[]) {
    console.log(`[WIMS] Captured ${messages.length} new messages`);

    // Send to service worker for queueing
    chrome.runtime.sendMessage({
      type: 'MESSAGES_CAPTURED',
      payload: {
        messages,
        conversationTitle: this.extractor?.getConversationTitle() || 'Untitled'
      }
    });
  }

  cleanup() {
    this.observer?.stop();
  }
}

const main = new ContentScriptMain();
main.init();

// Cleanup on page unload
window.addEventListener('beforeunload', () => main.cleanup());
```

### Example 3: Service Worker with Periodic Queue Processing

```typescript
// src/background/service-worker.ts
import { OfflineQueue } from '../lib/queue';

const queue = new OfflineQueue();

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MESSAGES_CAPTURED') {
    queue.enqueue(message.payload.messages)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Set up periodic queue processing (survives service worker restarts)
chrome.alarms.create('processQueue', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'processQueue') {
    queue.processQueue();
  }
});

// Process queue on service worker startup
queue.processQueue();

console.log('[WIMS] Service worker initialized');
```

### Example 4: SHA-256 Message Fingerprinting

```typescript
// src/lib/fingerprint.ts
export async function generateFingerprint(
  conversationId: string,
  role: string,
  content: string
): Promise<string> {
  // Normalize content (trim whitespace, lowercase for robustness)
  const normalized = content.trim().toLowerCase();
  const text = `${conversationId}|${role}|${normalized}`;

  // Use Web Crypto API for SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if message was already seen
export async function hasSeenMessage(fingerprint: string): Promise<boolean> {
  const key = 'seen_fingerprints';
  const result = await chrome.storage.local.get(key);
  const seen: Set<string> = new Set(result[key] || []);
  return seen.has(fingerprint);
}

// Mark message as seen with LRU eviction
export async function markMessageSeen(fingerprint: string, maxSize = 10000): Promise<void> {
  const key = 'seen_fingerprints';
  const result = await chrome.storage.local.get(key);
  const seen: string[] = result[key] || [];

  // Add to front (most recent)
  seen.unshift(fingerprint);

  // Evict old entries if over limit
  const trimmed = seen.slice(0, maxSize);

  await chrome.storage.local.set({ [key]: trimmed });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| **Manifest V2** | **Manifest V3** | 2023 (mandatory 2024) | Service workers replace persistent background pages, declarativeNetRequest replaces blocking webRequest |
| **Mutation Events** | **MutationObserver** | Deprecated 2012, removed Chrome 127 (2024) | 10-100x performance improvement, callback-based API |
| **window.localStorage** | **chrome.storage.local** | Always preferred for extensions | Works in service workers, accessible across contexts, higher quota |
| **Callback-based Chrome APIs** | **Promise-based APIs** | Chrome 90+ (2021) | Modern async/await syntax, better error handling |
| **Polling DOM with setInterval** | **MutationObserver** | Since 2012 | Event-driven vs polling, massive CPU savings |
| **Custom bundlers** | **Webpack 5 / Vite** | Webpack 5 stable 2020, Vite 2020+ | Module federation, better tree-shaking, HMR support |

**Deprecated/outdated:**
- **chrome.extension.sendRequest()**: Removed, use `chrome.runtime.sendMessage()`
- **chrome.tabs.sendRequest()**: Removed, use `chrome.tabs.sendMessage()`
- **Persistent background pages**: V3 requires service workers
- **Remotely hosted code**: All code must be packaged in CRX, no runtime eval()

## Open Questions

Things that couldn't be fully resolved:

1. **ChatGPT DOM Selector Stability**
   - What we know: ChatGPT uses React with dynamic class names, frequent UI updates
   - What's unclear: Whether data attributes like `[data-message-id]` are stable or likely to change
   - Recommendation: Implement extractor with multiple fallback strategies, extensive logging to detect breakage early, consider chatgpt.js library if actively maintained

2. **Gemini and Perplexity DOM Structures**
   - What we know: Both are AI chat platforms with similar UX patterns to ChatGPT
   - What's unclear: Specific DOM structures, data attributes, and lazy-loading behavior
   - Recommendation: Implement ChatGPT first, then reverse-engineer Gemini/Perplexity using same observer pattern, expect 2-3 days per platform for DOM analysis

3. **Optimal Fingerprint Cache Size**
   - What we know: chrome.storage.local has 10MB quota, SHA-256 hashes are 64 bytes
   - What's unclear: Typical user conversation volume, optimal cache eviction strategy
   - Recommendation: Start with 10,000 fingerprint cache, monitor storage usage in beta testing, implement LRU eviction

4. **Deep Linking Stability**
   - What we know: Chrome supports Text Fragments (#:~:text=), ChatGPT has message IDs in URLs
   - What's unclear: Whether message-specific URLs persist after page reloads, whether platforms support direct message linking
   - Recommendation: Best-effort deep linking, fall back to conversation URL if message link fails, test with real platform usage

5. **API Endpoint Design for Extension**
   - What we know: Phase 1 has `/api/v1/ingest` accepting single messages
   - What's unclear: Whether batching endpoint would be beneficial, whether to extend existing API or create extension-specific endpoint
   - Recommendation: Start with existing `/api/v1/ingest`, add batch endpoint if network overhead becomes issue (test in beta)

## Sources

### Primary (HIGH confidence)

**Official Chrome Documentation:**
- [Manifest V3 Overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) - Architecture requirements
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) - Storage patterns
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) - Content script communication
- [Workbox Background Sync](https://developer.chrome.com/docs/workbox/retrying-requests-when-back-online) - Queue patterns
- [MutationObserver MDN](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) - DOM observation

**Community Best Practices:**
- [Chrome Extension Best Practices (GitHub)](https://github.com/dipankar/chrome-extension-best-practices) - Manifest V3 patterns
- [Extension Radar Blog: How to Make a Chrome Extension in 2025](https://www.extensionradar.com/blog/how-to-make-chrome-extension) - Current development guide

### Secondary (MEDIUM confidence)

**Development Patterns:**
- [Building a Chrome Extension with Webpack and TypeScript](https://medium.com/@iamkyutneryan/building-a-chrome-extension-with-webpack-and-typescript-6524276024e2) - Tooling setup
- [State Storage in Chrome Extensions (HackerNoon)](https://hackernoon.com/state-storage-in-chrome-extensions-options-limits-and-best-practices) - Storage strategy
- [React Performance Optimization: Debouncing, Throttling & Request Batching](https://dev.to/maurya-sachin/react-performance-optimization-part-4-debouncing-throttling-request-batching-3h8p) - Batching patterns

**Offline-First Architecture:**
- [Offline-first frontend apps in 2025: IndexedDB and SQLite](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - Storage patterns
- [SHA-256 and SHA-3 in 2026: Practical Guidance for Developers](https://thelinuxcode.com/sha-256-and-sha-3-in-2026-practical-guidance-for-developers/) - Fingerprinting

### Tertiary (LOW confidence)

**Platform-Specific Scraping:**
- [chatgpt.js User Guide](https://github.com/kudoai/chatgpt.js/blob/main/docs/USERGUIDE.md) - ChatGPT DOM abstraction (WARNING: May not be maintained)
- [Web Scraping with Gemini AI](https://oxylabs.io/blog/gemini-web-scraping) - AI-based scraping approach (not directly applicable)
- [Web Scraping with Perplexity AI](https://brightdata.com/blog/web-data/web-scraping-with-perplexity) - Platform overview (not extension-focused)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Chrome documentation, established patterns
- Architecture: HIGH - Manifest V3 requirements well-documented, MutationObserver is standard
- Pitfalls: HIGH - Based on official docs and verified community reports
- Platform DOM structures: LOW - ChatGPT/Gemini/Perplexity selectors require reverse engineering
- Offline queue patterns: HIGH - Workbox Background Sync is official Chrome solution

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days) - Chrome extensions are stable, but AI platform UIs change frequently
