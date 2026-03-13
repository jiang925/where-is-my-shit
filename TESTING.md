# TESTING.md — Where Is My Shit (WIMS)

Test inventory, coverage gaps, and implementation plan. This file is the source of truth for what's tested and what isn't.

**Workflow:** Enumerate → Audit → Implement → Run → Fix → Move on to features.

## 1. Test Layers Overview

| Layer | Tool | Command | Target Coverage |
|-------|------|---------|-----------------|
| Backend unit | pytest + pytest-cov | `uv run pytest --cov=src --cov-report=term-missing` | 90%+ line coverage |
| Frontend unit | vitest + @vitest/coverage-v8 | `cd ui && npx vitest --coverage` | 90%+ line coverage |
| Integration | pytest + TestClient | `uv run pytest tests/integration/ -v` | All API endpoints |
| E2E (browser) | Playwright | `npx playwright test` | All pages and user flows |
| Lint | ruff + eslint | `uv run ruff check src/ tests/` | Clean |

## 2. Backend Unit Tests

### Existing (20 files, ~176 tests)

| File | Tests | Covers |
|------|-------|--------|
| `tests/core/test_auth.py` | 3 | API key validation (valid, missing, invalid) |
| `tests/test_browse.py` | 8 | Browse endpoint: pagination, date/platform filters, auth |
| `tests/test_compaction.py` | 24 | CompactionManager: thresholds, locking, threads, singleton |
| `tests/test_content_quality.py` | 11 | Filler detection, quality scoring, exact match override |
| `tests/test_core_db.py` | 3 | DB connection, table init, singleton pattern |
| `tests/test_core_embeddings.py` | 27 | Embedding service, provider factory, config, reset |
| `tests/test_cors_auth.py` | 6 | CORS headers, preflight, API key rejection, health no-auth |
| `tests/test_export.py` | 4 | Export zip, markdown content, platform filter, auth |
| `tests/test_migration.py` | 22 | Schema migration status, add columns, reembed, promote, auto-resume |
| `tests/test_reranker.py` | 13 | Score combination, exact match boost, tier split, normalization |
| `tests/test_stats.py` | 10 | Stats counts, platform breakdown, granularity, filters, auth |
| `tests/test_terminal.py` | 4 | Terminal open: auth, path validation, directory/file handling |
| `tests/test_thread.py` | 10 | Thread retrieval, ordering, role, delete, SQL injection defense |

### Missing — Must Add

| File to Create | Tests Needed | Covers |
|----------------|-------------|--------|
| `tests/test_search.py` | ~10 | Search endpoint: basic query, platform filter, conversation filter, empty results, auth required, error handling, two-tier response, conversation context enrichment |
| `tests/test_ingest.py` | ~8 | Ingest endpoint: basic ingest, auto-generated ID, duplicate handling, missing fields (422), embedding failure (500), auth required, compaction trigger |
| `tests/test_health.py` | ~4 | Health endpoint: response structure, system stats present, DB stats, no auth required |
| `tests/test_config.py` | ~10 | ConfigManager: load existing, create new, corrupt file backup, reload, atomic save, env var path, API key generation, EmbeddingConfig defaults |
| `tests/test_schemas.py` | ~6 | Pydantic models: IngestRequest validation, SearchRequest defaults, Message construction, SearchResultMeta fields, StatsResponse structure |
| `tests/test_spa.py` | ~5 | SPA serving: index.html fallback, static file serving, path traversal prevention, API 404 passthrough |

**Estimated new tests: ~43**

## 3. Frontend Unit Tests

### Existing (12 files, 82 tests)

| File | Tests | Covers |
|------|-------|--------|
| `ui/src/App.test.tsx` | 1 | API key prompt when unauthenticated |
| `ui/src/components/ResultCard.test.tsx` | 13 | Rendering, badges, highlights, focus, selection |
| `ui/src/components/SearchBar.test.tsx` | 5 | Rendering, debounce, inputRef, autoFocus |
| `ui/src/hooks/useKeyboardNavigation.test.ts` | 12 | Arrow keys, enter, escape, slash, home/end |

