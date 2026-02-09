# Project State: Where Is My Shit (WIMS)

## Project Reference
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Phase 1 (Core Engine) initialization.

## Current Position
**Phase:** 2 - Web Intelligence (In Progress)
**Plan:** 01 of 04 (Extension Foundation)
**Status:** Plan 02-01 Complete
**Last activity:** 2026-02-06 - Completed 02-01-PLAN.md

```
Phase 1: [████████████████████] 100% (5/5 plans)
Phase 2: [█████░░░░░░░░░░░░░░░] 25% (1/4 plans)
Overall: [████████████░░░░░░░░] 60% (6/10 completed)
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

### Blockers
- None.

### Next Actions
- **Next Plan:** 02-02 - Service Worker + ChatGPT Extractor + Popup UI
- **Phase Goal:** Complete Web Intelligence capture (4 plans total)

## Session Continuity
**Last Session:** 2026-02-06
**Stopped at:** Completed 02-01-PLAN.md (Extension Foundation)
**Resume:** Execute 02-02-PLAN.md (Service Worker + ChatGPT Extractor)
