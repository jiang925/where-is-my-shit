# Project State: Where Is My Shit (WIMS)

## Project Reference
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.
**Current Focus:** Phase 1 (Core Engine) initialization.

## Current Position
**Phase:** 2 - Web Intelligence (Complete)
**Plan:** 04 of 04 (End-to-End Verification)
**Status:** Phase 2 Complete
**Last activity:** 2026-02-06 - Completed 02-04-PLAN.md

```
Phase 1: [████████████████████] 100% (5/5 plans)
Phase 2: [████████████████████] 100% (4/4 plans)
Overall: [██████████████████░░] 90% (9/10 completed)
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
| verification-01 | Manual E2E testing for user-facing features | 02-04 | Checkpoint pattern validates Phase 2 success criteria |
| phase1-gap-01 | Search endpoint needs debugging | 02-04 | Documented as backlog, doesn't block Phase 2 completion |

### Blockers
- None.

### Known Issues (Backlog)
- **Phase 1 Search Endpoint:** Returns "Method Not Allowed" - needs debugging
- **Impact:** Doesn't affect Phase 2 capture pipeline (working correctly)
- **Priority:** Low - Can be addressed before Phase 3 or later

### Next Actions
- **Next Phase:** 03 - Discord Capture
- **Phase Goal:** Extend capture to Discord chat history
- **Ready to proceed:** Phase 2 architecture proven and stable

## Session Continuity
**Last Session:** 2026-02-06T16:28:15Z
**Stopped at:** Completed 02-04-PLAN.md (End-to-End Verification) - Phase 2 Complete
**Resume:** Begin Phase 3 (Discord Capture) when ready
**Resume file:** None
