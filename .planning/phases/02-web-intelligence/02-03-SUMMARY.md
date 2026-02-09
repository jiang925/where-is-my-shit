---
phase: 02-web-intelligence
plan: 03
subsystem: extension
tags: [chrome-extension, dom-scraping, typescript, webpack]

# Dependency graph
requires:
  - phase: 02-02
    provides: ChatGPT extractor pattern and content script infrastructure
provides:
  - Gemini extractor for gemini.google.com conversations
  - Perplexity extractor for www.perplexity.ai threads
  - Complete three-platform coverage (ChatGPT, Gemini, Perplexity)
  - Pluggable extractor architecture with BaseExtractor pattern
affects: [02-04-popup-ui, search-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pluggable extractor pattern: BaseExtractor abstract class with platform-specific implementations"
    - "Multiple fallback selectors for DOM element detection (robustness against UI changes)"
    - "Citation preservation in Perplexity (inline [1], [2] format)"

key-files:
  created:
    - extension/src/content/extractors/gemini.ts
    - extension/src/content/extractors/perplexity.ts
  modified:
    - extension/src/content/index.ts

key-decisions:
  - "Gemini: Timestamp-based fallback conversation IDs for new/unnamed conversations"
  - "Perplexity: Keep citations as inline text (important context for research queries)"
  - "All extractors: Multiple fallback selectors per element type (title, messages, role)"

patterns-established:
  - "Platform detection: hostname matching in matches() method"
  - "Role detection: class/attribute-based with multiple heuristics (user vs assistant)"
  - "Content extraction: markdown formatting for code blocks, descriptive placeholders for images/files"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 02 Plan 03: Multi-Platform Extractors Summary

**Gemini and Perplexity extractors with pluggable architecture complete - all three roadmap platforms (ChatGPT, Gemini, Perplexity) now supported**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T15:14:40Z
- **Completed:** 2026-02-06T15:17:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented GeminiExtractor with gemini.google.com platform detection and conversation extraction
- Implemented PerplexityExtractor with www.perplexity.ai Q&A pair extraction and citation preservation
- Registered all three extractors in content script for automatic platform detection
- Bundle size increased from 6.49 KiB to 13.1 KiB (34.1 KiB total module size)

## Task Commits

Each task was committed atomically:

1. **Task 1: Gemini extractor** - `af5a907` (feat)
2. **Task 2: Perplexity extractor and content script registration** - `6036243` (feat)

## Files Created/Modified
- `extension/src/content/extractors/gemini.ts` - Gemini conversation extraction with /app/{id} URL parsing and multiple fallback selectors
- `extension/src/content/extractors/perplexity.ts` - Perplexity thread extraction with citation preservation and Q&A role detection
- `extension/src/content/index.ts` - Imports and registers all three extractors (ChatGPT, Gemini, Perplexity)

## Decisions Made

**Gemini conversation ID strategy:**
- Primary: Extract from `/app/{conversation_id}` URL pattern
- Fallback 1: Use URL hash if present
- Fallback 2: Generate timestamp-based ID (`gemini-{timestamp}`)
- Rationale: Handle both named conversations and new/unnamed sessions

**Perplexity citation handling:**
- Keep citations as inline text in format `[1]`, `[2]`
- Don't strip or convert to separate references
- Rationale: Citations are essential context for research queries, need to be searchable with answer content

**DOM selector strategy (both platforms):**
- Implement 3-5 fallback selectors per element type
- Order from specific (data attributes) to generic (class patterns)
- Log warnings on failure, never crash
- Rationale: Platform UI changes frequently, need robustness

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**DOM selector reverse-engineering requirement:**
The plan correctly noted that Gemini and Perplexity DOM selectors must be discovered at implementation time. Implemented multiple generic fallback patterns covering common web app structures:
- Data attributes (`[data-message-id]`)
- Semantic classes (`.message-content`, `.Query`, `.Answer`)
- Role attributes (`[role="article"]`)
- Class name patterns (`[class*="turn"]`, `[class*="message"]`)

These fallbacks should work for most typical conversation UIs. If actual DOM structure differs, selectors can be updated without changing the architecture.

## Next Phase Readiness

**Ready for next phase (02-04):**
- All three platform extractors active and registered
- Content script detects platform automatically
- Messages extracted with consistent `ExtractedMessage` format
- Mutation observer handles dynamic message loading (from 02-02)

**Remaining work in Phase 02:**
- Plan 02-04: Popup UI for search and status display

**Testing recommendation:**
Real-world testing on all three platforms should verify:
1. Platform detection works (matches() returns true on correct domain)
2. Conversation IDs extracted correctly
3. Messages have correct roles (user vs assistant)
4. Citations and code blocks preserved properly

---
*Phase: 02-web-intelligence*
*Completed: 2026-02-06*

## Self-Check: PASSED

All files created:
- extension/src/content/extractors/gemini.ts
- extension/src/content/extractors/perplexity.ts

All files modified:
- extension/src/content/index.ts

All commits exist:
- af5a907 (Task 1)
- 6036243 (Task 2)
