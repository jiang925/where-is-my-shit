# Roadmap: Where Is My Shit (WIMS)

**Milestone:** v1.1 Security & Hardening
**Status:** In Progress
**Progress:** 0 / 3 Phases

## Overview

Milestone v1.1 focuses on transforming the MVP into a robust, secure application. The primary goals are to secure the local API with authentication, establish a "green build" culture via CI/CD, and prove reliability through comprehensive testing. This moves the project from "works on my machine" to "stable engineering product."

## Phases

### Phase 5: Quality & CI/CD

**Goal:** Automated pipelines prevent regression and ensure code quality.

| Requirement | Description |
|-------------|-------------|
| **CI-01** | GitHub Actions workflow runs Backend tests (Pytest) on push |
| **CI-02** | GitHub Actions workflow runs Frontend/Extension linting & build on push |
| **CI-03** | Workflow fails if code style (Ruff/ESLint) is not compliant |
| **TEST-01** | Unit test suite covers Core Engine services (Embedding, DB) |
| **TEST-03** | Frontend components have basic unit tests (Vitest) |

**Success Criteria:**
1. Push to main triggers automated testing without manual intervention.
2. Badly formatted code fails the build (linting enforcement).
3. Core backend services have >80% unit test coverage verified by report.
4. Frontend build succeeds in CI environment.

### Phase 6: Security Core

**Goal:** API is secured against unauthorized local/network access.

| Requirement | Description |
|-------------|-------------|
| **SEC-01** | API endpoints (`/search`, `/ingest`) require JWT Bearer authentication |
| **SEC-02** | System generates/validates JWT tokens with expiration |
| **SEC-03** | User can set an initial password via CLI/Env var on first run |
| **SEC-04** | Passwords are hashed (Argon2/bcrypt) before storage |
| **SEC-05** | API binds explicitly to `127.0.0.1` by default |
| **HARD-03** | CORS configured with strict allow-list (Extension ID + Localhost) |

**Success Criteria:**
1. Unauthenticated requests to `/search` or `/ingest` return 401/403.
2. User is prompted to set password on first launch (if not set).
3. API is not accessible from other devices on the LAN (only 127.0.0.1).
4. Valid JWT token allows access to protected endpoints.

### Phase 7: Integration Hardening

**Goal:** Clients handle security gracefully and end-to-end flows are verified.

| Requirement | Description |
|-------------|-------------|
| **HARD-01** | Extension handles 401 Unauthorized errors with login prompt |
| **HARD-02** | Watchers support authenticated requests (API Key/Token) |
| **TEST-02** | Integration test suite covers API endpoints (Ingest -> Search) |

**Success Criteria:**
1. Extension prompts user for login when token expires/missing.
2. Watchers continue indexing without user intervention after initial auth config.
3. Automated integration suite passes full ingest-to-search flow with auth enabled.
4. Extension functions normally (ingests/searches) after authentication.

## Progress

| Phase | Status | Completion |
|-------|--------|------------|
| 5 - Quality & CI/CD | **Complete** | 100% |
| 6 - Security Core | **Complete** | 100% |
| 7 - Integration Hardening | **Planned** | 0% |
