# Where Is My Shit (WIMS)

## What This Is
A centralized indexing and retrieval system for AI interactions across fragmented platforms. It ingests conversations from web-based AI tools (ChatGPT, Claude, Gemini) and local development environments (Claude Code, Cursor), processes them into a searchable vector store, and provides a unified interface to find and deep-link back to original contexts.

## Core Value
Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

## Current Milestone: v1.4 Search & Browse UX Polish

**Goal:** Transform WIMS from "it works" to "it's actually useful" by improving search quality and adding flexible browsing capabilities.

**Target features:**
- **Source Filtering:** Filter results by data source (Claude Code, ChatGPT, Gemini, etc.)
- **Claude Code Path Fix:** Replace broken "Open" link with rendered path + copy button
- **Search Relevance:** Research and implement better semantic search (embeddings/ranking/hybrid)
- **Browse Page:** Chronological browsing with flexible filters and date ranges

**Context:** Search works end-to-end but has usability issues: irrelevant results (0.7 score for unrelated content), noisy fragments, broken Claude Code links, no browsing capabilities.

## Recent Milestone: v1.3 UI/API Integration & Verification (Shipped)

**Goal:** Make the search system actually work end-to-end with automated verification.

**Shipped Features:**
- **UI/API Connectivity:** Fixed CORS and schema alignment blocking issues
- **Complete Flow:** Verified ingest → search → display pipeline works end-to-end
- **Integration Tests:** Added Playwright tests for core search workflows

## Recent Milestone: v1.2 Simplify & Deploy (Shipped)

**Goal:** Remove friction from setup and daily use by simplifying authentication (API Keys) and modernizing deployment.

**Shipped Features:**
- **Persistent API Key Auth:** Replaced complex JWT flow with simple, persistent keys (`X-API-Key`).
- **Unified Configuration:** Centralized server/watcher config in `~/.wims/server.json` with hot-reloading.
- **Frictionless Setup:** One-command install/start using `uv` (`setup.sh`, `start.sh`).
- **Client Updates:** Stateless Extension and Watchers supporting the new auth flow.

## Recent Milestone: v1.1 Security & Hardening (Shipped)

**Goal:** Harden the system for public/shared use and establish robust engineering practices (CI/CD, TDD).

### Validated
- [x] **SEC-01**: API requires authentication (Basic/Token) for ingestion and search.
- [x] **SEC-05**: API binds explicitly to `127.0.0.1` by default.
- [x] **CI-01**: GitHub Actions workflow runs tests and linting on push.
- [x] **TEST-01**: Unit test suite covers Core Engine services (Embedding, DB).

## Context

Shipped v1.2 on 2026-02-11.
- **Status:** Simplified, secure, "one-command" deployable system.
- **Tech Stack:** Python (FastAPI/FastEmbed/LanceDB), TypeScript (React/Chrome Extension), uv (dependency management).
- **Privacy:** Fully local operation (no cloud embeddings used in v1).

## Constraints

- **Type**: Privacy — Data stored locally (hybrid model).
- **Type**: Usability — Must provide deep links to original content, not just text recall.
- **Type**: Integration — Must handle "closed ecosystems" via browser extension.
- **Type**: Performance — Local watchers must be lightweight/low-load.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Hybrid Architecture** | Local DB for privacy/control, Cloud APIs for quality/speed. | ✓ Implemented (Local-only for v1) |
| **Extension for Web** | DOM scraping/monitoring required for closed APIs. | ✓ Implemented |
| **File Watchers for Dev** | Low-friction log capture. | ✓ Implemented |
| **Local Binding** | `127.0.0.1` restriction prevents LAN exposure by default. | ✓ Implemented (v1.1) |
| **API Key Auth** | Simpler for local tools, persistent, no refresh token complexity. | ✓ Implemented (v1.2) |
| **uv Package Manager** | Faster, robust venv handling, prevents system breakage. | ✓ Implemented (v1.2) |

---
*Last updated: 2026-02-12 (Start of v1.4)*
