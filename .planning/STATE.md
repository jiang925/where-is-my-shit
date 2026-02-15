# Project State: Where Is My Shit (WIMS)

## Project Reference

**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.
**Current Focus:** v1.6 GitHub Release - Phase 21 (Documentation)

## Current Position

**Phase:** 21 (Documentation for GitHub Release)
**Plan:** 3 of TBD (in progress)
**Status:** Phase 21 documentation in progress - CLI reference and embedding providers docs complete
**Last activity:** 2026-02-15 — Created CLI reference and embedding providers documentation (21-03)

Progress: [████████████████████] 100% (20/20 phases complete) + Phase 21 planned

## Performance Metrics

**By Milestone:**

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 MVP | 4 | Complete (2026-02-07) |
| v1.1 Security & Hardening | 3 | Complete (2026-02-07) |
| v1.2 Simplify & Deploy | 4 | Complete (2026-02-11) |
| v1.3 UI/API Integration | 3 | Complete (2026-02-12) |
| v1.4 Search & Browse UX | 4 | Complete (2026-02-14) |
| v1.5 Embedding & Infrastructure | 2 | Complete (2026-02-15) |
| v1.6 GitHub Release | 1 | Planned |

**v1.5 Progress:**
- Phase 19: Embedding Model Upgrade & DB Maintenance (3/3 plans complete) - Multi-backend providers, background compaction, auto-migration, bge-m3 default, CLI --promote
- Phase 20: Deployment Bugfixes (retroactive, complete) - 8 fixes: compaction API, dimension mismatch fallback, schema evolution, All Sources toggle, layout shifts, initial filter state, snippet truncation

**v1.6 Progress:**
- Phase 21: Documentation for GitHub Release (3+ plans in progress) - CLI reference with migration workflow, embedding providers guide with 5 providers documented

**v1.4 Progress:**
- Phase 15: Source Filtering (4/4 plans complete) - Backend multi-platform filtering, React Router URL state, Source filtering UI, gap closure complete - ALL SUCCESS CRITERIA MET
- Phase 16: Claude Code Path Display (1/1 plans complete) - File path display with copy-to-clipboard for Claude Code conversations - PHASE COMPLETE
- Phase 17: Search Relevance Improvements (5/5 plans complete) - Embedding provider abstraction, content quality scorer and unified reranker, hybrid search and reranker integration, database migration with CLI, frontend two-tier display - PHASE COMPLETE
- Phase 18: Browse Page with Timeline (3/3 plans complete) - Backend browse API, frontend browse infrastructure, BrowsePage integration with E2E tests - PHASE COMPLETE

**Phase 18 Execution Metrics:**

| Plan | Duration (s) | Tasks | Files |
|------|--------------|-------|-------|
| Phase 18-browse-timeline P01 | 256 | 2 tasks | 4 files |
| Phase 18 P02 | 91 | 2 tasks | 5 files |
| Phase 18 P03 | 140 | 2 tasks | 2 files |
| Phase 19 P02 | 227 | 2 tasks | 6 files |
| Phase 21 P03 | 104 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v1.4:

