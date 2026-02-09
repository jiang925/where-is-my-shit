# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions.
**Current Focus:** v1.2 Simplify & Deploy (Removing auth friction and modernizing setup).

## Current Position

**Phase:** Phase 9: API Key Auth & Config Consolidation
**Plan:** 01 (Config Infrastructure) of 03
**Status:** 🟡 IN PROGRESS
**Last activity:** 2026-02-09 - Completed 09-01 Config Infrastructure

```text
[======--------------] 33%
```

## Performance Metrics
- **Auth Flow:** JWT (Current) -> API Key (Target)
- **Setup Time:** ~5 mins (Current) -> <1 min (Target)
- **Dependencies:** Manual venv (Current) -> uv (Target)

## Accumulated Context

### Decisions
- **API Key over JWT:** JWT refresh logic was too complex for a single-user local tool. API Keys provide better persistence for background watchers.
- **uv for Setup:** Chosen for speed and the ability to manage the Python version and virtual environment in a single tool.
- **Config Path:** Moving to `~/.wims/server.json` to follow standard Unix-like configuration patterns.
- **Hot Reloading:** Implemented via `watchfiles` to allow key rotation without server restart.

### Key Learnings
- Extension V3 service workers lose state frequently; a persistent API Key stored in `chrome.storage.sync` or `local` is more reliable than a memory-resident JWT.

### Blockers / Risks
- **Backward Compatibility:** Need to ensure the Extension doesn't break for existing v1.1 users during the transition (or provide a clear upgrade path).

## Session Continuity

**Last session end:** Completed robust configuration system with hot-reloading.
**Current session goal:** Proceed to auth switchover (Plan 02).
