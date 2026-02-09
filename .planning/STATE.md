# Project State: Where Is My Shit (WIMS)

## Project Reference
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Milestone v1.1 (Security & Hardening)

## Current Position
**Phase:** Not started (defining requirements)
**Plan:** —
**Status:** Defining requirements
**Last activity:** 2026-02-07 — Milestone v1.1 started

## Context & Memory

### Decisions

| ID | Decision | Plan | Rationale |
|----|----------|------|-----------|
| arch-01 | Hybrid Sidecar (Python/FastAPI server + Chrome Extension) | 01-01 | Separation of concerns: server for embeddings, extension for capture |
| storage-01 | LanceDB (embedded) for zero-dependency deployment | 01-02 | No external database required |
| scope-01 | Read-only ingestion (no write-back to platforms) | 01-01 | Simpler architecture, avoid platform API restrictions |
| embedding-01 | `BAAI/bge-small-en-v1.5` (384d) for local CPU performance | 01-02 | Good quality/speed tradeoff for CPU-only systems |
| db-index-01 | LanceDB with FTS and Vector indices (FLAT initially) | 01-03 | Hybrid search for best recall |
| api-pattern-01 | Async embedding generation using threadpools | 01-03 | Prevent blocking main event loop |
| search-01 | Results grouped by `conversation_id` | 01-04 | Show conversation context not just individual messages |
| cors-01 | Wildcard CORS origins for extension support | 02-01 | Extension origins vary per install, safe for localhost |
| dedup-01 | SHA-256 fingerprint with 10k LRU cache | 02-01 | Balance memory vs accuracy for scroll deduplication |
| queue-01 | Offline queue with 10 retry limit | 02-01 | Handle server outages without unbounded growth |
| timeout-01 | 10-second API request timeout | 02-01 | Complete before service worker termination (30s limit) |
| extractor-01 | Multiple fallback DOM selectors (3-5 per element type) | 02-03 | Platform UIs change frequently, need robustness |
| extractor-02 | Timestamp-based fallback conversation IDs | 02-03 | Handle unnamed/new conversations without URL-based ID |
| extractor-03 | Preserve Perplexity citations as inline text | 02-03 | Citations are searchable context for research queries |
| verification-01 | Manual E2E testing for user-facing features | 02-04 | Checkpoint pattern validates Phase 2 success criteria |
| phase1-gap-01 | Search endpoint needs debugging | 02-04 | Documented as backlog, doesn't block Phase 2 completion |
| watcher-01 | Cursor-based file tailing with inode tracking | 03-01 | Handle log rotation and service restarts reliably |
| watcher-02 | At-least-once delivery (no cursor advance on fail) | 03-01 | Prevent data loss when Core Engine is offline |
| systemd-01 | User-level service for watcher | 03-02 | Runs without root, starts on login, easier to manage permissions |
| env-01 | Use system python with user site-packages | 03-02 | Avoids complex venv management in simple service deployment |
| arch-02 | Source-agnostic watcher architecture using Abstract Base Class | 03-03 | Enables easy addition of future sources (Cursor, Antigravity) without modifying core logic. |
| meta-01 | Extract `project` and `pastedContents` to `metadata` field | 03-03 | Keeps the core schema clean while preserving rich context for indexing. |
| robust-01 | Exponential backoff for ingestion retries | 03-04 | Prevent network storms during outages while ensuring data eventual consistency. |
| cursor-01 | SQLite polling for chat history | 03-05 | File system events unreliable for SQLite WAL; polling ItemTable ensures data capture. |
| ui-01 | Tailwind v4 with PostCSS | 04-01 | Use latest styling stack for frontend |
| ui-02 | React SPA served by FastAPI | 04-01 | Single deployment artifact, simple architecture |
| ui-03 | TanStack Query for async state | 04-02 | Robust server state management and caching |
| ui-04 | IntersectionObserver for infinite scroll | 04-02 | Smoother UX than manual load more buttons |

### Blockers
- None.

### Known Issues (Backlog)
- **Phase 1 Search Endpoint:** Returns "Method Not Allowed" for GET requests (fixed to POST in tests, need to verify spec)
- **Impact:** Minor API inconsistency, verified working with POST.

### Next Actions
- **Next Phase:** None - Milestone v1.0 Complete.
- **Goal:** Audit and Archive.

## Session Continuity
**Last Session:** 2026-02-07T13:48:00Z
**Stopped at:** Completed 04-02-PLAN.md (Search Interface Implementation)
**Resume:** Next plan in Phase 4
**Resume file:** None
