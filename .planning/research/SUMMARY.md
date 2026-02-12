# Project Research Summary

**Project:** where-is-my-shit v1.4 - Search & Browse UX Enhancements
**Domain:** AI Conversation Search Application Enhancement
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

This milestone enhances an existing FastAPI/React/LanceDB conversation search application with four interconnected features: source filtering, file path display with copy functionality, search relevance improvements, and a browse page. The research reveals that the current architecture is well-suited for incremental enhancement, requiring minimal stack additions and no schema changes.

The recommended approach prioritizes quick wins that deliver immediate user value: source filtering addresses the most common user request (filtering by platform), path display fixes broken "Open" links for Claude Code conversations, relevance improvements tackle the "0.7 scores for unrelated results" problem through hybrid search and model upgrades, and the browse page provides chronological access to all conversations. All features integrate cleanly through existing endpoints extended with optional parameters, avoiding breaking changes.

Key risks center on filter state management complexity (potential infinite loops from React state synchronization), XSS vulnerabilities from unsanitized file paths, over-optimization of search relevance with diminishing returns, pagination stability issues with concurrent data updates, and timezone handling bugs in date range filters. Mitigation strategies include URL-based state management, strict path sanitization with DOMPurify, baseline metrics before optimization, cursor-based pagination with stable secondary sorts, and UTC storage with explicit timezone conversions.

## Key Findings

### Recommended Stack

The existing stack (FastAPI 0.109.0, React 19.2.0, LanceDB 0.5.0, FastEmbed 0.2.0) requires minimal additions rather than major changes. All new capabilities leverage existing infrastructure with targeted library additions.

**Core technologies:**
- **rank-bm25 (Python)**: Hybrid search BM25 scoring — lightweight, no heavy dependencies, production-proven in RAG systems
- **fastapi-pagination**: Standardized pagination for browse page — integrates with FastAPI, includes total count, supports limit-offset and cursor patterns
- **@radix-ui/react-checkbox & @radix-ui/react-select**: Multi-select filters — already using Radix primitives, accessible, unstyled for Tailwind integration
- **date-fns**: Date formatting for browse page — tree-shakeable, 2KB core bundle, better TypeScript support than moment.js
- **intfloat/e5-small-v2 embedding model**: Upgrade from BAAI/bge-small-v1.5 — 100% Top-5 accuracy vs 84.7%, 16ms latency (fastest tested), same 384 dimensions (no schema migration)

**Critical finding:** LanceDB 0.5+ includes built-in hybrid search with LinearCombinationReranker, eliminating the need for separate reranker infrastructure. Native Clipboard API eliminates copy-to-clipboard library dependency (97%+ browser support).

### Expected Features

**Must have (table stakes):**
- Source filtering with multi-select checkboxes — 78% increase in filter usage with multi-select vs single-select (industry standard)
- Filter state visibility with removable chips — users need to see active filters at a glance
- Result count feedback — standard search UX pattern for query refinement
- Copy-to-clipboard for file paths — replaces broken "Open" links for Claude Code, one-click copy with visual feedback
- Chronological sorting (newest first) — universal standard for timeline views
- Relevance score threshold — filters noise from vector search (addresses "0.7 scores for unrelated results")
- Pagination or "Load More" — prevents infinite scroll issues (broken bookmarking, footer access)

**Should have (competitive advantage):**
- Hybrid search (semantic + keyword) — 10% higher conversion vs pure vector, combines BM25 with embeddings using RRF
- Content quality filtering — eliminates noise from short fragments ("proceed", "continue")
- Grouped timeline view — date sections (Today, Yesterday, This Week) improve scannability
- Context-aware chunk display — show surrounding messages on demand for better comprehension
- Deep link preservation — maintains working links for web-based sources (ChatGPT, Gemini)

