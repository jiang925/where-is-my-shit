---
phase: 02-web-intelligence
plan: 02
subsystem: extension-capture
tags: [chrome-extension, chatgpt, mutation-observer, service-worker, popup, offline-queue]
requires: [02-01]
provides:
  - chatgpt-capture-pipeline
  - mutation-observer-pattern
  - offline-queue-processing
  - minimal-popup-ui
affects: [02-03, 02-04]
tech-stack:
  added: []
  patterns:
    - mutation-observer-with-debounce
    - fingerprint-deduplication
    - service-worker-message-relay
key-files:
  created:
    - extension/src/background/service-worker.ts
    - extension/src/content/index.ts
    - extension/src/content/observers/mutation-observer.ts
    - extension/src/content/extractors/chatgpt.ts
    - extension/src/popup/popup.ts
    - extension/src/popup/popup.html
    - extension/src/popup/popup.css
    - extension/src/options/options.ts
    - extension/src/options/options.html
    - extension/src/options/options.css
  modified: []
decisions: []
metrics:
  duration: 4m 36s
  completed: 2026-02-06
---

# Phase 2 Plan 02: Service Worker + ChatGPT Extractor + Popup UI Summary

**One-liner:** Complete ChatGPT capture pipeline with MutationObserver DOM detection, fingerprint deduplication, offline queue, and minimal toggle/status popup.

## What Was Built

Implemented the first end-to-end vertical slice for ChatGPT conversation capture:

**Service Worker (Background):**
- Message relay handling three message types: `MESSAGES_CAPTURED`, `GET_STATUS`, `TOGGLE_CAPTURE`
- Converts `ExtractedMessage` to `IngestPayload` and enqueues via `OfflineQueue`
- Periodic queue processing every 1 minute via `chrome.alarms`
- Immediate queue processing on service worker startup
- Status endpoint providing queue size, server health, and last capture timestamp

**Content Script Orchestrator:**
- Platform detection via extractor `matches()` method
- Initializes ChatGPT extractor and starts `MessageObserver`
- Scroll listener (debounced 500ms) triggers re-extraction for lazy-loaded history
- Dynamic enable/disable via `chrome.storage.onChanged` listener
- Cleanup on page unload

