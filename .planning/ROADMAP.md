# Roadmap: Where Is My Shit (WIMS)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-02-07)
- ✅ **v1.1 Security & Hardening** - Phases 5-7 (shipped 2026-02-07)
- ✅ **v1.2 Simplify & Deploy** - Phases 8-11 (shipped 2026-02-11)
- ✅ **v1.3 UI/API Integration & Verification** - Phases 12-14 (shipped 2026-02-12)
- ✅ **v1.4 Search & Browse UX Polish** - Phases 15-18 (shipped 2026-02-14)
- 🚧 **v1.5 Embedding & Infrastructure** - Phase 19 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-02-07</summary>

### Phase 1: Core Engine
**Goal**: Build self-contained local vector search engine
**Plans**: 3 plans

Plans:
- [x] 01-01: FastAPI scaffold with embedding service
- [x] 01-02: LanceDB integration with vector storage
- [x] 01-03: Search API with deep-link support

### Phase 2: Web Intelligence
**Goal**: Capture web-based AI chats in real-time
**Plans**: 3 plans

Plans:
- [x] 02-01: Chrome extension scaffold
- [x] 02-02: ChatGPT/Claude/Gemini DOM scraping
- [x] 02-03: Real-time ingestion pipeline

### Phase 3: Dev Intelligence
**Goal**: Capture local development AI sessions
**Plans**: 3 plans

Plans:
- [x] 03-01: File watcher service
- [x] 03-02: Claude Code/Cursor log parsing
- [x] 03-03: Batch ingestion with deduplication

### Phase 4: Unified Interface
**Goal**: Ship React-based search UI
**Plans**: 2 plans

Plans:
- [x] 04-01: Search UI with result cards
- [x] 04-02: Deep-link integration and deployment

</details>

<details>
<summary>✅ v1.1 Security & Hardening (Phases 5-7) - SHIPPED 2026-02-07</summary>

### Phase 5: Security Core
**Goal**: Harden API with authentication
**Plans**: 3 plans

Plans:
- [x] 05-01: JWT authentication system
- [x] 05-02: Local binding protections
- [x] 05-03: Integration testing

### Phase 6: Quality Infrastructure
**Goal**: Establish CI/CD pipelines
**Plans**: 2 plans

Plans:
- [x] 06-01: GitHub Actions workflow
- [x] 06-02: Unit test suite

### Phase 7: Client Hardening
**Goal**: Update clients for authenticated flows
**Plans**: 3 plans

Plans:
- [x] 07-01: Extension JWT integration
- [x] 07-02: Watcher authentication
- [x] 07-03: "Login First" UI

</details>

<details>
<summary>✅ v1.2 Simplify & Deploy (Phases 8-11) - SHIPPED 2026-02-11</summary>

### Phase 8: API Key Authentication
**Goal**: Replace JWT with persistent API keys
**Plans**: 2 plans

Plans:
- [x] 08-01: API key generation and storage
- [x] 08-02: X-API-Key header authentication

### Phase 9: Unified Configuration
**Goal**: Centralize server/watcher config
**Plans**: 2 plans

Plans:
- [x] 09-01: ~/.wims/server.json with hot-reload
- [x] 09-02: Config migration and validation

### Phase 10: Frictionless Setup
**Goal**: One-command install/start using uv
**Plans**: 2 plans

Plans:
- [x] 10-01: setup.sh and start.sh scripts
- [x] 10-02: uv package manager integration

### Phase 11: Client Updates
**Goal**: Stateless Extension and Watchers
**Plans**: 2 plans

Plans:
- [x] 11-01: Extension API key support
- [x] 11-02: Watcher API key support

</details>

<details>
<summary>✅ v1.3 UI/API Integration & Verification (Phases 12-14) - SHIPPED 2026-02-12</summary>

### Phase 12: UI/API Connectivity
**Goal**: Fix CORS and schema blocking issues
**Plans**: 1 plan

Plans:
- [x] 12-01: CORS/auth regression tests and Vite proxy

### Phase 13: Test Infrastructure Setup
**Goal**: Playwright integration test framework
**Plans**: 2 plans

Plans:
- [x] 13-01: Playwright install with auto-launch FastAPI
- [x] 13-02: Test fixtures for auth and database isolation

### Phase 14: Core Integration Tests
**Goal**: Verify ingest → search → display pipeline
**Plans**: 1 plan

Plans:
- [x] 14-01: Authenticated search flow and error handling tests

</details>

### v1.4 Search & Browse UX Polish (In Progress)

**Milestone Goal:** Transform WIMS from "it works" to "it's actually useful" by improving search quality and adding flexible browsing capabilities.

#### Phase 15: Source Filtering
**Goal**: Users can filter search results by data source
**Depends on**: Phase 14
**Requirements**: FILT-01, FILT-02, FILT-03
**Success Criteria** (what must be TRUE):
  1. User can select one or more platforms using checkboxes and see filtered results
  2. User can share a search with filters via URL (filter state persists in query parameters)
  3. User can apply quick filter presets with one click (e.g., "Web Chats Only", "Dev Sessions Only")
  4. User sees result counts update in real-time as filters are applied
**Plans**: 4 plans

Plans:
- [x] 15-01-PLAN.md — Backend platform filtering (schema + endpoint + backend tests)
- [x] 15-02-PLAN.md — URL state management (React Router + API integration)
- [x] 15-03-PLAN.md — Filter UI components and E2E tests
- [x] 15-04-PLAN.md — Gap closure: fix useSearch bug, align platform names, add preset buttons

