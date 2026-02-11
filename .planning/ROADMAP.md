# Roadmap: Where Is My Shit (WIMS)

## Overview
WIMS is evolving from a prototype to a robust, user-friendly local indexing tool. v1.2 has established a stable foundation with simplified auth and deployment.

## Completed Milestones

### v1.2: Simplify & Deploy (Feb 2026)
**Goal:** Radical simplification of UX and deployment.
- **Auth:** Moved from JWT to API Key (`X-API-Key`).
- **Config:** Centralized in `~/.wims/server.json`.
- **Deploy:** Standardized on `uv` with `setup.sh`/`start.sh`.
- **Clients:** Stateless extension and watchers.

### v1.1: Security & Hardening (Feb 2026)
**Goal:** Security and CI/CD foundations.
- **Security:** Local binding, password hashing, basic auth.
- **Quality:** CI pipelines, unit/integration tests.

### v1.0: Proof of Concept (Jan 2026)
**Goal:** MVP.
- **Core:** Ingestion, Embedding, Vector Search.
- **UI:** Basic React frontend.

## Upcoming Milestones

### v1.3: Advanced Retrieval (Planned)
**Goal:** Enhance the search experience to make finding content easier and more precise.

- **Requirements:**
  - [ ] **SEARCH-01**: Date range filtering.
  - [ ] **SEARCH-02**: Source type filtering (Claude vs. ChatGPT vs. Local).
  - [ ] **SEARCH-03**: Fuzzy search threshold controls.
  - [ ] **UI-01**: Enhanced search result cards with better metadata visualization.

### v1.4: Expanded Ingestion (Future)
**Goal:** Support more data sources beyond web chats.

- **Requirements:**
  - [ ] **INGEST-01**: PDF/Markdown file ingestion.
  - [ ] **INGEST-02**: Drag-and-drop upload interface.
  - [ ] **INGEST-03**: Audio transcription integration (Whisper).

## Progress Tracking

| Phase | Status | Progress |
|-------|--------|----------|
| **v1.2 Phases** | | |
| 9 - API Key Auth | Complete | 100% |
| 10 - Modernized Deployment | Complete | 100% |
| 11 - Stateless Clients | Complete | 100% |

---
*Last updated: 2026-02-11*