**MutationObserver:**
- Watches `childList + subtree` only (no `attributes`, no `characterData` per research pitfall #2)
- Debounced processing (1 second) to avoid excessive extractions
- Fingerprint deduplication using SHA-256 hash of `conversationId|role|content`
- In-memory `Set` plus persisted seen fingerprints (10k LRU cache) for fast dedup
- Public `triggerCheck()` method for manual extraction on scroll

**ChatGPT Extractor:**
- Matches `chatgpt.com` on `/c/{uuid}` paths or main page (`/`)
- Extracts conversation ID from URL pathname
- Multi-selector fallback strategy for robust DOM scraping:
  - Primary: `[data-message-id]` attribute
  - Fallback: `<article>` tags
  - Last resort: class-based selection
- Role detection via `data-message-author-role` attribute with fallback inference
- Special content handling:
  - Code blocks: wrapped in markdown backticks with language labels
  - Images: replaced with `[Image: alt]`
  - File attachments: replaced with `[File: name]`
- Conversation title extraction with multi-selector fallback (`h1`, `data-testid`, active sidebar item)
- Uses current time as timestamp (ChatGPT doesn't expose per-message timestamps)
- Conversation URL as deep link (ChatGPT lacks reliable message-level deep links)

**Popup UI:**
- Toggle switch for global capture enable/disable
- Server status indicator (green/red dot) with "Connected" / "Offline" text
- Queue size display (only visible when > 0)
- Last capture timestamp with relative formatting (2m ago, 5h ago, 1d ago)
- Auto-refresh status every 5 seconds while popup is open
- Settings link opens options page via `chrome.runtime.openOptionsPage()`
- Width: 280px, clean minimal design with system fonts

**Options Page:**
- Server URL configuration input field
- URL validation (must start with `http://` or `https://`)
- Save button with persistence to `chrome.storage.local`
- Test connection button calls `ApiClient.checkHealth()`
- Status messages with color-coded success/error/info states
- Auto-hide success messages after 3 seconds
- Disabled buttons during connection test

## Architecture Patterns Established

**MutationObserver with Debouncing:**
- Observes DOM with `childList: true, subtree: true` configuration
- 1-second debounce prevents excessive extraction during rapid DOM updates
- Initial extraction on observer start captures existing messages

**Fingerprint Deduplication:**
- SHA-256 hash of `conversationId|role|normalized_content`
- Dual-layer checking: in-memory Set + persisted storage (10k LRU)
- Fast in-memory check first, persistent storage prevents re-capture after extension restart

**Service Worker Message Relay:**
- Content script → service worker → offline queue → WIMS server
- Async message handling with `return true` for async `sendResponse`
- Status aggregation from multiple sources (queue, server health, storage)

**Scroll-triggered Extraction:**
- Debounced scroll listener (500ms) calls `observer.triggerCheck()`
- Captures lazy-loaded message history as user scrolls up
- Prevents duplicate capture via fingerprint deduplication

## Data Flow Verification

**Capture Pipeline:**
```
ChatGPT DOM
    ↓ (MutationObserver detects changes)
ChatGPTExtractor.extractMessages()
    ↓ (returns ExtractedMessage[])
MessageObserver deduplication (fingerprints)
    ↓ (new messages only)
content/index.ts callback
    ↓ (chrome.runtime.sendMessage MESSAGES_CAPTURED)
service-worker.ts handler
    ↓ (converts to IngestPayload)
OfflineQueue.enqueue()
    ↓ (chrome.storage.local persistence)
Periodic processing (1 minute alarm)
    ↓ (ApiClient.sendMessage)
WIMS Server /api/v1/ingest
```

**Status Flow:**
```
Popup open
    ↓ (chrome.runtime.sendMessage GET_STATUS)
service-worker.ts handler
    ↓ (parallel operations)
    ├─ queue.getQueueSize()
    ├─ ApiClient.checkHealth()
    └─ getSettings().lastCaptureTimestamp
    ↓ (aggregate response)
Popup UI updates
    └─ Auto-refresh every 5 seconds
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing Performed

**Build Verification:**
- `npm run build` succeeds with no errors
- All entry points compiled: service-worker.js, content/index.js, popup/popup.js, options/options.js
- ChatGPT extractor bundled into content script (verified via grep)

**Message Handler Verification:**
- Service worker includes all three message types in compiled output
- `MESSAGES_CAPTURED`, `GET_STATUS`, `TOGGLE_CAPTURE` handlers present

**File Artifact Verification:**
- Popup HTML/CSS/JS present in dist/
- Options HTML/CSS/JS present in dist/
- Manifest.json copied to dist/

**Code Quality:**
- TypeScript compilation succeeds with no type errors
- All imports resolve correctly
- Webpack bundling produces optimized minified output

## Known Limitations

1. **ChatGPT-only:** Gemini and Perplexity extractors deferred to Plan 02-03
2. **No timestamps:** ChatGPT doesn't expose per-message timestamps in DOM; using capture time as proxy
3. **No message-level deep links:** ChatGPT lacks reliable message anchors; using conversation URL instead
4. **DOM selector fragility:** Multi-selector fallback mitigates risk, but ChatGPT DOM changes could break extraction
5. **Code block language detection:** Best-effort extraction from classes and headers; may miss some language labels

## Next Phase Readiness

**Prerequisites for Plan 02-03 (Gemini & Perplexity Extractors):**
- ✅ BaseExtractor pattern established
- ✅ MessageObserver generic for any platform
- ✅ Content script orchestrator supports multiple extractors
- ✅ Service worker pipeline platform-agnostic

**Outstanding Work:**
- Implement `GeminiExtractor` class (DOM research needed)
- Implement `PerplexityExtractor` class (DOM research needed)
- Add extractors to content/index.ts array
- Update manifest content_scripts matches if needed

**Blockers:**
- None

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1-2  | Service worker, content script, observer, ChatGPT extractor | 067f2eb | service-worker.ts, index.ts, mutation-observer.ts, chatgpt.ts |
| 3    | Popup UI and options page | af87e97 | popup.html/ts/css, options.html/ts/css |

**Total Duration:** 4 minutes 36 seconds

## Self-Check: PASSED

All created files exist:
- ✓ extension/src/background/service-worker.ts
- ✓ extension/src/content/index.ts
- ✓ extension/src/content/observers/mutation-observer.ts
- ✓ extension/src/content/extractors/chatgpt.ts
- ✓ extension/src/popup/popup.ts
- ✓ extension/src/popup/popup.html
- ✓ extension/src/popup/popup.css
- ✓ extension/src/options/options.ts
- ✓ extension/src/options/options.html
- ✓ extension/src/options/options.css

All commits verified:
- ✓ 067f2eb (service worker + extractors)
- ✓ af87e97 (popup + options)
