# Roadmap: Where Is My Shit (WIMS)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-02-07)
- ✅ **v1.1 Security & Hardening** - Phases 5-7 (shipped 2026-02-07)
- ✅ **v1.2 Simplify & Deploy** - Phases 8-11 (shipped 2026-02-11)
- ✅ **v1.3 UI/API Integration & Verification** - Phases 12-14 (shipped 2026-02-12)
- ✅ **v1.4 Search & Browse UX** - Phases 15-18 (shipped 2026-02-14)
- ✅ **v1.5 Embedding & Infrastructure** - Phases 19-20 (shipped 2026-02-15)
- ✅ **v1.6 GitHub Release** - Phase 21 (shipped 2026-02-18)
- ✅ **v1.7 Distribution & Packaging** - Phases 22-25 (shipped 2026-03-06)
- ✅ **v1.8 UI Polish & Convenience** - Phases 26-28 (shipped 2026-03-08)
- ✅ **v1.9 Result Context & Readability** - Phases 29-31 (shipped 2026-03-12)

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

<details>
<summary>✅ v1.4 Search & Browse UX (Phases 15-18) - SHIPPED 2026-02-14</summary>

### Phase 15: Source Filtering
**Goal**: Users can filter search results by data source
**Requirements**: FILT-01, FILT-02, FILT-03
**Plans**: 4 plans

Plans:
- [x] 15-01: Backend platform filtering
- [x] 15-02: URL state management
- [x] 15-03: Filter UI components and E2E tests
- [x] 15-04: Gap closure and preset buttons

### Phase 16: Claude Code Path Display
**Goal**: Users see file paths for Claude Code conversations
**Requirements**: PATH-01, PATH-02, PATH-03, PATH-04
**Plans**: 1 plan

Plans:
- [x] 16-01: CopyablePath component and E2E tests

### Phase 17: Search Relevance Improvements
**Goal**: Search returns more relevant results with better ranking
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Plans**: 5 plans

Plans:
- [x] 17-01: Configurable embedding provider
- [x] 17-02: Content quality scorer and unified reranker
- [x] 17-03: Hybrid search integration and two-tier API
- [x] 17-04: Schema evolution and CLI re-embedding
- [x] 17-05: Frontend two-tier results

### Phase 18: Browse Page with Timeline
**Goal**: Users can browse all conversations chronologically
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04
**Plans**: 3 plans

Plans:
- [x] 18-01: Backend browse API with cursor pagination
- [x] 18-02: Frontend browse infrastructure
- [x] 18-03: BrowsePage rewrite with timeline layout

</details>

<details>
<summary>✅ v1.5 Embedding & Infrastructure (Phases 19-20) - SHIPPED 2026-02-15</summary>

### Phase 19: Embedding Model Upgrade & DB Maintenance
**Goal**: Upgrade embedding model to bge-m3 with multiple backend support
**Requirements**: EMB-01, EMB-02, EMB-03, EMB-04, EMB-05, EMB-06
**Plans**: 3 plans

Plans:
- [x] 19-01: Multi-backend embedding providers
- [x] 19-02: LanceDB compaction manager and migration
- [x] 19-03: Default model upgrade to bge-m3

### Phase 20: Deployment Bugfixes (Retroactive)
**Goal**: Fix runtime bugs found during deployment
**Plans**: Retroactive fixes (8 fixes)

Fixes:
- [x] LanceDB compaction API mismatch
- [x] Embedding dimension mismatch auto-fallback
- [x] Schema evolution: add missing embedding_model column
- [x] "All Sources" preset toggle stuck in loop
- [x] "Search Results for X" layout shift
- [x] Initial state: all source buttons unlit
- [x] "Showing results from: ..." layout shift
- [x] Content snippet truncation

</details>

<details>
<summary>✅ v1.6 GitHub Release (Phase 21) - SHIPPED 2026-02-18</summary>

### Phase 21: Documentation for GitHub Release
**Goal**: Write user-facing documentation for open-source publication
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04
**Plans**: 3 plans

Plans:
- [x] 21-01: English README.md and LICENSE file
- [x] 21-02: Chinese README_CN.md (translation)
- [x] 21-03: docs/ reference files (CLI reference, embedding providers)

</details>

### ✅ v1.7 Distribution & Packaging (Shipped 2026-03-06)

**Milestone Goal:** Make WIMS easily installable through automated publishing of Docker images, Chrome extension, and standalone daemon installer.

#### Phase 22: Version Management & Foundation
**Goal**: Establish CalVer-based version synchronization across all distribution artifacts
**Depends on**: Phase 21
**Requirements**: VER-01, VER-02, VER-03
**Success Criteria** (what must be TRUE):
  1. pyproject.toml serves as single source of truth for version number
  2. CI validates version consistency across manifest.json, Docker labels, and git tags before publishing
  3. Git tags trigger automated publishing workflows with matching versions
**Plans**: 2 plans

Plans:
- [ ] 22-01-PLAN.md — CHANGELOG and Docker version labels
- [ ] 22-02-PLAN.md — GitHub Actions release workflow with validation

#### Phase 23: Docker Publishing
**Goal**: Auto-publish Docker images to GitHub Container Registry
**Depends on**: Phase 22
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05, DOCK-06
**Success Criteria** (what must be TRUE):
  1. User can run `docker compose up -d` to deploy WIMS server and UI
  2. Docker images work on AMD64 platform (ARM64 deferred due to space constraints)
  3. Database and config persist across container restarts via volume mounts
  4. New version tags automatically publish to GitHub Container Registry with disk optimization
  5. Images are tagged with CalVer versions (e.g., 2026.02.20, latest)
