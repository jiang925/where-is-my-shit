# Research Summary: Where Is My Shit (WIMS)

> **Synthesized:** 2026-02-05
> **Status:** READY FOR REQUIREMENTS

## Executive Summary

Where Is My Shit (WIMS) is a **local-first personal search engine** designed to index a user's digital footprint (web history, bookmarks, etc.) without sending data to the cloud. Research indicates the optimal approach is a **"Sidecar" architecture**: a robust Python-based local server handles storage and vector embedding, while a lightweight Chrome Extension acts as the capture sensor and search interface.

The technical core relies on **FastAPI** and **LanceDB** to provide enterprise-grade vector search capabilities on the user's local machine, keeping the footprint small compared to Electron-based alternatives. This separation of concerns allows for high performance (offloading heavy compute to the server) while maintaining a native browser feel.

Key risks identified include **"DOM Drift"** (where site updates break scrapers) and **Chrome Web Store policy restrictions**. The roadmap mitigates these by prioritizing a resilient ingest pipeline and a strict "local-only" permission model from Day 1.

## Key Findings

### Technology Stack
*   **Core Server**: Python 3.12+ (best AI ecosystem) + FastAPI.
*   **Storage**: **LanceDB** for vector storage (serverless, fast, local files) + **SQLite** for metadata/FTS.
*   **Frontend**: React + Vite + Tailwind (bundled as Chrome Extension).
*   **Avoided**: Electron (bloat), Chroma (resource heavy), Full Web Crawling (bandwidth killer).

### Feature Priorities
*   **Table Stakes (MVP)**: Full-text + Semantic Search, "Save Page" button, Dark Mode.
*   **Differentiators**: "Time Travel" context (temporal search), strict Local-Only Privacy.
*   **Deferred**: Cloud Sync, Social Sharing, "Chat with Data" (focus on retrieval first).

### Architecture Decisions
*   **Pattern**: **Sidecar**. Extension is transient; Server is persistent.
*   **Data Flow**: Extension scrapes -> HTTP POST -> Server Queue -> Embedding Model -> LanceDB.
*   **Scale Strategy**: Use hybrid search (SQLite FTS + Vector) to handle >100k docs efficiently.

### Critical Pitfalls
*   **DOM Drift**: Scrapers relying on CSS classes break weekly. *Fix: Use semantic/ARIA selectors.*
*   **Permission Creep**: Requesting `<all_urls>` triggers review hell. *Fix: Optional, on-demand permissions.*
*   **Index Bloat**: Unchecked vector growth eats disk space. *Fix: Quantization and TTL policies.*

## Roadmap Implications

Research suggests a 3-phase execution order to minimize dependencies and risk.

### Phase 1: The Brain (Local Server Core)
**Rationale**: The extension is useless without a backend to accept data.
*   **Delivers**: FastAPI server, LanceDB setup, Embedding pipeline, Ingest API.
*   **Key Pitfall**: Avoid in-memory vector stores; use LanceDB from start to handle persistence.

### Phase 2: The Sensor (Browser Extension)
**Rationale**: Requires stable API from Phase 1.
*   **Delivers**: Context capture, Search Popup UI, Authentication/Handshake.
*   **Research Flag**: Validate manifest permissions early to avoid store rejection later.

### Phase 3: Resilience & Optimization
**Rationale**: Once functional, the system needs protection against "real world" messy data.
*   **Delivers**: Hybrid Search (adding FTS), Quantization (size reduction), "Time Travel" UI.
*   **Key Pitfall**: "DOM Drift" - Implement resilient selector logic here.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | Python/LanceDB combination is well-tested for this specific use case. |
| **Features** | **HIGH** | MVP scope is tight and realistic; anti-features are clearly defined. |
| **Architecture** | **HIGH** | "Sidecar" pattern solves the performance limitations of pure browser extensions. |
| **Pitfalls** | **HIGH** | Research identifies specific, actionable risks like Store Policy and specific scraping failures. |

**Gaps:** None. The path to MVP is clear.

## Sources
*   *STACK.md* (LanceDB, FastAPI docs)
*   *FEATURES.md* (Local-first principles)
*   *ARCHITECTURE.md* (Chrome Extension patterns)
*   *PITFALLS.md* (Chrome Web Store Policies)
