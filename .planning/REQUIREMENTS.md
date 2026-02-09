# Requirements: Where Is My Shit (WIMS)

**Defined:** 2026-02-07
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform.

## v1.1 Requirements

### Security
- [x] **SEC-01**: API endpoints (`/search`, `/ingest`) require JWT Bearer authentication
- [x] **SEC-02**: System generates/validates JWT tokens with expiration
- [x] **SEC-03**: User can set an initial password via CLI/Env var on first run
- [x] **SEC-04**: Passwords are hashed (Argon2/bcrypt) before storage
- [x] **SEC-05**: API binds explicitly to `127.0.0.1` by default (prevent LAN exposure)

### CI/CD
- [x] **CI-01**: GitHub Actions workflow runs Backend tests (Pytest) on push
- [x] **CI-02**: GitHub Actions workflow runs Frontend/Extension linting & build on push
- [x] **CI-03**: Workflow fails if code style (Ruff/ESLint) is not compliant

### Testing
- [x] **TEST-01**: Unit test suite covers Core Engine services (Embedding, DB)
- [ ] **TEST-02**: Integration test suite covers API endpoints (Ingest -> Search)
- [x] **TEST-03**: Frontend components have basic unit tests (Vitest)

### Hardening
- [ ] **HARD-01**: Extension handles 401 Unauthorized errors with login prompt
- [ ] **HARD-02**: Watchers support authenticated requests (API Key/Token)
- [x] **HARD-03**: CORS configured with strict allow-list (Extension ID + Localhost)

## v2 Requirements (Deferred)

### Advanced Security
- **SEC-ADV-01**: Audit logging for all search/access events
- **SEC-ADV-02**: Rate limiting for API endpoints

## Out of Scope

| Feature | Reason |
|---------|--------|
| **Multi-user Support** | Single-user local tool; usage isolation not needed yet. |
| **Cloud Auth (Auth0)** | Local-first privacy requirement; self-hosted auth only. |
| **E2E Browser Tests** | Playwright/Selenium setup too heavy for v1.1 CI. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 6 | Complete |
| SEC-02 | Phase 6 | Complete |
| SEC-03 | Phase 6 | Complete |
| SEC-04 | Phase 6 | Complete |
| SEC-05 | Phase 6 | Complete |
| CI-01 | Phase 5 | Complete |
| CI-02 | Phase 5 | Complete |
| CI-03 | Phase 5 | Complete |
| TEST-01 | Phase 5 | Complete |
| TEST-02 | Phase 7 | Pending |
| TEST-03 | Phase 5 | Complete |
| HARD-01 | Phase 7 | Pending |
| HARD-02 | Phase 7 | Pending |
| HARD-03 | Phase 6 | Complete |

---
*Requirements defined: 2026-02-07*