### Missing — Must Add

| File to Create | Tests Needed | Covers |
|----------------|-------------|--------|
| `ui/src/components/SourceFilterUI.test.tsx` | ~6 | Platform chip rendering, toggle behavior, active state, callback |
| `ui/src/components/PresetButtons.test.tsx` | ~5 | Preset selection, "All Sources" toggle, "Web Chats" preset includes perplexity |
| `ui/src/components/DateRangeFilter.test.tsx` | ~5 | Button rendering, active state, callback with date range values |
| `ui/src/components/CopyablePath.test.tsx` | ~5 | Path display, truncation, copy button, "Copied" feedback, Open in Terminal button |
| `ui/src/components/TimelineSection.test.tsx` | ~4 | Section header, children rendering, empty state |
| `ui/src/components/ConversationPanel.test.tsx` | ~8 | Message rendering, role indicators, close button, export button, delete button, thread search, loading state |
| `ui/src/hooks/useTheme.test.ts` | ~6 | System/light/dark cycling, localStorage persistence, class toggling, system preference detection |
| `ui/src/lib/dateGroups.test.ts` | ~5 | Date grouping logic: today, this week, this month, older |
| `ui/src/utils/pathUtils.test.ts` | ~4 | Path detection (file vs URL), path truncation, directory extraction |

**Estimated new tests: ~48**

## 4. Integration Tests (API Endpoint Coverage)

Uses FastAPI `TestClient` — no live server needed. Tests the full request/response cycle including auth, validation, DB, and response format.

### File: `tests/integration/test_api_endpoints.py`

Every endpoint must have at least: happy path, auth required, error case.

| Endpoint | Method | Tests Needed |
|----------|--------|-------------|
| `/api/v1/ingest` | POST | ingest_creates_document, ingest_returns_201, ingest_requires_auth, ingest_validates_fields |
| `/api/v1/search` | POST | search_returns_results, search_empty_query, search_platform_filter, search_requires_auth, search_returns_two_tier |
| `/api/v1/browse` | POST | browse_returns_conversations, browse_pagination, browse_date_filter, browse_platform_filter, browse_requires_auth |
| `/api/v1/stats` | GET | stats_returns_counts, stats_granularity_param, stats_platform_filter, stats_requires_auth |
| `/api/v1/thread/{id}` | GET | thread_returns_messages, thread_empty, thread_requires_auth |
| `/api/v1/conversations/{id}` | DELETE | delete_removes_messages, delete_not_found, delete_requires_auth |
| `/api/v1/export` | POST | export_returns_zip, export_platform_filter, export_requires_auth |
| `/api/v1/open-terminal` | POST | terminal_valid_path, terminal_invalid_path, terminal_requires_auth |
| `/api/v1/health` | GET | health_returns_status, health_no_auth_required |

**Estimated tests: ~30**

## 5. E2E Tests (Playwright)

### Existing (18 spec files, 70 CI tests + 11 exploratory)

| File | Tests | Covers |
|------|-------|--------|
| `auth-error.spec.ts` | 2 | Auth prompt, disabled button |
| `browse-timeline.spec.ts` | 9 | Browse API, pagination, filters, timeline sections, URL state |
| `delete-conversation.spec.ts` | 4 | Delete button, confirmation dialog, cancel, confirm |
| `exploratory.spec.ts` | 11 | Manual: search, presets, browse, scores, copy path, URL state (excluded from CI) |
| `export.spec.ts` | 6 | Export all button, zip download, single export |
| `filter-backend.spec.ts` | 5 | Platform filter API: single, list, invalid, none, combined |
| `fixtures-demo.spec.ts` | 3 | Auth fixture, database fixture, config |
| `keyboard-nav.spec.ts` | 6 | Arrow keys, enter, slash, escape |
| `open-terminal.spec.ts` | 2 | Terminal button in search results and conversation panel |
| `path-display.spec.ts` | 3 | File path display, copy feedback, truncation |
| `search-flow.spec.ts` | 1 | Authenticate + search + see results |
| `search-relevance.spec.ts` | 3 | Two-tier response, relevance score, missing secondary |
| `server-start.spec.ts` | 1 | Server health check |
| `source-filter-ui.spec.ts` | 2 | Platform filtering on search and browse |
| `thread-search.spec.ts` | 4 | Thread search input, match count, highlights, dimming |
| `ui-regression.spec.ts` | 12 | Visual regressions: scores, clamp, cursors, presets, sections, header |

