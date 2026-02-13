# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.
**Current Focus:** v1.4 Search & Browse UX Polish - Phase 17 (Search Relevance Improvements)

## Current Position

**Phase:** 17 of 18 (Search Relevance Improvements)
**Plan:** 01 of 5
**Status:** Plan 01 complete (configurable embedding provider abstraction)
**Last activity:** 2026-02-13 — Completed 17-01-PLAN.md (embedding provider abstraction with fastembed/ollama/openai support)

Progress: [████████████████░░░░] 88.9% (16/18 phases complete)

## Performance Metrics

**By Milestone:**

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 MVP | 4 | Complete (2026-02-07) |
| v1.1 Security & Hardening | 3 | Complete (2026-02-07) |
| v1.2 Simplify & Deploy | 4 | Complete (2026-02-11) |
| v1.3 UI/API Integration | 3 | Complete (2026-02-12) |
| v1.4 Search & Browse UX | 4 | In progress |

**v1.4 Progress:**
- Phase 15: Source Filtering (4/4 plans complete) - Backend multi-platform filtering, React Router URL state, Source filtering UI, gap closure complete - ALL SUCCESS CRITERIA MET
- Phase 16: Claude Code Path Display (1/1 plans complete) - File path display with copy-to-clipboard for Claude Code conversations - PHASE COMPLETE
- Phase 17: Search Relevance Improvements (1/5 plans complete) - Configurable embedding provider abstraction complete
- Phase 18: Browse Page with Timeline (0/TBD plans) - Not started
| Phase 17 P01 | 311 | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v1.4:

- **React Router for URL State**: Chosen for shareable filter URLs - industry standard, well-maintained, lightweight (v1.4)
- **Platforms Sorted in Query Key**: Sort platforms to ensure consistent cache keys regardless of array order (v1.4)
- **Conditional Platform Spreading**: Only include platforms in API request when non-empty array (v1.4)
- **SourceFilterUI Props-Based State**: Controlled components for predictable behavior and debugging (v1.4)
- **Platform Color Centralization**: AVAILABLE_PLATFORMS constant for consistent styling across filters and results (v1.4)
- **Search vs Browse Page Separation**: Search is query-driven, Browse is filter-driven for clear UX purpose (v1.4)
- **Empty Query Handling**: Browse page requires platform selection before showing results (no auto "show all") (v1.4)
- **Frontend-Backend Platform Alignment**: Frontend AVAILABLE_PLATFORMS must match backend ALLOWED_PLATFORMS exactly for filtering to work (v1.4)
- **Direct Platform Lookup**: Use direct ID lookup instead of substring matching for reliability and correctness (v1.4)
- **Fixed Preset Filters**: Three fixed presets only (Web Chats, Dev Sessions, All Sources) - no custom presets in v1.4 (v1.4)
- **Orange Theme for Copy Path Button**: Match claude-code platform badge colors for visual consistency (v1.4 - Phase 16)
- **Middle-Ellipsis Truncation 60/40 Split**: More weight to filename (end) than directory structure (start) for better path readability (v1.4 - Phase 16)
- **File Path Detection Logic**: Windows (C:\...), Unix (/...), and anything without :// treated as path (v1.4 - Phase 16)
- **Probe Dimensions on Init**: Both fastembed and ollama providers probe dimensions by embedding test string - flexible for any model (v1.4 - Phase 17)
- **e5 Model Prefix Support**: FastEmbedProvider auto-prefixes queries ("query: ") and documents ("passage: ") for e5 models (v1.4 - Phase 17)
- **Ollama Provider for OpenAI-Compatible Endpoints**: Single provider class supports local Ollama, remote GPU servers, and OpenAI API (v1.4 - Phase 17)
- **Default Config Backward Compatibility**: ServerConfig.embedding defaults to fastembed + bge-small-en-v1.5 (v1.4 - Phase 17)
- **Hybrid Architecture**: Local DB for privacy/control, Cloud APIs for quality/speed (v1.0)
- **API Key Auth**: Simpler for local tools, persistent, no refresh token complexity (v1.2)
- **uv Package Manager**: Faster, robust venv handling, prevents system breakage (v1.2)

### Key Learnings from v1.3 & v1.4

- **Stateless Auth:** Removing session management significantly simplified the codebase
- **Schema Alignment Critical:** Backend and frontend must agree on response structure - nested meta object pattern provides better extensibility
- **APIRequestContext vs Page Routing:** Playwright's APIRequestContext is separate from Page - page.route interceptors don't affect API requests
- **Single Worker Mode:** Set workers: 1 to prevent LanceDB file locking conflicts
- **E2E Test Synchronization:** Waiting for search responses requires careful timing - only wait when query changes, not just filter changes
- **Navigation State Tests:** Shareable link tests must account for empty query scenarios (no search execution)
- **Platform Name Alignment Critical:** Frontend platform IDs must match backend ALLOWED_PLATFORMS exactly - no aliases or close matches accepted
- **E2E Tests Must Verify Backend Behavior:** Testing UI state alone is insufficient - must verify backend actually filters results by inspecting response data
- **useSearch Hook Bug Pattern:** Accepting a parameter in a custom hook doesn't guarantee it's used - always verify parameters are forwarded to underlying functions
- **E2E Locator Strict Mode:** Always use `.first()` when multiple results may exist in search results to avoid strict mode violations (v1.4 - Phase 16)

### Pending Todos

None yet (new milestone).

### Blockers / Concerns

None yet (new milestone).

## Session Continuity

**Last session end:** 2026-02-13
**Stopped at:** Phase 17 Plan 01 complete - Configurable embedding provider abstraction implemented - Ready for Phase 17 Plans 02-05 (multi-field search, hybrid search, query enhancement, ranking)
**Resume file:** .planning/phases/17-search-relevance/17-01-SUMMARY.md
