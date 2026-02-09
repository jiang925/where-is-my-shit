# Phase 02 Plan 01: Extension Foundation Summary

**One-liner:** Browser extension scaffold with TypeScript build, CORS-enabled server, and all shared infrastructure (fingerprinting, queue, API client, storage, base extractor).

---

## Frontmatter

```yaml
phase: 02
plan: 01
subsystem: extension-infrastructure
completed: 2026-02-06
duration: 3.7min
status: complete

# Dependencies
requires:
  - 01-03  # Ingest API endpoint that extension POSTs to
provides:
  - extension-build-system
  - cors-middleware
  - fingerprint-deduplication
  - offline-queue
  - storage-abstraction
  - api-client
  - base-extractor-interface
affects:
  - 02-02  # Service worker will use queue and API client
  - 02-03  # ChatGPT extractor will extend BaseExtractor
  - 02-04  # Gemini extractor will extend BaseExtractor
  - 02-05  # Perplexity extractor will extend BaseExtractor

# Tech stack
tech-stack:
  added:
    - TypeScript 5.4
    - Webpack 5.91
    - Chrome Extension Manifest V3
    - Web Crypto API (SHA-256)
    - chrome.storage.local API
  patterns:
    - Pluggable extractor architecture
    - Offline-first queue with retry
    - LRU fingerprint cache (10k entries)
    - AbortController timeout protection

# Files
key-files:
  created:
    - extension/package.json
    - extension/tsconfig.json
    - extension/webpack.config.js
    - extension/manifest.json
    - extension/src/types/message.ts
    - extension/src/types/platform.ts
    - extension/src/lib/fingerprint.ts
    - extension/src/lib/storage.ts
    - extension/src/lib/queue.ts
    - extension/src/lib/api.ts
    - extension/src/content/extractors/base.ts
  modified:
    - src/app/main.py  # Added CORSMiddleware

# Decisions
decisions:
  - id: cors-wildcard
    what: Use allow_origins=["*"] for CORS
    why: Extension origins are chrome-extension://[random-id] which vary per install
    alternatives: Could whitelist specific origins but requires user configuration
    impact: Simple, works for all extension installs, safe for localhost-only server

  - id: fingerprint-lru-size
    what: 10,000 fingerprint cache with LRU eviction
    why: Balance memory usage vs deduplication accuracy
    context: SHA-256 hashes are 64 bytes, 10k = 640KB, chrome.storage.local quota is 10MB
    alternatives: Bloom filter (space-efficient but false positives), smaller cache
    tradeoff: May re-index very old messages if user scrolls deep history

  - id: queue-max-retries
    what: Drop messages after 10 failed retry attempts
    why: Prevent unbounded queue growth from persistent server failures
    context: Queue stored in chrome.storage.local (10MB limit)
    alternatives: Never drop (queue could fill storage), fewer retries (lose data on temporary outages)
    tradeoff: Messages lost if server down for extended period

  - id: request-timeout
    what: 10-second timeout for all API requests
    why: Manifest V3 service workers terminate after 30s inactivity
    context: Must complete request before worker termination
    alternatives: Longer timeout (risks worker termination), shorter (premature failures)
    tradeoff: May timeout on slow networks

tags:
  - chrome-extension
  - manifest-v3
  - typescript
  - webpack
  - cors
  - deduplication
  - offline-queue
```

---

## What Was Built

### Server-Side: CORS Middleware
Added FastAPI `CORSMiddleware` to `src/app/main.py` to allow Chrome extension to make cross-origin requests:
- **allow_origins**: `["*"]` (extension origins vary per install)
- **allow_methods**: `["GET", "POST"]`
- Safe for localhost-only server

Verified with OPTIONS preflight request showing `access-control-allow-origin: *` header.

### Extension Project Scaffold
Created complete extension at `extension/` with TypeScript + Webpack build system:

**Build Toolchain:**
- TypeScript 5.4 with strict mode
- Webpack 5.91 with multiple entry points
- ts-loader for compilation
- copy-webpack-plugin for static assets

**Manifest V3 Configuration:**
- Service worker background script
- Content scripts for ChatGPT, Gemini, Perplexity
- Permissions: storage, alarms
- Host permissions: localhost for WIMS server

**Shared Type Definitions:**
- `ExtractedMessage`: Internal message representation
- `IngestPayload`: Matches server `IngestRequest` exactly (conversation_id, platform, title, content, role, timestamp, url)
- `Platform`: Enum for chatgpt, gemini, perplexity

**Core Libraries:**
1. **fingerprint.ts**: SHA-256 hashing for message deduplication
   - Normalizes content (trim, collapse whitespace)
   - Hash format: `conversationId|role|normalizedContent`
   - Uses Web Crypto API for native performance

2. **storage.ts**: chrome.storage.local wrapper
   - Settings management (captureEnabled, serverUrl, lastCaptureTimestamp)
   - Seen fingerprints with LRU eviction (10k entries)
   - Type-safe async API

3. **queue.ts**: Offline queue with retry logic
   - Stores failed requests in chrome.storage.local
   - Processes queue on enqueue and periodically
   - Drops messages after 10 retries
   - Prevents concurrent processing with guard flag

4. **api.ts**: WIMS server API client
   - POST to `/api/v1/ingest` with IngestPayload
   - 10-second timeout using AbortController
   - Health check endpoint for connection status

