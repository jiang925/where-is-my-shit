# Where Is My Shit (WIMS)

## What This Is
A centralized indexing and retrieval system for AI interactions across fragmented platforms. It ingests conversations from web-based AI tools (ChatGPT, Claude, Gemini) and local development environments (Claude Code, Cursor), processes them into a searchable vector store, and provides a unified interface to find and deep-link back to original contexts.

## Core Value
Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

## Current Milestone: v1.2 (Planning)

**Status:** Planning / TBD

## Recent Milestone: v1.1 Security & Hardening (Shipped)

**Goal:** Harden the system for public/shared use and establish robust engineering practices (CI/CD, TDD).

### Validated
- [x] **SEC-01**: API requires authentication (Basic/Token) for ingestion and search.
- [x] **SEC-02**: System generates/validates JWT tokens with expiration.
- [x] **SEC-03**: User can set an initial password via CLI/Env var on first run.
- [x] **SEC-04**: Passwords are hashed (Argon2/bcrypt) before storage.
- [x] **SEC-05**: API binds explicitly to `127.0.0.1` by default.
- [x] **CI-01**: GitHub Actions workflow runs tests and linting on push.
- [x] **CI-02**: GitHub Actions workflow runs Frontend/Extension linting & build on push.
- [x] **CI-03**: Workflow fails if code style (Ruff/ESLint) is not compliant.
- [x] **TEST-01**: Unit test suite covers Core Engine services (Embedding, DB).
- [x] **TEST-02**: Integration tests cover full Ingest -> Search flow.
- [x] **TEST-03**: Frontend components have basic unit tests (Vitest).
- [x] **HARD-01**: Extension handles API errors gracefully with user feedback.
- [x] **HARD-02**: Watchers support authenticated requests.
- [x] **HARD-03**: CORS configured with strict allow-list.

## Context

Shipped v1.1 on 2026-02-07.
- **Status:** Secure, authenticated system with CI/CD.
- **Tech Stack:** Python (FastAPI/FastEmbed/LanceDB), TypeScript (React/Chrome Extension).
- **Privacy:** Fully local operation (no cloud embeddings used in v1).

## Constraints

- **Type**: Privacy — Data stored locally (hybrid model).
- **Type**: Usability — Must provide deep links to original content, not just text recall.
- **Type**: Integration — Must handle "closed ecosystems" via browser extension.
- **Type**: Performance — Local watchers must be lightweight/low-load.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Hybrid Architecture** | Local DB for privacy/control, Cloud APIs for quality/speed. | ✓ Implemented (Local-only for v1) |
| **Extension for Web** | DOM scraping/monitoring required for closed APIs. | ✓ Implemented |
| **File Watchers for Dev** | Low-friction log capture. | ✓ Implemented |
| **JWT Auth** | Stateless, secure, easy to verify in distributed clients. | ✓ Implemented (v1.1) |
| **Local Binding** | `127.0.0.1` restriction prevents LAN exposure by default. | ✓ Implemented (v1.1) |

---
*Last updated: 2026-02-07 (v1.1 Shipped)*
