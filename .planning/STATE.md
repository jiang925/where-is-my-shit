# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.
**Current Focus:** v1.4 Search & Browse UX Polish - Phase 15 (Source Filtering)

## Current Position

**Phase:** 15 of 18 (Source Filtering)
**Plan:** Not yet planned
**Status:** Ready to plan
**Last activity:** 2026-02-12 — v1.4 roadmap created with 4 phases (15-18)

Progress: [███████████░░░░░░░░░] 77.8% (14/18 phases complete)

## Performance Metrics

**By Milestone:**

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 MVP | 4 | Complete (2026-02-07) |
| v1.1 Security & Hardening | 3 | Complete (2026-02-07) |
| v1.2 Simplify & Deploy | 4 | Complete (2026-02-11) |
| v1.3 UI/API Integration | 3 | Complete (2026-02-12) |
| v1.4 Search & Browse UX | 4 | Not started |

**v1.4 Progress:**
- Phase 15: Source Filtering (0/TBD plans) - Not started
- Phase 16: Claude Code Path Display (0/TBD plans) - Not started
- Phase 17: Search Relevance Improvements (0/TBD plans) - Not started
- Phase 18: Browse Page with Timeline (0/TBD plans) - Not started

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v1.4:

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

**Last session end:** 2026-02-12
**Stopped at:** Created v1.4 roadmap with 4 phases (15-18), mapped all 15 requirements, validated 100% coverage
**Resume file:** None - ready to plan Phase 15