**Defer (v2+):**
- Real-time live updates — high resource cost for marginal value in personal search tool
- Complex Boolean search — steep learning curve, semantic search already handles concept matching
- Advanced time filters — date range pickers with "last week" shortcuts (defer until usage patterns emerge)
- Conversation thread view — high complexity, requires message threading reconstruction

### Architecture Approach

The architecture follows an incremental enhancement pattern: extend existing `/search` endpoint with optional query parameters rather than creating new endpoints, compose new UI components with existing SearchBar/ResultCard patterns, and leverage TanStack Query's infinite scroll infrastructure for browse page. No schema changes required — all necessary metadata (platform, url, timestamp) already exists in LanceDB.

**Major components:**
1. **Backend extensions** — Modify `/search` to apply platform filter via LanceDB WHERE clauses, add `/browse` endpoint with chronological ordering (no vector search), implement hybrid search with LinearCombinationReranker
2. **Frontend components** — SourceFilter (multi-select checkboxes), ResultCard modification (path display with copy button), BrowsePage (timeline view with date filters), useCopyToClipboard hook (native Clipboard API)
3. **Data flow enhancements** — URL-based filter state (shareable links), TanStack Query invalidation on filter changes (fresh results), cursor-based pagination for browse stability (prevents duplicates)

**Integration pattern:** Features are independent and can be built in parallel or sequentially. Recommended order: source filtering (foundation for browse), path display (standalone), search relevance (algorithm improvement), browse page (combines filtering + pagination).

### Critical Pitfalls

1. **Filter State Management Cascade Failures** — Multiple filter combinations create exponential state complexity leading to infinite re-render loops. Filters stored in disconnected places (React state, URL params, localStorage) cause synchronization issues. **Prevention:** Use URL as single source of truth with nuqs library, debounce filter changes (300ms), validate contradictory filter combinations, use React 19 `useTransition` for non-urgent updates.

2. **Path Display XSS Vulnerabilities** — Displaying file paths without sanitization creates stored XSS vectors (CVE-2026-1866 pattern). Malicious paths like `</script><script>alert('xss')</script>` execute in browser. **Prevention:** Always use React's default escaping (`{path}` not `dangerouslySetInnerHTML`), sanitize paths on ingest, set strict CSP headers, use DOMPurify for any HTML rendering, validate paths against allowed directories.

3. **Search Relevance Over-Optimization Diminishing Returns** — Obsessive parameter tuning (15+ tunable parameters) yields 0.1% improvement while consuming weeks of effort. Re-indexing costs and increased latency offset marginal gains. **Prevention:** Establish baseline metrics before optimization, prioritize quick wins (title matching, exact phrase), implement A/B testing framework, track nDCG or MRR metrics, stop at "good enough" (top 5 results useful).

4. **Pagination Cursor Stability Failures** — Offset pagination breaks with concurrent inserts (duplicate/missing results). Float score cursors unstable due to precision issues (0.7567 vs 0.756700001). **Prevention:** Use cursor-based pagination with `(timestamp, id)` composite cursor, stable secondary sort (always include unique ID in ORDER BY), convert float scores to integers for cursor stability, HMAC-sign cursors to prevent forgery.

5. **Date Range Filter Timezone Bugs** — Frontend sends local time, backend interprets as UTC causing "missing results". DST transitions create 1-hour gaps or duplicates. **Prevention:** Always store UTC, transmit ISO 8601 format, use timezone-aware libraries (Luxon/pendulum), test DST boundaries (March 8, November 1), validate inputs to reject invalid times.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order and risk mitigation priorities:

### Phase 16: Source Filtering (Foundation)
**Rationale:** Most requested feature, lowest complexity, foundational for browse page filtering. Backend parameter already exists (`platform` in SearchRequest schema), only needs frontend UI and filter application logic.

**Delivers:** Multi-select checkbox filters for platforms (Claude Code, ChatGPT, Gemini, etc.), active filter visibility with removable chips, result count feedback per source, URL-based filter state for shareable links.