- **React Router for URL State**: Chosen for shareable filter URLs - industry standard, well-maintained, lightweight (v1.4)
- **Platforms Sorted in Query Key**: Sort platforms to ensure consistent cache keys regardless of array order (v1.4)
- **Conditional Platform Spreading**: Only include platforms in API request when non-empty array (v1.4)
- **SourceFilterUI Props-Based State**: Controlled components for predictable behavior and debugging (v1.4)
- **Platform Color Centralization**: AVAILABLE_PLATFORMS constant for consistent styling across filters and results (v1.4)
- **Search vs Browse Page Separation**: Search is query-driven, Browse is filter-driven for clear UX purpose (v1.4)
- **Empty Query Handling**: Browse page requires platform selection before showing results (no auto "show all") (v1.4)
- **Frontend-Backend Platform Alignment**: Frontend AVAILABLE_PLATFORMS must match backend ALLOWED_PLATFORMS exactly for filtering to work (v1.4)
- **Direct Platform Lookup**: Use direct ID lookup instead of substring matching for reliability and correctness (v1.4)
- **Fixed Preset Filters**: Three fixed presets only (Web Chats, Dev Sessions, All Sources) - no custom presets in v1.4 (v1.4)
- **Orange Theme for Copy Path Button**: Match claude-code platform badge colors for visual consistency (v1.4 - Phase 16)
- **Middle-Ellipsis Truncation 60/40 Split**: More weight to filename (end) than directory structure (start) for better path readability (v1.4 - Phase 16)
- **File Path Detection Logic**: Windows (C:\...), Unix (/...), and anything without :// treated as path (v1.4 - Phase 16)
- **Probe Dimensions on Init**: Both fastembed and ollama providers probe dimensions by embedding test string - flexible for any model (v1.4 - Phase 17)
- **e5 Model Prefix Support**: FastEmbedProvider auto-prefixes queries ("query: ") and documents ("passage: ") for e5 models (v1.4 - Phase 17)
- **Ollama Provider for OpenAI-Compatible Endpoints**: Single provider class supports local Ollama, remote GPU servers, and OpenAI API (v1.4 - Phase 17)
- **Default Config Backward Compatibility**: ServerConfig.embedding defaults to fastembed + bge-small-en-v1.5 (v1.4 - Phase 17)
- **Exact Full-Query Match Override**: Searching "continue" boosts "continue" fragment to quality=1.0, preventing deprioritization of intentionally searched terms (v1.4 - Phase 17)
- **Unified Reranker Architecture**: ALL ranking in one place - vector, text, quality, exact match signals fused via weighted combination, not multiple passes (v1.4 - Phase 17)
- **Min-Max Score Normalization**: Ensures vector and text scores comparable before fusion, preventing signal dominance (v1.4 - Phase 17)
- **Two-Tier Result Partitioning**: Primary (>= 0.75) and secondary (>= 0.65) thresholds for staged UI presentation (v1.4 - Phase 17)
- **Separate Vector + FTS Queries**: Execute vector and FTS searches separately then merge in reranker for better control vs native hybrid mode (v1.4 - Phase 17)
- **Expanded Candidate Limits**: Request limit * 3 or 100 candidates before reranking to give reranker enough options for signal fusion (v1.4 - Phase 17)
- **Backward Compatible Two-Tier Response**: primary groups maintain existing API, secondary_groups optional for updated frontends (v1.4 - Phase 17)
- **FTS Index Robustness**: Check and create FTS index on startup for existing tables to ensure hybrid search works (v1.4 - Phase 17)
- **Vector_v2 Column Migration Approach**: Use second vector column for zero-downtime embedding model migration, not schema replacement (v1.4 - Phase 17)
- **CLI-Driven Lazy Migration**: Users trigger re-embedding via CLI command instead of automatic background process - simpler architecture (v1.4 - Phase 17)
- **Batch Re-embedding with Delay**: Configurable batch size and inter-batch delay prevents overwhelming CPU/GPU during migration (v1.4 - Phase 17)
- **Relevance Score as Percentage**: Display relevance_score * 100 formatted as "85%" for user-friendly presentation vs raw 0.0-1.0 scores (v1.4 - Phase 17)
- **Auto-Expand Secondary Results**: When primary count is 0 but secondary results exist, auto-expand the secondary section for better UX (v1.4 - Phase 17)
- **Secondary Results Visual Differentiation**: Render secondary results with opacity-80 to indicate lower relevance without making unreadable (v1.4 - Phase 17)
- **Write Threshold Default 100**: Compaction triggers after 100 writes - balances maintenance frequency vs overhead for single-user tool (v1.5 - Phase 19)
- **Skip-Silently Concurrent Compaction**: Non-blocking lock prevents log spam and queue buildup during rapid writes (v1.5 - Phase 19)
- **Auto-Promote on Migration Complete**: Migration automatically promotes v2->v1 and drops columns when complete, making v2 reusable (v1.5 - Phase 19)
- **Background Auto-Resume Migration**: Server startup spawns daemon thread to resume incomplete migrations without blocking (v1.5 - Phase 19)
- **Multi-Backend Embedding Providers**: SentenceTransformer (PyTorch), ONNX (optional), OpenAI-compatible API - all sharing EmbeddingProvider ABC (v1.5 - Phase 19)
- **Default Model bge-m3**: Upgraded from bge-small-en-v1.5 (384d) to BAAI/bge-m3 (1024d) for better multilingual search (v1.5 - Phase 19)
- **CLI --promote Flag**: Manual promotion of v2->v1 vectors without re-embedding for recovery scenarios (v1.5 - Phase 19)
- **Dummy Vector Scan for Browse**: Use zero vector with vector search to scan all LanceDB records since no pure scan API exists (v1.4 - Phase 18)
- **Python-Side Date Filtering**: Apply date range filters in Python instead of LanceDB WHERE clause due to timestamp literal format issues (v1.4 - Phase 18)
- **Composite Cursor Pagination**: Cursor encodes both timestamp and id for stable pagination even with duplicate timestamps (v1.4 - Phase 18)
- **Base64 Cursor Encoding**: Use base64-encoded JSON for cursor to make it opaque and URL-safe (v1.4 - Phase 18)
- **date-fns for Timeline Grouping**: Use date-fns relative time functions (isToday, isYesterday, isThisWeek, isThisMonth) for automatic daily group refresh (v1.4 - Phase 18)
- **5-Bucket Timeline Structure**: Today, Yesterday, This Week, This Month, Older buckets provide clear chronological organization (v1.4 - Phase 18)
- **URL State for Date Range**: Persist date range selection in URL query params for shareable links (v1.4 - Phase 18)
- **All Time Default**: Omit 'all_time' from URL when active for cleaner default URLs (v1.4 - Phase 18)
- **Inline Section Headers**: Use inline headers instead of sticky to avoid stacking on page header (v1.4 - Phase 18)
- **ResultCard Reuse via Adapter**: Convert BrowseItem to SearchResult format to reuse existing ResultCard without modification (v1.4 - Phase 18)
- **Timeline Sections Always Render**: All 5 timeline sections render even when empty, showing "No conversations" message for consistency (v1.4 - Phase 18)
- **Empty State Setup Hint**: Show actionable guidance when no conversations exist: "Install the extension or set up a watcher" (v1.4 - Phase 18)
- **Hybrid Architecture**: Local DB for privacy/control, Cloud APIs for quality/speed (v1.0)
- **API Key Auth**: Simpler for local tools, persistent, no refresh token complexity (v1.2)
- **uv Package Manager**: Faster, robust venv handling, prevents system breakage (v1.2)

