# Phase 2: Web Intelligence - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Browser extension that automatically captures and indexes AI chat conversations (ChatGPT, Gemini, Perplexity) in real-time, pushing content to the local WIMS server for search indexing. Read-only capture only — no write-back to platforms.

</domain>

<decisions>
## Implementation Decisions

### Capture Strategy
- Capture mechanism (DOM observation vs polling): Claude's discretion
- Global on/off toggle — single switch for all capture, no per-site toggles
- Checkpoint mechanism with message fingerprints/hashes for deduplication — web UIs don't always load full conversations on page load
- Capture on scroll — when user scrolls up and lazy-loaded history appears, capture those messages too
- Capture conversation titles from sidebar/header for search context and grouping
- Minimal popup UI: global on/off toggle, server connection status, last capture timestamp
- Conversation identifier strategy: Claude's discretion

### Content Extraction
- Code block handling: Claude's discretion on whether to separate code from prose
- Non-text content (images, files, artifacts): capture references only (e.g., "[Image: screenshot.png]"), not the content itself
- Messages indexed separately with role labels ("user" / "assistant") — enables searching by role
- Deep linking: best effort to link to specific message, fall back to conversation page if not possible

### Platform Handling
- Implementation order: ChatGPT first, then Gemini and Perplexity as follow-ups within this phase
- ChatGPT: standard chat interface only (/c/ URLs) — skip canvas, shared links, playground
- Pluggable extractor architecture — each platform is a separate module with a shared interface, making it easy to add new platforms later
- Scope limited to the three roadmap platforms (ChatGPT, Gemini, Perplexity) — additional platforms are future work

### Server Communication
- Queue and retry when WIMS server is unreachable — store locally (IndexedDB/chrome.storage), deliver when server comes back
- Server URL configured by user in extension settings (not auto-discovered)
- Batching strategy: Claude's discretion
- API changes needed for extension: Claude's discretion (evaluate existing Phase 1 API and extend if necessary)

### Claude's Discretion
- Capture mechanism implementation (MutationObserver vs polling vs hybrid)
- Conversation identifier strategy (platform URL IDs vs WIMS-generated)
- Code block extraction granularity
- Visual capture indicator (icon color, badge, or silent)
- Message batching/debouncing strategy
- Whether Phase 1 API needs extension-specific endpoints

</decisions>

<specifics>
## Specific Ideas

- Checkpoint with message fingerprints is important because web UIs don't always load full history on page load — can't rely on re-indexing full conversations
- Extension should work as a Chrome/Edge extension (Chromium-based)
- The popup is minimal by design — just a toggle and status, not a full management UI

</specifics>

<deferred>
## Deferred Ideas

- Additional platforms (Claude.ai, Grok, etc.) — future iteration using the pluggable extractor pattern
- Canvas/artifact content capture — beyond standard chat
- Shared conversation link capture

</deferred>

---

*Phase: 02-web-intelligence*
*Context gathered: 2026-02-05*
