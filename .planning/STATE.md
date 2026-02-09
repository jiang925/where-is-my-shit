# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions.
**Current Focus:** v1.2 Simplify & Deploy (Removing auth friction and modernizing setup).

## Current Position

**Phase:** Phase 10: Modernized Deployment
**Plan:** Complete
**Status:** ✅ COMPLETE
**Last activity:** 2026-02-09 - Phase 10 executed and verified.

```text
[====================] 100%
```

## Performance Metrics
- **Auth Flow:** API Key (Achieved)
- **Setup Time:** <1 min (Achieved via auto-config & uv)
- **Dependencies:** Standardized (uv + pyproject.toml)

## Accumulated Context

### Decisions
- **API Key over JWT:** JWT refresh logic was too complex for a single-user local tool. API Keys provide better persistence for background watchers.
- **Config Persistence:** Configuration is stored in `~/.wims/server.json` and auto-generated on first run.
- **Fail-Fast Startup:** Server exits immediately if the port is in use, rather than failing obscurely later.
- **Startup UX:** The API Key is printed to stdout on startup for easy copy-pasting, improving the "one-command" experience.
- **UV for Everything:** Standardized on `uv` for both local dev and Docker builds to ensure environment consistency.
- **Pre-download Models:** `setup.sh` explicitly downloads embedding models (`BAAI/bge-small-en-v1.5`) to prevent first-request timeouts.
- **Docker Multi-stage:** Used official `ghcr.io/astral-sh/uv` image to bootstrap `uv` in Dockerfile rather than curl scripts.

### Key Learnings
- **Stateless Auth:** Removing session management significantly simplified the codebase and reduced dependencies.
- **Hot Reloading:** Using `watchfiles` allows for config changes (like key rotation) without restarting the server.
- **UV Speed:** `uv sync` is significantly faster than pip, making Docker builds much quicker.

### Blockers / Risks
- **Extension Update Required:** The Chrome extension MUST be updated (Phase 11) to send `X-API-Key` instead of Bearer tokens. Existing users will need to update.

## Session Continuity

**Last session end:** Completed Phase 10 (Modernized Deployment).
**Current session goal:** Begin Phase 11 (Stateless Client Integration).