### Missing — Must Add

| File to Create | Tests Needed | Covers |
|----------------|-------------|--------|
| `stats-page.spec.ts` | ~5 | Stats page loads, charts render, platform breakdown visible, granularity selector, empty state |
| `dark-mode.spec.ts` | ~4 | Theme toggle cycles, dark class applied, persists after reload, system preference respected |

**Estimated new tests: ~9**

## 6. Coverage Reporting

### Backend (pytest-cov) — NOT YET CONFIGURED

Add to `pyproject.toml`:
```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=6.0.0",    # ADD THIS
    "httpx>=0.26.0",
    "ruff>=0.2.0",
]

[tool.coverage.run]
source = ["src"]
omit = ["src/static/*"]

[tool.coverage.report]
fail_under = 90
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if __name__",
    "if TYPE_CHECKING",
]
```

Commands:
```bash
uv run pytest --cov=src --cov-report=term-missing   # Terminal
uv run pytest --cov=src --cov-report=html            # HTML report in htmlcov/
```

### Frontend (vitest coverage) — NOT YET CONFIGURED

Add `@vitest/coverage-v8` to devDependencies and update `vite.config.ts`:
```ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/main.tsx', 'src/setupTests.ts', 'src/**/*.test.*'],
    thresholds: { lines: 90 },
  },
}
```

Commands:
```bash
cd ui && npx vitest --coverage        # Terminal
cd ui && npx vitest --coverage --run  # Single run (CI)
```

## 7. Implementation Checklist

Work through in order. Check off as completed.

- [ ] **Step 0: Add coverage tooling**
  - [ ] Add `pytest-cov` to dev dependencies, configure in `pyproject.toml`
  - [ ] Add `@vitest/coverage-v8` to UI devDependencies, configure in `vite.config.ts`
  - [ ] Run baseline coverage reports to measure starting point

- [ ] **Step 1: Backend unit tests (fill gaps)**
  - [x] `tests/test_search.py` — Search endpoint tests (10 tests)
  - [x] `tests/test_ingest.py` — Ingest endpoint tests (8 tests)
  - [x] `tests/test_health.py` — Health endpoint tests (4 tests)
  - [x] `tests/test_config.py` — ConfigManager tests (10 tests)
  - [x] `tests/test_schemas.py` — Pydantic model tests (6 tests)
  - [x] `tests/test_spa.py` — SPA serving tests (5 tests)
  - [ ] Run coverage, verify 90%+

- [ ] **Step 2: Frontend unit tests (fill gaps)**
  - [x] `SourceFilterUI.test.tsx` (7 tests)
  - [x] `PresetButtons.test.tsx` (6 tests)
  - [x] `DateRangeFilter.test.tsx` (5 tests)
  - [x] `CopyablePath.test.tsx` (5 tests)
  - [x] `TimelineSection.test.tsx` (4 tests)
  - [ ] `ConversationPanel.test.tsx` — Skipped (complex deps, well-covered by e2e)
  - [x] `useTheme.test.ts` (6 tests)
  - [x] `dateGroups.test.ts` (9 tests)
  - [x] `pathUtils.test.ts` (9 tests)
  - [ ] Run coverage, verify 90%+

