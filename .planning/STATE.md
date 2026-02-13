# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.
**Current Focus:** v1.4 Search & Browse UX Polish - Phase 15 (Source Filtering)

## Current Position

**Phase:** 15 of 18 (Source Filtering)
**Plan:** 03 of 3
**Status:** Phase complete - All 3 plans complete
**Last activity:** 2026-02-13 — Completed plan 15-03, Source Filter UX Implementation

Progress: [████████████░░░░░░░░] 79.0% (15/18 phases with 3 plans complete)

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
- Phase 15: Source Filtering (3/3 plans complete) - Backend multi-platform filtering, React Router URL state, Source filtering UI complete
- Phase 16: Claude Code Path Display (0/TBD plans) - Not started
- Phase 17: Search Relevance Improvements (0/TBD plans) - Not started
- Phase 18: Browse Page with Timeline (0/TBD plans) - Not started

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

### Pending Todos

None yet (new milestone).

### Blockers / Concerns

None yet (new milestone).

## Session Continuity

**Last session end:** 2026-02-13
**Stopped at:** Completed plan 15-03 (Source Filter UX Implementation), 5 commits, build passing, E2E tests passing
**Resume file:** .planning/phases/15-source-filtering/15-03-SUMMARY.md
