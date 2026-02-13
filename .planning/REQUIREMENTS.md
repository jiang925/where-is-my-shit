# Requirements: Where Is My Shit (WIMS) v1.4

**Defined:** 2026-02-12
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

## v1.4 Requirements

Requirements for Search & Browse UX Polish milestone. Each maps to roadmap phases.

### Filtering

- [ ] **FILT-01**: User can filter search results by one or more platforms using checkboxes
- [ ] **FILT-02**: User can share filter selections via URL (filter state persisted in query parameters)
- [ ] **FILT-03**: User can apply quick filter presets (e.g., "Web Chats Only", "Dev Sessions Only")

### Path Display

- [ ] **PATH-01**: User sees file path for Claude Code conversations (replaces broken "Open" button)
- [ ] **PATH-02**: User can copy file path to clipboard with one click and sees "Copied!" feedback
- [ ] **PATH-03**: User sees truncated paths for long file paths (e.g., ".../path/file.txt") for readability
- [ ] **PATH-04**: System correctly handles both Windows (C:\...) and Unix (/...) path formats

### Search Relevance

- [ ] **REL-01**: System uses e5-small-v2 embedding model for improved semantic search quality
- [ ] **REL-02**: System deprioritizes short fragments in relevance scoring (without filtering them completely)
- [ ] **REL-03**: System filters results below relevance threshold (0.5-0.6 minimum similarity score)
- [ ] **REL-04**: System provides hybrid search combining semantic (vector) and keyword (BM25) matching

### Browse & Timeline

- [ ] **BROWSE-01**: User can browse all conversations in chronological order (newest first)
- [ ] **BROWSE-02**: User can filter browse results by date range (Today, This Week, Custom Range)
- [ ] **BROWSE-03**: User sees grouped timeline sections (Today, Yesterday, This Week, etc.) in browse view
- [ ] **BROWSE-04**: System provides stable pagination using cursor-based approach (prevents duplicates/gaps)

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Filtering Enhancements
- **FILT-04**: Active filter visibility with removable chips and per-filter result counts
- **FILT-05**: Filter combination validation (detect contradictory filters)

### Search Relevance Advanced
- **REL-05**: Semantic re-ranking for improved result ordering
- **REL-06**: Context-aware chunk display (expand to show surrounding messages)
- **REL-07**: Metadata boosting for recency and conversation length

### Browse & Timeline Advanced
- **BROWSE-05**: Virtual scrolling for datasets exceeding 10K conversations
- **BROWSE-06**: Advanced time filter shortcuts ("Last 7 days", "Last month")
- **BROWSE-07**: Source statistics dashboard (activity heatmaps, usage metrics)

### Content Quality
- **CONTENT-01**: Minimum content length filtering for ingestion (prevent noise at source)
- **CONTENT-02**: Conversation thread reconstruction from chunks

## Out of Scope

Explicitly excluded to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Infinite scroll for browse page | Research shows breaks bookmarking, prevents footer access, causes performance issues |
| Complex Boolean search (AND/OR/NOT operators) | Steep learning curve, semantic search already handles concept matching effectively |
| Separate reranker infrastructure (Cohere, Jina) | LanceDB has built-in LinearCombinationReranker, avoids external dependencies |
| Real-time live updates | High resource cost for marginal value in personal search tool, polling sufficient |
| Conversation export/import | Not core to "never lose a conversation" value, can be added later if needed |
| Multi-user support | Local-only tool with single API key, no collaboration features needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FILT-01 | Phase 15 | Pending |
| FILT-02 | Phase 15 | Pending |
| FILT-03 | Phase 15 | Pending |
| PATH-01 | Phase 16 | Pending |
| PATH-02 | Phase 16 | Pending |
| PATH-03 | Phase 16 | Pending |
| PATH-04 | Phase 16 | Pending |
| REL-01 | Phase 17 | Pending |
| REL-02 | Phase 17 | Pending |
| REL-03 | Phase 17 | Pending |
| REL-04 | Phase 17 | Pending |
| BROWSE-01 | Phase 18 | Pending |
| BROWSE-02 | Phase 18 | Pending |
| BROWSE-03 | Phase 18 | Pending |
| BROWSE-04 | Phase 18 | Pending |

**Coverage:**
- v1.4 requirements: 15 total
- Mapped to phases: 15 (100% coverage)
- Unmapped: 0

**Coverage by Phase:**
- Phase 15 (Source Filtering): 3 requirements (FILT-01, FILT-02, FILT-03)
- Phase 16 (Claude Code Path Display): 4 requirements (PATH-01, PATH-02, PATH-03, PATH-04)
- Phase 17 (Search Relevance Improvements): 4 requirements (REL-01, REL-02, REL-03, REL-04)
- Phase 18 (Browse Page with Timeline): 4 requirements (BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04)

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after roadmap creation - 100% coverage achieved*