### Key Learnings from v1.3 & v1.4

- **Stateless Auth:** Removing session management significantly simplified the codebase
- **Schema Alignment Critical:** Backend and frontend must agree on response structure - nested meta object pattern provides better extensibility
- **APIRequestContext vs Page Routing:** Playwright's APIRequestContext is separate from Page - page.route interceptors don't affect API requests
- **Single Worker Mode:** Set workers: 1 to prevent LanceDB file locking conflicts
- **E2E Test Synchronization:** Waiting for search responses requires careful timing - only wait when query changes, not just filter changes
- **Navigation State Tests:** Shareable link tests must account for empty query scenarios (no search execution)
- **Platform Name Alignment Critical:** Frontend platform IDs must match backend ALLOWED_PLATFORMS exactly - no aliases or close matches accepted
- **E2E Tests Must Verify Backend Behavior:** Testing UI state alone is insufficient - must verify backend actually filters results by inspecting response data
- **useSearch Hook Bug Pattern:** Accepting a parameter in a custom hook doesn't guarantee it's used - always verify parameters are forwarded to underlying functions
- **E2E Locator Strict Mode:** Always use `.first()` when multiple results may exist in search results to avoid strict mode violations (v1.4 - Phase 16)

### Pending Todos

None yet (new milestone).

### Blockers / Concerns

None yet (new milestone).

## Session Continuity

**Last session end:** 2026-02-15
**Stopped at:** Completed 21-03-PLAN.md
**Resume file:** None