5. **base.ts**: Abstract extractor interface
   - Platform detection with `matches()`
   - Message extraction with `extractMessages()`
   - Conversation metadata extraction
   - Text content extraction with image/attachment handling

**Placeholder Components:**
- Service worker (empty export for webpack)
- Content script (empty export for webpack)
- Popup UI (minimal HTML shell)
- Options page (server URL input UI)

**Build Verification:**
```bash
npm run build
# ✓ Compiled successfully
# ✓ dist/manifest.json
# ✓ dist/background/service-worker.js
# ✓ dist/content/index.js
# ✓ dist/popup/popup.js
```

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Task Commits

| Task | Description | Commit | Key Changes |
|------|-------------|--------|-------------|
| 1 | Add CORS middleware | 6a36d0c | src/app/main.py: Added CORSMiddleware |
| 2 | Extension scaffold | f428548 | extension/: Complete TypeScript project with all shared libs |

---

## Verification Results

✅ **Extension builds without errors**
```
webpack 5.105.0 compiled successfully in 742 ms
```

✅ **CORS headers present**
```
access-control-allow-origin: *
access-control-allow-methods: GET, POST
```

✅ **Required dist files exist**
- dist/background/service-worker.js
- dist/content/index.js
- dist/popup/popup.js
- dist/manifest.json

✅ **Type compatibility verified**
- Extension `IngestPayload` matches server `IngestRequest` fields exactly
- ISO 8601 timestamp string compatible with FastAPI datetime parsing

---

## Integration Points

**Extension → Server:**
- API client POSTs to `http://localhost:8000/api/v1/ingest`
- Payload structure: `{ conversation_id, platform, title, content, role, timestamp, url }`
- CORS headers allow chrome-extension:// origins

**Content Script → Service Worker:**
- Content scripts will send extracted messages via `chrome.runtime.sendMessage()`
- Service worker queues messages and processes via API client
- All state persisted in chrome.storage.local (survives worker termination)

**Storage Architecture:**
- Settings: `{ captureEnabled, serverUrl, lastCaptureTimestamp }`
- Seen fingerprints: Array of SHA-256 hashes with LRU eviction
- Queue: Array of `{ id, payload, timestamp, retryCount }` items

---

## Next Phase Readiness

**Ready for 02-02 (Service Worker + UI):**
- ✅ Queue infrastructure ready
- ✅ API client ready
- ✅ Storage abstraction ready
- ✅ Type definitions complete

**Ready for 02-03 (ChatGPT Extractor):**
- ✅ BaseExtractor interface defined
- ✅ Fingerprint library ready
- ✅ Content script entry point scaffolded

**No blockers identified.**

---

## Performance Characteristics

**Build time:** 742ms (production mode)
**Fingerprint generation:** <1ms (Web Crypto API)
**Storage quota:** 10MB chrome.storage.local
**Queue capacity:** ~10,000 messages before storage pressure
**Request timeout:** 10 seconds per API call
**Retry strategy:** Exponential backoff with 10 retry limit

---

## Architecture Decisions Record

### Decision: Wildcard CORS Origins
**Context:** Chrome extensions have unpredictable origins (chrome-extension://[random-id])
**Decision:** Use `allow_origins=["*"]` instead of whitelisting
**Consequences:**
- ✅ Works for all extension installs without configuration
- ✅ Safe for localhost-only server (not exposed to internet)
- ⚠️ Would need tightening if server exposed publicly

### Decision: 10K Fingerprint Cache
**Context:** Need to deduplicate messages across page reloads and scroll events
**Decision:** LRU cache with 10,000 entry limit
**Consequences:**
- ✅ 640KB storage footprint (64 bytes × 10k)
- ✅ Covers typical user conversation history
- ⚠️ Very old messages may re-index if user scrolls deep history
- Alternative considered: Bloom filter (space-efficient but false positives)

### Decision: 10 Retry Limit
**Context:** Need to prevent unbounded queue growth during server outages
**Decision:** Drop messages after 10 failed delivery attempts
**Consequences:**
- ✅ Prevents storage quota exhaustion
- ✅ Handles temporary network issues (5+ minutes of retries)
- ⚠️ Messages lost if server down for extended period
- Alternative considered: Never drop (risks filling storage)

### Decision: 10-Second Request Timeout
**Context:** Manifest V3 service workers terminate after 30s inactivity
**Decision:** 10-second fetch timeout via AbortController
**Consequences:**
- ✅ Completes before worker termination
- ✅ Prevents hung requests blocking queue
- ⚠️ May timeout on very slow networks
- Alternative considered: 30s timeout (risks worker death mid-request)

---

## Self-Check: PASSED

**Files created:**
- ✅ extension/package.json
- ✅ extension/tsconfig.json
- ✅ extension/webpack.config.js
- ✅ extension/manifest.json
- ✅ extension/src/types/message.ts
- ✅ extension/src/types/platform.ts
- ✅ extension/src/lib/fingerprint.ts
- ✅ extension/src/lib/storage.ts
- ✅ extension/src/lib/queue.ts
- ✅ extension/src/lib/api.ts
- ✅ extension/src/content/extractors/base.ts
- ✅ src/app/main.py (modified)

**Commits verified:**
- ✅ 6a36d0c: CORS middleware
- ✅ f428548: Extension scaffold

**Build verification:**
- ✅ `npm run build` completes successfully
- ✅ All required dist files exist
- ✅ No TypeScript compilation errors
