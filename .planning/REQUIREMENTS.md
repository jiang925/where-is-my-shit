# Requirements: Where Is My Shit (WIMS)

**Defined:** 2026-02-12
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

---

## v1.3 Requirements

Requirements for UI/API Integration & Verification milestone. Each maps to roadmap phases 12-14.

### CORS Configuration

- [ ] **CORS-01**: FastAPI allows CORS requests from the React frontend with explicit origins configured
- [ ] **CORS-02**: FastAPI CORSMiddleware includes OPTIONS, GET, POST methods for preflight handling
- [ ] **CORS-03**: FastAPI accepts Authorization header in CORS requests

### Authentication Flow

- [ ] **AUTH-05**: React frontend sends API key in `Authorization: Api-Key <token>` header format
- [ ] **AUTH-06**: FastAPI validates API key from `Authorization` header using `ApiKeyHeader` security scheme

### Test Infrastructure

- [ ] **TEST-05**: Playwright 1.58.2 is installed and configured in the project
- [ ] **TEST-06**: Playwright config launches FastAPI server automatically via webServer configuration
- [ ] **TEST-07**: Database fixtures inject and clean up test data to prevent test interference
- [ ] **TEST-08**: Test environment is configured with `.env.test` file for test-specific settings

### Integration Verification

- [ ] **INTEG-01**: User can enter an API key, submit a search query, and see search results displayed in the UI
- [ ] **INTEG-02**: User sees an appropriate error message when searching without an API key

---

## v2 Requirements

Deferred to future release. Not part of v1.3 scope.

Out of scope for v1.3:
- **Advanced search**: Date ranges, source filtering, similarity threshold
- **Enhanced UI**: Rich metadata, copy link features
- **Generic ingestion**: PDF/MD drag-and-drop
- **Audio transcription**

---

## Out of Scope

Explicitly excluded from v1.3 to maintain focused scope.

| Feature | Reason |
|---------|--------|
| Extension testing tests | Focus on web UI integration first; extension separate concern |
| Full E2E test suite | Keep tests minimal to ship quickly; expand in v1.4+ |
| Advanced search features | Fix core flow first, then add enhancements |
| Video/screen recording on test pass | Only on failure needed for CI debugging |
| Containerized test environment | Single-server architecture avoids Docker complexity |
| Search filtering (date, source) | Core flow first; filters for v1.4+ |

---

## Traceability

Which phases cover which requirements. Updated after roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORS-01 | Phase 12 | Pending |
| CORS-02 | Phase 12 | Pending |
| CORS-03 | Phase 12 | Pending |
| AUTH-05 | Phase 12 | Pending |
| AUTH-06 | Phase 12 | Pending |
| TEST-05 | Phase 13 | Pending |
| TEST-06 | Phase 13 | Pending |
| TEST-07 | Phase 13 | Pending |
| TEST-08 | Phase 13 | Pending |
| INTEG-01 | Phase 14 | Pending |
| INTEG-02 | Phase 14 | Pending |

**Coverage:**
- v1.3 requirements: 10 total
- Mapped to phases: TBD (after roadmap created)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after v1.3 requirements definition*