#### Phase 16: Claude Code Path Display
**Goal**: Users see file paths for Claude Code conversations instead of broken "Open" links
**Depends on**: Phase 14 (independent of Phase 15)
**Requirements**: PATH-01, PATH-02, PATH-03, PATH-04
**Success Criteria** (what must be TRUE):
  1. User sees file path for Claude Code conversations in result cards
  2. User can copy file path to clipboard with one click and sees "Copied!" feedback
  3. User sees readable paths even for long file paths (truncated with ellipsis)
  4. System correctly displays both Windows (C:\...) and Unix (/...) path formats
**Plans**: 1 plan

Plans:
- [x] 16-01-PLAN.md — CopyablePath component, ResultCard update, and E2E tests

#### Phase 17: Search Relevance Improvements
**Goal**: Search returns more relevant results with better ranking
**Depends on**: Phase 14 (independent of Phases 15-16)
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. Search results use improved e5-small-v2 embedding model for better semantic matching
  2. Short fragments (e.g., "proceed", "continue") are deprioritized in search results
  3. Irrelevant results below minimum relevance threshold (0.5-0.6) are filtered out
  4. User can find content using both semantic concepts and exact keywords (hybrid search)
**Plans**: 5 plans

Plans:
- [x] 17-01-PLAN.md — Configurable embedding provider (FastEmbed + Ollama + config)
- [x] 17-02-PLAN.md — Content quality scorer and unified reranker (TDD)
- [x] 17-03-PLAN.md — Hybrid search integration and two-tier API response
- [x] 17-04-PLAN.md — Schema evolution and CLI re-embedding migration
- [x] 17-05-PLAN.md — Frontend two-tier results with collapsible secondary section

#### Phase 18: Browse Page with Timeline
**Goal**: Users can browse all conversations chronologically with flexible filters
**Depends on**: Phase 15 (reuses SourceFilter component)
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04
**Success Criteria** (what must be TRUE):
  1. User can browse all conversations in chronological order (newest first) without searching
  2. User can filter browse results by date range (Today, This Week, Custom Range)
  3. User sees grouped timeline sections (Today, Yesterday, This Week) for easy scanning
  4. Pagination works correctly even when new conversations are added (no duplicates or gaps)
**Plans**: 3 plans

Plans:
- [x] 18-01-PLAN.md -- Backend browse API endpoint with cursor pagination, date range and platform filtering
- [x] 18-02-PLAN.md -- Frontend browse infrastructure (date-fns, useBrowse hook, DateRangeFilter, TimelineSection)
- [x] 18-03-PLAN.md -- BrowsePage rewrite with timeline layout and E2E tests

## Progress

**Execution Order:**
Phases 15-16-17 can be built in parallel (independent), then Phase 18 (depends on 15).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Engine | v1.0 | 3/3 | Complete | 2026-02-07 |
| 2. Web Intelligence | v1.0 | 3/3 | Complete | 2026-02-07 |
| 3. Dev Intelligence | v1.0 | 3/3 | Complete | 2026-02-07 |
| 4. Unified Interface | v1.0 | 2/2 | Complete | 2026-02-07 |
| 5. Security Core | v1.1 | 3/3 | Complete | 2026-02-07 |
| 6. Quality Infrastructure | v1.1 | 2/2 | Complete | 2026-02-07 |
| 7. Client Hardening | v1.1 | 3/3 | Complete | 2026-02-07 |
| 8. API Key Authentication | v1.2 | 2/2 | Complete | 2026-02-11 |
| 9. Unified Configuration | v1.2 | 2/2 | Complete | 2026-02-11 |
| 10. Frictionless Setup | v1.2 | 2/2 | Complete | 2026-02-11 |
| 11. Client Updates | v1.2 | 2/2 | Complete | 2026-02-11 |
| 12. UI/API Connectivity | v1.3 | 1/1 | Complete | 2026-02-12 |
| 13. Test Infrastructure Setup | v1.3 | 2/2 | Complete | 2026-02-12 |
| 14. Core Integration Tests | v1.3 | 1/1 | Complete | 2026-02-12 |
| 15. Source Filtering | v1.4 | 4/4 | Complete | 2026-02-13 |
| 16. Claude Code Path Display | v1.4 | 1/1 | Complete | 2026-02-13 |
| 17. Search Relevance Improvements | v1.4 | 5/5 | Complete | 2026-02-13 |
| 18. Browse Page with Timeline | v1.4 | 3/3 | Complete | 2026-02-14 |

### Phase 19: Embedding Model Upgrade & DB Maintenance

**Goal:** Upgrade embedding model to bge-m3 with multiple backend support (sentence-transformers, ONNX, OpenAI-compatible API), add periodic LanceDB compaction, and improve migration system for reusable model transitions
**Depends on:** Phase 18
**Requirements**: EMB-01, EMB-02, EMB-03, EMB-04, EMB-05, EMB-06
**Success Criteria** (what must be TRUE):
  1. New embedding providers (SentenceTransformerProvider, OnnxProvider) can load bge-m3 from HuggingFace with unit tests
  2. External API provider abstracted as ExternalAPIProvider base with OpenAICompatibleProvider implementation (replacing OllamaProvider)
  3. LanceDB periodic compaction runs safely with concurrency guards (no duplicate compactions)
  4. Migration system is reusable: promotes v2→v1 after completion (not v3/v4/v5 increments)
  5. Default embedding model upgraded from bge-small-en-v1.5 to bge-m3
  6. Re-embedding CLI supports rate limiting via --delay flag for remote API providers
**Plans:** 3 plans

Plans:
- [ ] 19-01-PLAN.md — Multi-backend embedding providers (SentenceTransformer, ONNX, OpenAI-compatible)
- [ ] 19-02-PLAN.md — LanceDB compaction manager and migration auto-promotion
- [ ] 19-03-PLAN.md — Default model upgrade to bge-m3 and final integration