**Plans**: 2 plans

Plans:
- [x] 23-01-PLAN.md — Dockerfile variants and docker-compose template
- [x] 23-02-PLAN.md — GitHub Actions publishing workflow with disk optimization (quick-task-2)

#### Phase 24: Chrome Extension Automation
**Goal**: Auto-publish extension to Chrome Web Store on version tags
**Depends on**: Phase 22
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04
**Success Criteria** (what must be TRUE):
  1. Users can install WIMS extension directly from Chrome Web Store
  2. Extension version in manifest.json matches git tag automatically
  3. GitHub Actions publishes new versions to Web Store on extension-v* tags
  4. Privacy policy page is accessible and compliant with Web Store requirements
**Plans**: 1 plan

Plans:
- [x] 24-01-PLAN.md — Privacy policy page and Chrome Web Store publishing automation

#### Phase 25: Daemon Distribution
**Goal**: Package and distribute standalone watcher daemon without requiring git clone
**Depends on**: Phase 22
**Requirements**: DAEMON-01, DAEMON-02, DAEMON-03, DAEMON-04, DAEMON-05, DAEMON-06
**Success Criteria** (what must be TRUE):
  1. User can install watcher daemon with one-liner curl script
  2. Install script auto-installs uv if not present, then uses uv to manage dependencies
  3. Installation automatically sets up systemd (Linux) or launchd (macOS) service
  4. Daemon auto-updates when new releases are available (with user confirmation)
  5. User can cleanly uninstall daemon with provided script
**Plans**: 1 plan

Plans:
- [x] 25-01-PLAN.md — Complete daemon distribution system with install/update/uninstall scripts

### ✅ v1.9 Result Context & Readability (Shipped 2026-03-12)

**Milestone Goal:** Make search and browse results recognizable at a glance by showing conversation context instead of raw message snippets.

#### Phase 29: Conversation-level Browse
**Goal**: Group browse results by conversation instead of showing individual messages
**Plans**: 1 plan (combined with Phase 30)

Plans:
- [x] 29-01: Group messages by conversation_id, show message_count and first_user_message

#### Phase 30: Richer Result Cards
**Goal**: Show user's question as subtitle, message count badge, smarter content preview
**Plans**: 1 plan (combined with Phase 29)

Plans:
- [x] 30-01: ResultCard with first_user_message, message count badge, line-clamp adjustments

#### Phase 31: Search Result Context
**Goal**: Add conversation context to search results and highlight matching terms
**Plans**: 1 plan

Plans:
- [x] 31-01: Batch conversation context lookup, highlightText function with mark tags

### ✅ v1.8 UI Polish & Convenience (Shipped 2026-03-08)

**Milestone Goal:** Improve the user experience with better navigation between extension and web UI, conversation detail views, and usage insights.

#### Phase 26: Extension → Web UI Link
**Goal**: Connect extension popup to the web UI for search and browsing
**Depends on**: Phase 25
**Requirements**: EXTUI-01, EXTUI-02, EXTUI-03

Plans:
- [x] 26-01: Extension popup with Open WIMS button, quick search, and recent conversations

#### Phase 27: Conversation Side Panel
**Goal**: View full conversation threads without leaving search/browse results
**Depends on**: Phase 26
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04

Plans:
- [x] 27-01: Thread API endpoint and slide-in conversation panel with role indicators

#### Phase 28: Statistics Dashboard
**Goal**: Provide usage insights and capture activity metrics
**Depends on**: Phase 27
**Requirements**: STATS-01, STATS-02, STATS-03

Plans:
- [x] 28-01: Stats API endpoint and Recharts dashboard with platform/activity charts

## Progress

**Execution Order:**
Phases execute in numeric order: 26 → 27 → 28

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
| 15. Source Filtering | v1.4 | 4/4 | Complete | 2026-02-14 |
| 16. Claude Code Path Display | v1.4 | 1/1 | Complete | 2026-02-14 |
| 17. Search Relevance | v1.4 | 5/5 | Complete | 2026-02-14 |
| 18. Browse Page Timeline | v1.4 | 3/3 | Complete | 2026-02-14 |
| 19. Embedding Upgrade | v1.5 | 3/3 | Complete | 2026-02-15 |
| 20. Deployment Bugfixes | v1.5 | retroactive | Complete | 2026-02-15 |
| 21. Documentation | v1.6 | 3/3 | Complete | 2026-02-18 |
| 22. Version Management | v1.7 | 2/2 | Complete | 2026-02-19 |
| 23. Docker Publishing | v1.7 | 2/2 | Complete | 2026-02-19 |
| 24. Extension Automation | v1.7 | 1/1 | Complete | 2026-02-20 |
| 25. Daemon Distribution | v1.7 | 1/1 | Complete | 2026-02-20 |
| 26. Extension → Web UI | v1.8 | 1/1 | Complete | 2026-03-07 |
| 27. Conversation Side Panel | v1.8 | 1/1 | Complete | 2026-03-07 |
| 28. Statistics Dashboard | v1.8 | 1/1 | Complete | 2026-03-08 |
| 29. Conversation-level Browse | v1.9 | 1/1 | Complete | 2026-03-12 |
| 30. Richer Result Cards | v1.9 | 1/1 | Complete | 2026-03-12 |
| 31. Search Highlight | v1.9 | 1/1 | Complete | 2026-03-12 |
