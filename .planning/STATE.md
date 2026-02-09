# Project State: Where Is My Shit (WIMS)

## Project Reference
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Phase 1 (Core Engine) initialization.

## Current Position
**Phase:** 2 - Web Intelligence (In Progress)
**Plan:** 03 of 04 (Multi-Platform Extractors)
**Status:** Plan 02-03 Complete
**Last activity:** 2026-02-06 - Completed 02-03-PLAN.md

```
Phase 1: [████████████████████] 100% (5/5 plans)
Phase 2: [███████████████░░░░░] 75% (3/4 plans)
Overall: [████████████████░░░░] 80% (8/10 completed)
```

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

### Blockers
- None.

### Next Actions
- **Next Plan:** 02-04 - Popup UI
- **Phase Goal:** Complete Web Intelligence phase (1 plan remaining)

## Session Continuity
**Last Session:** 2026-02-06T15:17:24Z
**Stopped at:** Completed 02-03-PLAN.md (Multi-Platform Extractors)
**Resume:** Execute 02-04-PLAN.md (Popup UI)
**Resume file:** None