**Addresses:** Table stakes features (source filtering, filter state visibility, result count feedback from FEATURES.md)

**Avoids:** Filter state management cascade failures (Pitfall 1) by using URL-based state from start, not React state + useEffect loops. Implements nuqs for type-safe URL state management.

**Stack:** @radix-ui/react-checkbox, nuqs for URL state

**Research flag:** LOW — standard faceted search pattern, well-documented

### Phase 17: Claude Code Path Display with Copy Button (Quick Win)
**Rationale:** Fixes broken "Open" functionality for Claude Code conversations. Frontend-only change, no backend dependencies, immediate user value. Can be built in parallel with Phase 16.

**Delivers:** File path display extracted from URL field, one-click copy-to-clipboard with visual feedback (2-second "Copied!" message), handles Windows paths (`C:\Users\...`) and Unix paths correctly.

**Addresses:** Table stakes feature (copy-to-clipboard for paths from FEATURES.md)

**Avoids:** Path display XSS vulnerabilities (Pitfall 2) by using React's default escaping, never `dangerouslySetInnerHTML`. Implements strict CSP headers and DOMPurify if any HTML rendering needed. Handles clipboard permission denial gracefully with fallback.

**Stack:** Native Clipboard API (navigator.clipboard.writeText), lucide-react icons (already installed)

**Research flag:** LOW — Clipboard API well-documented, standard UX pattern

### Phase 18: Search Relevance Improvements (Algorithm Enhancement)
**Rationale:** Addresses "0.7 scores for unrelated results" problem. Transparent to frontend (same API contract), can be built in parallel with Phases 16-17. Focuses on quick wins (model upgrade, relevance threshold) before complex hybrid search.

**Delivers:** Embedding model upgrade to intfloat/e5-small-v2 (100% Top-5 accuracy, 16ms latency), relevance score threshold filter (minimum 0.5-0.6 similarity), hybrid search with LanceDB LinearCombinationReranker (optional, if model upgrade insufficient), metadata boosting for recency.

**Addresses:** Competitive advantage features (hybrid search, semantic re-ranking from FEATURES.md)

**Avoids:** Search relevance over-optimization (Pitfall 3) by establishing baseline metrics before optimization, measuring improvement with A/B testing, focusing on quick wins (model upgrade) before exotic tuning. Stops at "good enough" (users find results in top 5).

**Stack:** rank-bm25 (for hybrid search if needed), LanceDB built-in LinearCombinationReranker

**Research flag:** MEDIUM — Hybrid search well-documented, but LanceDB-specific implementation needs validation. E5 model upgrade straightforward (FastEmbed supports it).

### Phase 19: Browse Page with Chronological Timeline (Integration Phase)
**Rationale:** Combines filtering (from Phase 16) with pagination and date range filtering. More complex than other phases (routing, new page component, date pickers), should come after source filtering to reuse SourceFilter component.

**Delivers:** Chronological browse view (newest first), date range filtering with timezone handling, grouped timeline view (Today, Yesterday, This Week), cursor-based pagination for stability, virtual scrolling for large datasets (if >10K conversations).

**Addresses:** Table stakes features (chronological sorting, timestamp display, pagination from FEATURES.md), competitive advantage features (grouped timeline view, source statistics)

**Avoids:** Pagination cursor stability failures (Pitfall 4) by using cursor-based pagination with `(timestamp, id)` composite cursor, not offset pagination. Avoids timezone bugs (Pitfall 5) by storing UTC, converting to local only for display, testing DST edge cases.

**Stack:** fastapi-pagination, @radix-ui/react-select (date pickers), date-fns (formatting), react-router-dom (routing), @tanstack/react-virtual (if >10K items)

**Research flag:** MEDIUM — Browse page patterns well-documented, but pagination with LanceDB needs testing. Date range filtering with timezone handling needs DST edge case validation.

### Phase Ordering Rationale