- [ ] **Step 3: Integration tests**
  - [ ] Create `tests/integration/` directory with `conftest.py`
  - [ ] `tests/integration/test_api_endpoints.py` — All endpoints
  - [ ] Verify all endpoints have happy path + auth + error tests

- [x] **Step 4: E2E tests (fill gaps)**
  - [x] `stats-page.spec.ts` (5 tests)
  - [x] `dark-mode.spec.ts` (4 tests)
  - [x] Run full Playwright suite, fix failures

- [ ] **Step 5: CI integration**
  - [ ] Add coverage thresholds to CI pipeline
  - [ ] Add integration tests to CI pipeline
  - [ ] Verify all jobs pass

## 8. Manual Curl Endpoint Tests

All API endpoints verified with curl against a live server (2026-03-13). Server started with `start.sh`, embedding model: BAAI/bge-m3 (1024-dim vectors).

| # | Endpoint | Method | Curl Command | Status | Response |
|---|----------|--------|-------------|--------|----------|
| 1 | `/api/v1/health` | GET | `curl http://localhost:8000/api/v1/health` | 200 | `{"status":"healthy","system":{...},"database":{"connected":true,"row_count":N}}` |
| 2 | `/api/v1/ingest` | POST | `curl -X POST .../ingest -H "X-API-Key: $KEY" -d '{"content":"...","platform":"chatgpt","conversation_id":"test","title":"Test","timestamp":"2026-03-13T00:00:00Z"}'` | 201 | `{"id":"<uuid>","status":"created"}` |
| 3 | `/api/v1/search` | POST | `curl -X POST .../search -H "X-API-Key: $KEY" -d '{"query":"test"}'` | 200 | `{"groups":[...],"count":N,"secondary_groups":[...],...}` |
| 4 | `/api/v1/browse` | POST | `curl -X POST .../browse -H "X-API-Key: $KEY" -d '{"limit":5}'` | 200 | `{"items":[...],"total":N,"hasMore":bool}` |
| 5 | `/api/v1/stats` | GET | `curl .../stats -H "X-API-Key: $KEY"` | 200 | `{"total_messages":N,"total_conversations":N,"by_platform":{...},"activity":[...]}` |
| 6 | `/api/v1/thread/{id}` | GET | `curl .../thread/conv-id -H "X-API-Key: $KEY"` | 200 | `{"items":[...],"total":N}` |
| 7 | `/api/v1/conversations/{id}/title` | PATCH | `curl -X PATCH .../conversations/conv-id/title -H "X-API-Key: $KEY" -d '{"title":"New Title"}'` | 200 | `{"conversation_id":"...","title":"New Title"}` |
| 8 | `/api/v1/export` | POST | `curl -X POST .../export -H "X-API-Key: $KEY" -d '{}'` | 200 | ZIP file (application/zip) |
| 9 | `/api/v1/open-terminal` | POST | `curl -X POST .../open-terminal -H "X-API-Key: $KEY" -d '{"path":"/tmp"}'` | 200 | `{"opened":"/private/tmp"}` |
| 10 | `/api/v1/conversations/{id}` | DELETE | `curl -X DELETE .../conversations/conv-id -H "X-API-Key: $KEY"` | 200 | `{"deleted":1,"conversation_id":"..."}` |

**Key fix applied:** All endpoints using dummy vector scanning (`[0.0] * 384`) were updated to use `db_client.get_vector_dim()` which reads the actual vector dimension from the table schema. This resolved 500 errors on browse, stats, thread, export, delete, and title update endpoints when the DB contains 1024-dim vectors (bge-m3 model).

## 9. Running the Full Suite

```bash
# Backend unit + coverage
uv run pytest --cov=src --cov-report=term-missing

# Frontend unit + coverage
cd ui && npx vitest --coverage --run

# Integration (subset of pytest)
uv run pytest tests/integration/ -v

# E2E
npx playwright test

# Everything
uv run pytest --cov=src --cov-report=term-missing && cd ui && npx vitest --coverage --run && cd .. && npx playwright test
```
