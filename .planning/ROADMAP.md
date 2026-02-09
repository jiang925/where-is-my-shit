# Roadmap: Where Is My Shit (WIMS)

## Overview
Milestone v1.2 focuses on radical simplification of the user experience. By replacing the complex JWT authentication flow with a persistent API Key and modernizing the deployment process using `uv`, we aim to make WIMS a "one-command" install and a "zero-maintenance" tool for local AI interaction indexing.

## Phases

### Phase 9: API Key Auth & Config Consolidation
**Goal:** Replace session-based JWT auth with a persistent, simple API Key mechanism and unified configuration.

- **Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04
- **Dependencies:** None
- **Success Criteria:**
    1. Server automatically creates `~/.wims/server.json` with a secure random API Key if it doesn't exist.
    2. API endpoints authorize requests containing the `X-API-Key` header.
    3. Logs show redacted or masked keys (e.g., `sk-...abcd`) during startup and operation.
    4. JWT-related endpoints and logic are deprecated or removed in favor of the stateless key.

### Phase 10: Modernized Deployment (uv)
**Goal:** Standardize the installation and execution environment using `uv` for deterministic, fast setups.

- **Requirements:** DEPL-01, DEPL-02, DEPL-03
- **Dependencies:** Phase 9
- **Success Criteria:**
    1. `setup.sh` successfully installs `uv`, creates a virtual environment, and syncs dependencies.
    2. `start.sh` launches the backend server using the `uv` environment without manual activation.
    3. All project dependencies are managed via `pyproject.toml` and locked for consistency.

### Phase 11: Stateless Client Integration
**Goal:** Update the Browser Extension and File Watchers to utilize the new simplified authentication flow.

- **Requirements:** EXT-01, EXT-02, WATCH-01, WATCH-02
- **Dependencies:** Phase 9
- **Success Criteria:**
    1. Extension options page allows the user to save their API Key.
    2. Extension successfully ingests chats using the `X-API-Key` header (Login UI is removed/bypassed).
    3. File watchers automatically discover the API Key from `~/.wims/server.json` and ingest logs.

## Progress Tracking

| Phase | Status | Progress |
|-------|--------|----------|
| 9 - API Key Auth | 9 - API Key Auth | 9 - API Key Auth & Config | Pending | 0% | Config | Complete | 100% | Config | Complete | 100% |
| 10 - Modernized Deployment | Complete | 100% |
| 11 - Stateless Client Integration | Pending | 0% |

---
*Last updated: 2026-02-08*