- **Phase 16 first:** Source filtering is foundational for browse page (Phase 19) and establishes URL state management pattern used by all features. Lowest risk, highest user value.
- **Phase 17 parallel:** Path display is completely independent (frontend-only), can be built simultaneously with Phase 16 for faster delivery.
- **Phase 18 parallel:** Search relevance is transparent to frontend (same API contract), can be built while UI features (16-17) are in progress.
- **Phase 19 last:** Browse page depends on source filtering component (reuses SourceFilter from Phase 16), requires routing infrastructure (most disruptive change to App.tsx), highest complexity (pagination + date handling).

**Dependency graph:**
```
Phase 16 (Source Filtering) → Phase 19 (Browse Page) [reuses SourceFilter]
Phase 17 (Path Display) ← independent
Phase 18 (Search Relevance) ← independent
```

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 18 (Search Relevance):** Hybrid search implementation with LanceDB LinearCombinationReranker needs empirical testing. Weight tuning (0.7 vector, 0.3 BM25) requires validation with actual dataset. E5 model re-indexing performance unknown with 1000+ conversations.
- **Phase 19 (Browse Page):** Date range query optimization with LanceDB unknown — needs EXPLAIN-style analysis to verify index usage. Virtual scrolling threshold (when to enable) needs benchmarking with actual dataset size.

Phases with standard patterns (skip research-phase):
- **Phase 16 (Source Filtering):** Well-documented faceted search pattern. LanceDB SQL WHERE filtering documented. React URL state management mature with nuqs library.
- **Phase 17 (Path Display):** Clipboard API fully documented (MDN). Copy-to-clipboard UX pattern standardized. XSS prevention well-established (OWASP guidance).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended libraries verified with official docs, version compatibility checked, existing stack (FastAPI/React/LanceDB) supports new features without breaking changes |
| Features | HIGH | Feature prioritization based on industry standard UX patterns (2026), vector search documentation, established design systems (Radix UI, Flowbite). Table stakes vs competitive advantage clearly delineated |
| Architecture | HIGH | Integration points verified with FastAPI query parameters docs, LanceDB filtering docs, TanStack Query infinite queries. No schema changes required (all metadata present) |
| Pitfalls | MEDIUM-HIGH | High confidence on web security (XSS, CSP, clipboard API), medium on WIMS-specific performance (LanceDB filter performance, pagination stability needs empirical testing) |

**Overall confidence:** HIGH

Research quality indicators:
- **Synthesized, not concatenated:** Findings integrated across research files (e.g., hybrid search recommendation combines STACK.md embedding model upgrade with ARCHITECTURE.md integration pattern)
- **Opinionated:** Clear technology recommendations (e5-small-v2 over BGE, fastapi-pagination over manual pagination, Radix UI over Material-UI)
- **Actionable:** Roadmapper can structure phases directly from "Implications for Roadmap" section
- **Honest:** Confidence levels reflect actual source quality (HIGH for officially documented patterns, MEDIUM for WIMS-specific performance needing validation)

### Gaps to Address

**During Phase 16 (Source Filtering):**
- LanceDB multi-column filtering performance unknown — needs testing with compound predicates (`source='claude' AND created_at > '2026-01-01'`). Test with realistic dataset size (1000+ conversations).
- React 19 `useTransition` effectiveness for filter updates unverified — validate that marking filter state updates as non-urgent prevents UI freezing during 300ms filter queries.

**During Phase 18 (Search Relevance):**
- FastEmbed e5-small-v2 re-indexing time unknown — benchmark full re-index with existing conversation dataset to estimate downtime.
- LanceDB hybrid search weight tuning (vector vs BM25) needs empirical testing — no one-size-fits-all ratio, requires A/B testing with actual queries.
- Baseline relevance metrics undefined — establish nDCG@10 or MRR baseline before implementing any changes to measure actual improvement.

