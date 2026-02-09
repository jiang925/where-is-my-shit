# Project Research Summary

**Project:** Where Is My Shit (WIMS)
**Domain:** Local-First Personal Search / Knowledge Management
**Researched:** 2026-02-07
**Confidence:** HIGH

## Executive Summary

Where Is My Shit (WIMS) is a local-first personal search engine designed to capture and index user browsing history securely. Experts build this type of tool using a "Sidecar" architecture, where a local Python server acts as the persistent "brain" (storage, vector processing) and a browser extension acts as the transient "sensor" (capturing content, displaying results). This approach ensures data privacy by keeping all indexing and retrieval on the user's machine, avoiding cloud dependencies.

The recommended approach creates a robust foundation using Python/FastAPI for the backend and React/Vite for the extension. Critical to success is a "Local-First" security model that avoids complex cloud identity providers (like Auth0) in favor of self-hosted JWT authentication. The architecture relies on SQLite for metadata and LanceDB for vector storage, leveraging an asynchronous ingestion queue to keep the browser extension responsive while heavy processing happens in the background.

Key risks include "Cloud Auth Complexity" (over-engineering security), "Works on My Machine" CI failures, and accidental network exposure. Mitigation strategies include strict `127.0.0.1` binding, a dedicated CI/CD pipeline ensuring environment consistency, and a simple token-based authentication handshake between the extension and the local server.

## Key Findings

### Recommended Stack

**Core technologies:**
- **Python 3.12+ / FastAPI:** Backend runtime and web server; chosen for async support and rich AI ecosystem.
- **LanceDB / SQLite:** Data layer; LanceDB for serverless vector storage, SQLite for robust metadata management.
- **React 19 / Vite:** Frontend extension; enables component-based UI with fast build times.
- **Pytest / Vitest:** Testing; industry standards for Python and JS respectively.

### Expected Features

**Must have (table stakes):**
- **API Authentication:** Simple JWT Bearer auth to protect `/search` and `/ingest` endpoints.
- **Secrets Management:** Secure handling of configuration via `.env` files (never committed).
- **CI/CD Pipeline:** Automated linting (Ruff/ESLint) and testing on push/PR.
- **CORS Configuration:** Strict allow-list to enable Extension-to-Server communication.

**Should have (competitive):**
- **Queued Ingestion:** Background processing to prevent UI blocking.
- **Audit Logging:** Tracking search/delete actions for security.

**Defer (v2+):**
- **Cloud Sync:** Complexity and privacy risk not needed for MVP.
- **User Management UI:** CLI management is sufficient for single-user MVP.

### Architecture Approach

The system follows a **Sidecar Pattern** decoupling the interface from the intelligence.

**Major components:**
1. **Browser Extension:** Captures page content and provides the search UI.
2. **Local Server:** API Gateway that manages auth, ingestion queues, and embedding generation.
3. **Storage Layer:** LanceDB (vectors) and SQLite (metadata) residing on the local filesystem.

### Critical Pitfalls

1. **The "Cloud Auth" Trap:** Using SaaS auth (Auth0) for a local app introduces unnecessary dependency. **Fix:** Use self-hosted JWT.
2. **"Works on My Machine":** CI fails due to environmental differences. **Fix:** Containerized tests and strict dependency locking (Poetry/Lockfiles).
3. **Network Exposure:** Defaulting to `0.0.0.0` exposes data to the LAN. **Fix:** Force `127.0.0.1` binding by default.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes a secure, testable foundation before feature expansion.

### Phase 1: Foundation & CI/CD
**Rationale:** Establishing quality gates and secrets management first prevents "security debt" and CI friction later.
**Delivers:** Repo setup, Secrets management (pydantic-settings), Linting/Formatting (Ruff), GitHub Actions pipeline.
**Addresses:** Secrets Management, Automated Linting, CI Workflow.
**Avoids:** "Works on My Machine" Syndrome.

### Phase 2: Core Server & Storage
**Rationale:** The "brain" (Server) must exist and define the schema before the "sensor" (Extension) can be built.
**Delivers:** FastAPI app structure, SQLite/LanceDB integration, Ingest/Search API shells.
**Uses:** Python 3.12, FastAPI, LanceDB, SQLite.
**Implements:** Local Server, Metadata DB, Vector DB.

### Phase 3: Security & Authentication
**Rationale:** Auth must be implemented before the extension integration to ensure the handshake is built correctly from the start.
**Delivers:** JWT implementation, CORS configuration, Rate limiting basics.
**Addresses:** API Authentication, CORS Configuration.
**Avoids:** The "Cloud Auth" Complexity Trap, "Forever Local" Network Exposure.

### Phase 4: Extension & Integration
**Rationale:** The extension depends on a working, secure API to function.
**Delivers:** React Extension setup, Auth handshake, Capture logic, Search UI.
**Uses:** React, Vite, Tailwind.
**Implements:** Content Script, Popup UI.

### Phase Ordering Rationale

- **Security First:** We address secrets and CI immediately to ensure a stable development lifecycle.
- **Server before Client:** The extension is a client of the server; the server's API contract needs to be established first.
- **Auth before Integration:** Attempting to retro-fit auth after building the extension integration often leads to major refactors.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Extension):** Browser extension manifestation (V3) can be tricky; specific messaging passing patterns might need prototyping.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard Python/GitHub Actions setup.
- **Phase 2 (Core Server):** Standard FastAPI/SQL patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Specific versions and libraries are well-defined and compatible. |
| Features | HIGH | Clear separation of table stakes vs. anti-features for a local tool. |
| Architecture | HIGH | The sidecar pattern is well-suited for this domain. |
| Pitfalls | HIGH | Pitfalls identified are specific and highly relevant to local-first dev. |

**Overall confidence:** HIGH

### Gaps to Address

- **Vector Tuning:** Research doesn't specify chunking strategies or specific embedding models. This can be addressed during Phase 2 implementation.
- **Extension IPC:** Specifics of Chrome Extension V3 message passing (Service Worker vs Content Script) need to be handled during Phase 4 planning.

## Sources

### Primary (HIGH confidence)
- **FastAPI Security Docs** — Validated JWT patterns.
- **Vitest Guide** — Validated frontend testing stack.
- **Local-First Web** — Architecture patterns.

### Secondary (MEDIUM confidence)
- **LanceDB Docs** — Embedded vector store capabilities.

---
*Research completed: 2026-02-07*
*Ready for roadmap: yes*
