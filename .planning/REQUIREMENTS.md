# Requirements: Where Is My Shit (WIMS)

**Defined:** 2026-02-08
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions.

## v1.2 Requirements

Focus: Simplify auth and modernize deployment.

### Authentication & Config

- [ ] **AUTH-01**: Server auto-generates persistent API Key on first run if missing.
- [ ] **AUTH-02**: Server loads configuration (API Key, Port) from `~/.wims/server.json`.
- [ ] **AUTH-03**: API accepts `X-API-Key` header for authentication (replacing JWT).
- [ ] **AUTH-04**: Server logs mask the API Key during startup/operation.

### Deployment & Setup

- [ ] **DEPL-01**: `setup.sh` installs `uv` and creates `.venv` with all dependencies.
- [ ] **DEPL-02**: `start.sh` handles virtualenv activation and server launch in one command.
- [ ] **DEPL-03**: Project uses `pyproject.toml` (or `uv.lock`) for deterministic dependencies.

### Clients (Extension & Watchers)

- [ ] **EXT-01**: Extension options page allows user to paste/save API Key.
- [ ] **EXT-02**: Extension uses stored API Key for all requests (removes Login/JWT flow).
- [ ] **WATCH-01**: Watchers read API Key from `~/.wims/config.json` (or `server.json`).
- [ ] **WATCH-02**: Watchers successfully ingest logs using API Key auth.

## v2 Requirements (Future)

- **SEARCH-01**: Advanced filters (date range, source type).
- **SEARCH-02**: Fuzzy search with customizable similarity threshold.
- **INGEST-01**: Generic file ingestion (PDF/MD) via drag-and-drop.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user Auth | Tool is single-user local-first. |
| Cloud Sync | Privacy constraint (v1/v1.2 is local only). |
| Docker-only | User wants native "one-command" script for now. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 9 | Pending |
| AUTH-02 | Phase 9 | Pending |
| AUTH-03 | Phase 9 | Pending |
| AUTH-04 | Phase 9 | Pending |
| DEPL-01 | Phase 10 | Pending |
| DEPL-02 | Phase 10 | Pending |
| DEPL-03 | Phase 10 | Pending |
| EXT-01 | Phase 11 | Pending |
| EXT-02 | Phase 11 | Pending |
| WATCH-01 | Phase 11 | Pending |
| WATCH-02 | Phase 11 | Pending |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-08*