**During Phase 19 (Browse Page):**
- LanceDB date range query optimization strategy unknown — test if date range filters benefit from specific indexing (composite index on `(platform, timestamp, id)`).
- Virtual scrolling threshold unclear — benchmark browse page performance at 1K, 5K, 10K conversations to determine when @tanstack/react-virtual becomes necessary.
- DST edge case handling needs validation — add tests for March 8 (spring forward) and November 1 (fall back) 2026 dates to verify correct filtering.

**General (All Phases):**
- Deployment strategy for incremental releases unspecified — verify backend changes are backward compatible (optional parameters), frontend can be deployed independently (no breaking API changes).
- Performance monitoring approach undefined — add Prometheus metrics for filter query latency, pagination cursor performance, clipboard API success/failure rates.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [FastEmbed Supported Models](https://qdrant.github.io/fastembed/examples/Supported_Models/) — Official model list, e5-small-v2 support verified
- [LanceDB Hybrid Search Documentation](https://lancedb.com/blog/hybrid-search-combining-bm25-and-semantic-search-for-better-results-with-lan-1358038fe7e6/) — Official hybrid search guide with LinearCombinationReranker
- [Radix UI Components](https://www.radix-ui.com/) — Official component documentation, checkbox and select patterns
- [fastapi-pagination Documentation](https://uriyyo-fastapi-pagination.netlify.app/) — Library documentation with FastAPI integration

**Features Research:**
- [Search Filters: 5 best practices - Algolia](https://www.algolia.com/blog/ux/search-filter-ux-best-practices) — Industry standard filter UX patterns
- [Clipboard API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) — Browser compatibility and security requirements
- [Timeline Component Best Practices](https://www.aubergine.co/insights/a-guide-to-designing-chronological-activity-feeds) — Activity feed design patterns
- [UX: Infinite Scrolling vs. Pagination](https://uxplanet.org/ux-infinite-scrolling-vs-pagination-1030d29376f1) — Pagination pattern research

**Architecture Research:**
- [FastAPI Query Parameters Documentation](https://fastapi.tiangolo.com/tutorial/query-params/) — Official query parameter handling
- [LanceDB SQL Filtering Documentation](https://lancedb.github.io/lancedb/sql/) — WHERE clause filtering syntax
- [TanStack Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) — Official infinite scroll documentation
- [React Clipboard Implementation](https://blog.logrocket.com/implementing-copy-clipboard-react-clipboard-api/) — Modern clipboard API patterns

**Pitfalls Research:**
- [CVE-2026-1866: Path XSS Vulnerability](https://www.redpacketsecurity.com/cve-alert-cve-2026-1866-jeroenpeters1986-name-directory/) — Real-world file path XSS
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) — Authoritative XSS guidance
- [Ten Python datetime Pitfalls](https://dev.arie.bovenberg.net/blog/python-datetime-pitfalls/) — Comprehensive timezone/DST issues
- [Offset Pagination Problems](https://www.the-main-thread.com/p/quarkus-cursor-pagination-infinite-scroll) — Cursor pagination patterns

### Secondary (MEDIUM confidence)

- [Best Embedding Models for RAG 2026](https://greennode.ai/blog/best-embedding-models-for-rag) — Model comparison, e5-small-v2 benchmarks
- [Hybrid Search: BM25 + Vector](https://medium.com/codex/96-hybrid-search-combining-bm25-and-vector-search-7a93adfd3f4e) — Implementation patterns
- [Filter UX Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering) — Enterprise filtering analysis
- [Search Relevance Tuning](https://rbmsoft.com/blogs/search-relevance-tuning-for-ecommerce/) — Optimization strategies

### Tertiary (LOW confidence - needs validation)

- LanceDB filter performance with multiple predicates — no specific documentation, needs empirical testing
- FastAPI + React URL state patterns — general patterns found, WIMS-specific integration needs validation
- Virtual scrolling threshold for browse page — requires benchmarking with actual dataset

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
