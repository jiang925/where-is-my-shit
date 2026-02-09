# Where Is My Shit (WIMS)

## What This Is
A centralized indexing and retrieval system for AI interactions across fragmented platforms. It ingests conversations from web-based AI tools (ChatGPT, Claude, Gemini) and local development environments (Claude Code, Cursor), processes them into a searchable vector store, and provides a unified interface to find and deep-link back to original contexts.

## Core Value
Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

## Requirements

### Validated

- [x] **WEB-01**: Browser extension captures ChatGPT conversations (content + metadata) — v1.0
- [x] **WEB-02**: Browser extension captures Gemini conversations — v1.0
- [x] **WEB-03**: Browser extension captures Perplexity conversations — v1.0
- [x] **WEB-04**: Extension detects new content and pushes to local server (real-time/near real-time) — v1.0
- [x] **DEV-01**: Local watcher indexes Claude Code logs from disk — v1.0
- [x] **DEV-02**: Local watcher indexes Antigravity logs — v1.0
- [x] **DEV-03**: Local watcher indexes Cursor chat logs — v1.0
- [x] **CORE-01**: User can search by semantic meaning (embeddings) — v1.0
- [x] **CORE-02**: Index stores conversation content, timestamp, source, and deep link URL — v1.0
- [x] **CORE-03**: Results return "Deep Links" to exact message/scroll position where possible — v1.0
- [x] **UI-01**: Standalone Web/App UI (React/Tauri) for searching — v1.0
- [x] **UI-02**: Results displayed with source icons and relevance snippets — v1.0
- [x] **DEP-01**: Central server packaged as a single "All-in-One" Docker image — v1.0
- [x] **DEP-02**: Vector DB (LanceDB) embedded/packaged within the same Docker container (no external service dependencies) — v1.0
- [x] **DEP-03**: Configuration via environment variables (API keys for embeddings, paths) — v1.0

### Active

(Use /gsd:new-milestone to define next requirements)

### Out of Scope

- **Chatting with the index**: This is for *finding* the old chat, not RAG-based Q&A (v1 focus is search/recall).
- **Full local LLMs**: Using Cloud APIs for the heavy lifting (embeddings/summary) to keep local footprint light, per user preference.
- **Bi-directional sync**: We index *from* platforms, we don't write *back* to them.

## Context

Shipped v1.0 (MVP) on 2026-02-07.
- **Status:** Functional end-to-end system.
- **Tech Stack:** Python (FastAPI/FastEmbed/LanceDB), TypeScript (React/Chrome Extension).
- **Scale:** ~3,500 LOC.
- **Privacy:** Fully local operation (no cloud embeddings used in v1).

User uses multiple AI products daily:
- Web: ChatGPT, Claude, Gemini, Perplexity
- Dev: Antigravity, Claude Code, Cursor
- Problem: Native search sucks, fragmentation makes finding "that one conversation" impossible.
- Privacy: Prefers local data storage but okay with Cloud LLMs for processing.

## Constraints

- **Type**: Privacy — Data stored locally (hybrid model).
- **Type**: Usability — Must provide deep links to original content, not just text recall.
- **Type**: Integration — Must handle "closed ecosystems" via browser extension (no official APIs for chat history often available).
- **Type**: Performance — Local watchers must be lightweight/low-load.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Hybrid Architecture** | Local DB for privacy/control, Cloud APIs for quality/speed of embeddings/summaries. | ✓ Implemented (Local-only for v1) |
| **Extension for Web** | Official APIs for user chat history are often lacking or non-existent; DOM scraping/monitoring is required. | ✓ Implemented |
| **File Watchers for Dev** | Easiest low-friction way to capture logs from local tools without deep integration plugins. | ✓ Implemented |

---
*Last updated: 2026-02-07 after v1.0 milestone*
