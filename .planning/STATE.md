# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions.
**Current Focus:** Debug UI/API Connection (Phase 12)

## Current Position

**Phase:** 1 of 3 (Debug UI/API Connection)
**Plan:** 0 in current phase
**Status:** Ready to plan
**Last activity:** 2026-02-12 — Roadmap created for v1.3

```text
[░░░░░░░░░░] 0% (v1.3)
```

## Performance Metrics
- **Auth Flow:** API Key (Extension & Watcher Integrated)
- **Setup Time:** <1 min (Achieved via auto-config & uv)
- **Dependencies:** Standardized (uv + pyproject.toml)

## Accumulated Context

### Decisions
- **Stateless Extension:** Extension updated to use `X-API-Key` and removed all login UI/JWT logic.
- **Stateless Watcher:** Python watcher now runs entirely stateless, relying on `X-API-Key` from config/env.
- **API Key over JWT:** JWT refresh logic was too complex for a single-user local tool. API Keys provide better persistence.
- **Config Persistence:** Configuration is stored in `~/.wims/server.json`.
- **Fail-Fast Startup:** Server exits immediately if the port is in use.
- **Startup UX:** API Key printed on startup.
- **UV for Everything:** Standardized on `uv`.
- **Remove Stale Integration Tests:** Deleted JWT/password auth integration tests that became obsolete after Phase 11 API key migration. Future integration tests should cover API key authentication flow.

### Key Learnings
- **Stateless Auth:** Removing session management significantly simplified the codebase.
- **Extension Store:** `chrome.storage.local` is sufficient for API keys; no need for `chrome.storage.sync` for local-only tools.

### Blockers / Risks
- None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | fetch the latest github action output. fix the lint issues. Or run the CI checks and fix from there. | 2026-02-11 | 1866dbf | [001-fetch-the-latest-github-action-output-fi](./quick/001-fetch-the-latest-github-action-output-fi/) |

## Session Continuity

**Last session end:** 2026-02-12 - Roadmap created for v1.3
**Current session goal:** Plan Phase 12: Debug UI/API Connection
