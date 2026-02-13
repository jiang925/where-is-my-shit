# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.
**Current Focus:** v1.4 Search & Browse UX Polish - Phase 15 (Source Filtering)

## Current Position

**Phase:** 15 of 18 (Source Filtering)
**Plan:** 02 of 3
**Status:** In progress - Plan 02 complete
**Last activity:** 2026-02-13 — Completed plan 15-02, React Router and URL state infrastructure

Progress: [████████████░░░░░░░░] 79.0% (15/18 phases with 2 plans complete)

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
- Phase 15: Source Filtering (2/3 plans complete) - Backend multi-platform filtering done, React Router URL state infrastructure ready
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
- **Hybrid Architecture**: Local DB for privacy/control, Cloud APIs for quality/speed (v1.0)
- **API Key Auth**: Simpler for local tools, persistent, no refresh token complexity (v1.2)
- **uv Package Manager**: Faster, robust venv handling, prevents system breakage (v1.2)

### Key Learnings from v1.3

- **Stateless Auth:** Removing session management significantly simplified the codebase
- **Schema Alignment Critical:** Backend and frontend must agree on response structure - nested meta object pattern provides better extensibility
- **APIRequestContext vs Page Routing:** Playwright's APIRequestContext is separate from Page - page.route interceptors don't affect API requests
- **Single Worker Mode:** Set workers: 1 to prevent LanceDB file locking conflicts

### Pending Todos

None yet (new milestone).

### Blockers / Concerns

None yet (new milestone).

## Session Continuity

**Last session end:** 2026-02-13
**Stopped at:** Completed plan 15-02 (React Router and URL state infrastructure), 3 commits, build passing
**Resume file:** .planning/phases/15-source-filtering/15-02-SUMMARY.md
