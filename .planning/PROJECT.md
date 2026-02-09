# Where Is My Shit (WIMS)

## What This Is
A centralized indexing and retrieval system for AI interactions across fragmented platforms. It ingests conversations from web-based AI tools (ChatGPT, Claude, Gemini) and local development environments (Claude Code, Cursor), processes them into a searchable vector store, and provides a unified interface to find and deep-link back to original contexts.

## Core Value
Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **Central Server**: Self-hosted backend for ingestion, processing, and storage
- [ ] **Hybrid Processing**: Local storage of data + Cloud APIs (OpenAI/Anthropic) for embeddings/summarization
- [ ] **Web Ingestion**: Browser extension to auto-sync active chats from supported platforms
- [ ] **Dev Ingestion**: Local file watchers/scanners to ingest logs from Claude Code/Cursor
- [ ] **Search Interface**: Web UI (or MCP server) to query the index and return deep links

### Out of Scope

- **Chatting with the index**: This is for *finding* the old chat, not RAG-based Q&A (v1 focus is search/recall).
- **Full local LLMs**: Using Cloud APIs for the heavy lifting (embeddings/summary) to keep local footprint light, per user preference.
- **Bi-directional sync**: We index *from* platforms, we don't write *back* to them.

## Context

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
| **Hybrid Architecture** | Local DB for privacy/control, Cloud APIs for quality/speed of embeddings/summaries. | — Pending |
| **Extension for Web** | Official APIs for user chat history are often lacking or non-existent; DOM scraping/monitoring is required. | — Pending |
| **File Watchers for Dev** | Easiest low-friction way to capture logs from local tools without deep integration plugins. | — Pending |

---
*Last updated: 2026-02-05 after initialization*
