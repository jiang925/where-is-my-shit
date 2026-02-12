# Domain Pitfalls

**Domain:** Adding Search & Browse UX Features to Existing Search Application
**Researched:** 2026-02-12
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Filter State Management Cascade Failures

**What goes wrong:** Multiple filter combinations (source + date range + relevance threshold) create exponential state complexity. Filters conflict, produce zero results, or break URL sharing. Users apply filters that contradict each other without realizing, get confused by empty results, and abandon the feature.

**Why it happens:**
- Filter state stored in multiple disconnected places (React state, URL params, localStorage)
- No filter state validation when combining filters
- Cascading `useEffect` hooks trigger infinite re-render loops
- URL state and component state drift out of sync
- Filter combinations never tested (only individual filters work)

**Real-World Example (2026):**
```typescript
// WRONG - State synchronization hell
const [sourceFilter, setSourceFilter] = useState('claude');
const [dateRange, setDateRange] = useState({ start: null, end: null });
const [threshold, setThreshold] = useState(0.7);

useEffect(() => {
  // Triggers another useEffect
  updateURL({ source: sourceFilter });
}, [sourceFilter]);

useEffect(() => {
  // Triggers search, which updates URL, which triggers sourceFilter useEffect
  performSearch({ source: sourceFilter, date: dateRange });
}, [sourceFilter, dateRange]);

// Result: Infinite loop, performance degradation, unpredictable behavior
```

**Consequences:**
- Browser freezes from infinite re-render loops
- URL becomes source of truth but React state contradicts it
- Filter combinations produce zero results (user thinks system is broken)
- Back button doesn't work as expected (state not properly restored)
- Shared URLs don't preserve filter state correctly

**How to avoid:**
1. **Single source of truth:** Use URL as primary state, React state as derived state
2. **URL state library:** Use nuqs (type-safe URL state management for React) instead of manual URL manipulation
3. **Filter validation:** Detect and warn on contradictory filter combinations before sending query
4. **Progressive disclosure:** Show filters one at a time based on user intent, not all at once
5. **Debounce filter changes:** 300ms debounce on input-based filters to prevent cascading updates
6. **Use `useTransition`:** Mark filter updates as non-urgent in React 19 to prevent UI freezing

**Warning signs:**
- Browser console shows "Maximum update depth exceeded" errors
- URL changes but results don't update (or vice versa)
- Filter UI shows different state than what's in URL query params
- Zero results when filters are applied, but removing filters shows results
- Test coverage reveals filter A + filter B combination never tested

**Phase to address:** Phase 16 (Source Filtering Implementation)

**Sources:**
- [URL State Management in React (nuqs)](https://nuqs.dev/) - Type-safe search params state management
- [State Management Pitfalls in Modern UI](https://logicloom.in/state-management-gone-wrong-avoiding-common-pitfalls-in-modern-ui-development/)
- [Filter UX Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)

---

### Pitfall 2: Path Display XSS Vulnerabilities via Unsanitized File Paths

**What goes wrong:** Displaying file paths directly in HTML without sanitization creates XSS vulnerabilities. Malicious file paths like `</script><script>alert('xss')</script>` or SVG files with embedded JavaScript execute in user's browser when path is rendered.

**Why it happens:**
- File paths seem "safe" because they're from local filesystem
- Developers assume path strings don't contain executable code
- React's `dangerouslySetInnerHTML` used for syntax highlighting
- SVG preview functionality renders attacker-controlled content
- Cross-platform path handling exposes Windows path separators (`\`) vs Unix (`/`)

**Real-World CVEs (2026):**
- **CVE-2026-1866:** Salvo framework `list_html` generates file view without sanitizing filenames, leading to XSS
- **Frappe LMS:** Stored XSS via malicious image filenames executed when rendered on course pages
- **Termix File Manager:** SVG file content not sanitized before preview, allowing arbitrary JavaScript execution

**Attack Vectors:**
```typescript
// DANGEROUS - Direct path rendering
<div>Path: {message.metadata.file_path}</div>
// If file_path = "</div><script>alert('XSS')</script><div>", executes script

// DANGEROUS - Using dangerouslySetInnerHTML for paths
<div dangerouslySetInnerHTML={{ __html: filePath }} />

// DANGEROUS - SVG preview without sanitization
<img src={`data:image/svg+xml,${metadata.svg_content}`} />
```

**Consequences:**
- Stored XSS: Malicious paths in database execute when displayed
- Session hijacking: Attacker steals API keys from localStorage
- Data exfiltration: Script sends conversation data to external server
- UI defacement: Injected HTML breaks layout and confuses users

**How to avoid:**
1. **Always escape paths:** Use React's default escaping (`{path}` not `dangerouslySetInnerHTML`)
2. **Sanitize on ingest:** Validate and sanitize file paths before storing in database
3. **Content Security Policy:** Set strict CSP headers to block inline scripts
4. **Path validation:** Reject paths containing HTML tags, `<script>`, or suspicious characters
5. **Use text nodes:** Display paths in `<pre>` or `<code>` tags, never as HTML
6. **DOMPurify library:** If HTML rendering needed, sanitize with DOMPurify before display

**Warning signs:**
- File paths containing `<`, `>`, or `script` tags stored in database
- Browser DevTools shows unexpected script tags in DOM
- Content Security Policy violations in console
- Path display breaks UI layout unexpectedly
- User reports seeing JavaScript alerts on search results page

**Phase to address:** Phase 17 (Claude Code Path Display)

**Sources:**
- [CVE-2026-1866: Salvo Framework XSS](https://www.redpacketsecurity.com/cve-alert-cve-2026-1866-jeroenpeters1986-name-directory/)
- [Cross-Site Scripting Prevention (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [File Path XSS Vulnerabilities](https://cvedetails.com/vulnerability-list/opxss-1/xss.html)

---

### Pitfall 3: Search Relevance Over-Optimization Diminishing Returns

**What goes wrong:** Obsessive tweaking of search scoring weights, boosting factors, and ranking algorithms yields minimal improvement while consuming weeks of engineering time. Team keeps "tuning" parameters with no measurable user benefit.

**Why it happens:**
- No baseline metrics established before optimization (no A/B testing)
- Optimizing for outlier queries instead of common patterns
- Tweaking parameters based on gut feeling, not data
- Testing with toy datasets (10 conversations) instead of realistic scale (1000+)
- Ignoring the 80/20 rule: 80% of value from first 20% of effort

**Real-World Example (2026):**
```python
# WRONG - Over-optimized scoring with diminishing returns
def search(query, boost_title=2.5, boost_recent=1.8, boost_claude=1.3,
           decay_factor=0.95, min_score=0.68, fuzzy_threshold=0.82,
           ngram_weight=1.15, semantic_weight=2.1, ...):
    # 15+ tunable parameters, each requiring extensive testing
    # Reality: Switching from 2.5 to 2.6 title boost makes 0.1% difference
```

**Consequences:**
- Weeks spent tuning parameters for marginal gains (0.7 → 0.72 average precision)
- Re-indexing costs: Every scoring change requires full database re-index
- Increased query latency: Complex scoring algorithms slow down searches
- Breaking existing working queries: "Improvements" make common searches worse
- Technical debt: Complex scoring logic becomes unmaintainable

**How to avoid:**
1. **Establish baseline:** Measure current relevance with test queries before optimization
2. **Quick wins first:** Fix obvious issues (title matching, exact phrase matching) before exotic tuning
3. **A/B testing framework:** Compare old vs new scoring with real queries, not gut feeling
4. **Relevance metrics:** Track nDCG (normalized discounted cumulative gain) or MRR (mean reciprocal rank)
5. **User feedback:** Add "Was this helpful?" button to results, optimize for clicks not theory
6. **Hybrid search strategy:** Combine keyword search (fast, predictable) with semantic search (better recall)
7. **Stop at "good enough":** If users find what they need in top 5 results, stop optimizing

**Warning signs:**
- Pull requests with titles like "Adjust boost factor from 1.7 to 1.8"
- No measurable improvement in user-defined relevance metrics
- Team discussing "semantic density coefficients" without user validation
- Re-indexing takes hours, making iteration impossible
- Search latency increased from 50ms to 300ms after "improvements"

**Phase to address:** Phase 18 (Search Relevance Research & Implementation)

**Sources:**
- [Search Relevance Tuning for E-commerce](https://rbmsoft.com/blogs/search-relevance-tuning-for-ecommerce/)
- [SEO Mistakes That Hurt Rankings (2026)](https://webdesignerindia.medium.com/seo-mistakes-that-kill-rankings-2026-6f4fd03b2a6f)
- [State of AI Search Optimization 2026](https://www.growth-memo.com/p/state-of-ai-search-optimization-2026)

---

### Pitfall 4: Pagination Cursor Stability Failures with Float Scores

**What goes wrong:** Browse page implements offset-based pagination or cursor pagination with float relevance scores. Cursors become invalid when new results are added, float comparisons fail due to precision issues, and users see duplicate or missing results across pages.

**Why it happens:**
- Offset pagination assumes static result set (breaks when data changes)
- Cursors based on float scores (`score=0.75678`) instead of stable identifiers
- No `ORDER BY id` secondary sort for stability
- Concurrent inserts/updates shift pagination windows
- Float precision differences between database and application layer

**Real-World Example (2026 Issues):**
```sql
-- WRONG - Offset pagination breaks with inserts
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 20 OFFSET 40;
-- New conversation inserted between pages → page 3 shows duplicate from page 2

-- WRONG - Float score cursor unstable
SELECT * FROM results WHERE score < 0.7567 ORDER BY score DESC LIMIT 20;
-- Float comparison issues: 0.7567 vs 0.756700001 cause gaps
-- Ranking function returns floats → cursors not stable
```

**Consequences:**
- Users see same conversation on page 2 and page 3 (duplicate results)
- Infinite scroll skips results (missing conversations between loads)
- "Load more" button stops working after data updates
- SEO crawlers can't index all content (pagination broken for bots)
- Cursor forgery: Users manipulate cursors like `9998:4523` to scrape entire dataset

**How to avoid:**
1. **Cursor-based pagination:** Use `(timestamp, id)` composite cursor instead of offset
2. **Stable secondary sort:** Always include unique ID in ORDER BY for deterministic ordering
3. **Integer scores:** Convert float scores to integers (multiply by 1000) for cursor stability
4. **Keyset pagination:** Use `WHERE (created_at, id) > (cursor_timestamp, cursor_id)` pattern
5. **Snapshot isolation:** Use database transactions with consistent snapshot reads
6. **Cursor signing:** HMAC-sign cursors to prevent forgery and scraping

**Warning signs:**
- Bug reports: "I saw the same conversation twice when browsing"
- Pagination stops working after scrolling 5-10 pages
- Database logs show float comparison warnings
- Users share URLs with cursor parameters like `cursor=9998:4523`
- Test suite reveals different results when running pagination tests twice

**Phase to address:** Phase 19 (Browse Page with Pagination)

**Sources:**
- [Offset Pagination Is Lying to You](https://www.the-main-thread.com/p/quarkus-cursor-pagination-infinite-scroll)
- [When Infinite Scroll Meets Search](https://www.the-main-thread.com/p/quarkus-cursor-pagination-full-text-search-infinite-scroll)
- [Pagination & Infinite Scroll Performance](https://github.com/pola-rs/polars/issues/25663)

---

### Pitfall 5: Date Range Filter Timezone Bugs and DST Edge Cases

**What goes wrong:** Date range filters use local timezone without proper conversion, causing "missing results" bugs. Daylight Saving Time transitions create 1-hour gaps or duplicates. Mixing timezone-aware and timezone-naive timestamps leads to incorrect filtering.

**Why it happens:**
- Frontend sends local time, backend interprets as UTC (or vice versa)
- Database stores timestamps without timezone information
- DST transition creates "gap" (2am → 3am spring forward) or "fold" (2am ← 1am fall back)
- Python's datetime `+/-` operators don't account for DST
- Date picker UI shows local time but API expects UTC

**Real-World Bugs (2026):**
```python
# BUG - Polars date_range converts timezone-aware to UTC unexpectedly
pl.date_range(start_tz_aware, end_tz_aware)  # Uses UTC instead of original timezone

# BUG - Pandas date_range inconsistent with mixed tz-aware/naive
pd.date_range(start=tz_aware, end=tz_naive)  # Raises TypeError

# BUG - DST gap creates non-existent times
datetime(2026, 3, 8, 2, 30, tzinfo=US_Eastern)  # 2:30am doesn't exist (DST spring forward)
```

**Consequences:**
- Filter shows "no results" for valid date range
- Search results missing conversations from DST transition days
- User searches "yesterday" but gets results from 2 days ago (timezone confusion)
- Exported data has 1-hour offset from displayed times
- Different results in Chrome (local timezone) vs API (UTC)

**How to avoid:**
1. **Always store UTC:** Database timestamps always in UTC, convert to local only for display
2. **ISO 8601 format:** Use `YYYY-MM-DDTHH:mm:ss.sssZ` for all timestamp transmission
3. **Timezone-aware libraries:** Use Luxon (JS) or pendulum (Python), not built-in datetime
4. **Explicit conversions:** Always specify timezone when converting, never rely on defaults
5. **Test DST boundaries:** Add tests for March/November DST transitions
6. **Know your precision:** Milliseconds vs seconds vs days (avoid precision loss in filters)
7. **Validate inputs:** Reject invalid times created by DST gaps

**Warning signs:**
- Bug reports: "Date filter doesn't show conversations from yesterday"
- Off-by-one-hour errors in production logs
- Test failures only on specific dates (March 8, November 1)
- Browser console shows different timestamps than API response
- Users in different timezones report inconsistent search results

**Phase to address:** Phase 19 (Browse Page with Date Range Filtering)

**Sources:**
- [Ten Python datetime Pitfalls](https://dev.arie.bovenberg.net/blog/python-datetime-pitfalls/)
- [Common Timestamp Pitfalls](https://www.datetimeapp.com/learn/common-timestamp-pitfalls)
- [Metabase Timezone Troubleshooting](https://www.metabase.com/docs/latest/troubleshooting-guide/timezones)
- [Database Timestamps and Timezones](https://www.tinybird.co/blog/database-timestamps-timezones)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store filters in localStorage only | Fast prototyping, no URL complexity | Users can't share filtered searches, bookmarks don't work | Never (URL state is table stakes for search UX) |
| Client-side filtering only (no API changes) | Ship feature in 1 day | Performance degrades with >1000 results, pagination impossible | Only if dataset guaranteed <100 items forever |
| Skip clipboard API fallback | Works on modern Chrome | Breaks on Firefox, Safari, HTTP (non-HTTPS) contexts | Never (clipboard requires HTTPS + permissions) |
| Hardcode source names in filter UI | Simple implementation | Adding new source requires UI code change + deployment | Acceptable for MVP if sources are stable |
| Use offset pagination instead of cursor | Simpler SQL queries | Breaks with concurrent inserts, duplicate/missing results | Acceptable if data never changes (archive view) |
| Skip date range validation | Users can pick any dates | Queries like "start=2030, end=2020" crash backend | Never (always validate date ranges) |
| Re-index on every search parameter change | Always fresh results | 5+ second query latency, database overload | Never (use incremental updates) |
| Store relevance scores as floats | Matches embedding library output | Cursor pagination breaks, precision loss in comparisons | Acceptable if never used for pagination keys |

## Integration Gotchas

Common mistakes when adding features to existing search system.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|---------------|------------------|
| Existing search API | Add new `/search/v2` endpoint instead of extending current | Extend existing `/api/v1/search` with optional query params (`?source=claude&date_from=...`) |
| Filter state in React | Create new context for filters, duplicates existing search state | Extend existing search context with filter fields |
| Database schema | Add new `filtered_results` table to store pre-filtered data | Add indexes on filter columns (`source`, `created_at`) to existing table |
| URL query params | Invent new param names (`src`, `df`, `dt`) without checking existing | Follow existing conventions (check what params already exist) |
| Clipboard API | Use `document.execCommand('copy')` (deprecated) | Use modern Clipboard API with permissions fallback |
| Date storage | Add new `local_timestamp` column with timezone | Use existing UTC timestamps, convert in application layer |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Client-side filtering 1000+ results | Page freezes on filter change, 100% CPU usage | Server-side filtering with indexed columns | >1000 results (10k+ results = browser crash) |
| Fetching all results then paginating | 5+ second initial load, memory leak | Database-level pagination with LIMIT/OFFSET or cursors | >500 conversations in database |
| Re-embedding on every search | 300ms+ query latency, high CPU | Pre-compute embeddings on ingest, cache results | >100 searches/hour |
| No filter result caching | Same filter query hits database every time | Cache filter results for 60 seconds (Redis or in-memory) | >50 concurrent users |
| Elasticsearch terms filter >16 values | 15-20x performance degradation | Use `bool` query with `should` clauses instead of `terms` | >16 filter values selected |
| Full table scan for date ranges | 10+ second queries on large tables | Add composite index on (source, created_at, id) | >10,000 rows in table |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Path traversal in file path display | User crafts path like `../../etc/passwd`, system exposes sensitive files | Validate paths against allowed directories, use basename only for display |
| No Clipboard API permission handling | Feature breaks silently on permission denial, confuses users | Always check `navigator.permissions.query` before clipboard write |
| Unsanitized SVG in preview | Stored XSS via SVG `<script>` tags in file metadata | Use DOMPurify to sanitize SVG content, set strict CSP headers |
| Filter injection in SQL | User enters `'; DROP TABLE conversations--` in source filter | Use parameterized queries, never string concatenation for filters |
| Exposing internal IDs in cursors | Cursor like `id=9998` reveals database sequence, enables scraping | HMAC-sign cursors or use opaque tokens (UUIDs) |
| No rate limiting on browse page | Attacker scrapes entire database via pagination | Rate limit pagination requests (10 pages/minute per IP) |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hiding active filters after selection | User forgets filters applied, confused by "no results" | Show active filters prominently above results (chips/badges) |
| No filter feedback (result count) | User selects filter, doesn't know if it worked | Show "23 results with filter 'Claude Code'" immediately |
| Freezing UI during filter application | User thinks app crashed during 300ms filter query | Show loading skeleton, disable UI elements (don't freeze) |
| Complex filter combinations without guidance | User overwhelmed by 10+ filter options | Progressive disclosure: Show relevant filters based on context |
| No "Clear all filters" button | User manually unchecks 5 filters one by one | Single "Clear filters" button resets to default state |
| Clipboard copy with no visual feedback | User unsure if path copied successfully | Toast notification: "Path copied to clipboard!" |
| Date picker allows invalid ranges | User selects end date before start date, gets error | Disable invalid date selections in picker UI |
| Pagination shows page numbers without context | "Page 5 of ?" → user doesn't know how much content exists | Show "Page 5 of 23 (460 results)" for context |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Source Filtering:** Often missing "All Sources" default option — verify filter can be cleared
- [ ] **Source Filtering:** Often missing URL state persistence — verify shared URL preserves filter
- [ ] **Path Display:** Often missing Windows path handling — verify `C:\Users\...` renders correctly
- [ ] **Path Display:** Often missing clipboard permission error handling — verify fallback for denied permission
- [ ] **Clipboard API:** Often missing HTTPS requirement — verify works in production (not just localhost)
- [ ] **Search Relevance:** Often missing baseline metrics — verify improvement measured, not assumed
- [ ] **Browse Pagination:** Often missing "no more results" state — verify last page shows appropriate message
- [ ] **Date Range:** Often missing timezone conversion — verify UTC storage with local display
- [ ] **Date Range:** Often missing DST edge case handling — verify March/November dates work correctly
- [ ] **Filter Combinations:** Often missing zero-results handling — verify clear error message when no matches
- [ ] **URL State:** Often missing browser back button support — verify back/forward restores filter state
- [ ] **Performance:** Often missing database indexes — verify filter queries use indexes (EXPLAIN query)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| XSS via unsanitized paths | HIGH | 1. Immediate: Deploy CSP headers to block inline scripts<br>2. Audit: Search database for paths containing `<script>`<br>3. Sanitize: Retroactively sanitize existing paths<br>4. Fix: Add DOMPurify to all path rendering code |
| Broken pagination from offsets | MEDIUM | 1. Hotfix: Add secondary ORDER BY id for stability<br>2. Migrate: Switch to cursor-based pagination incrementally<br>3. Test: Add pagination tests for concurrent updates |
| Filter state management loops | MEDIUM | 1. Debug: Add React DevTools Profiler to identify loop source<br>2. Fix: Consolidate to single URL-based state with nuqs<br>3. Test: Add integration tests for filter combinations |
| Timezone bugs in date filters | LOW | 1. Fix: Convert all database operations to UTC<br>2. Update: Change UI to show timezone explicitly<br>3. Migrate: Add `updated_at_utc` column, backfill data |
| Clipboard API permission denial | LOW | 1. Hotfix: Add fallback to `document.execCommand('copy')`<br>2. Improve: Show permission prompt with explanation<br>3. Test: Test on HTTP localhost (permission denied) |
| Search relevance regression | MEDIUM | 1. Rollback: Revert scoring changes immediately<br>2. Measure: Establish baseline metrics before next attempt<br>3. A/B test: Deploy new scoring to 10% of users, measure impact |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Filter State Management Loops | Phase 16 (Source Filtering) | URL updates correctly, no infinite loops in React DevTools Profiler |
| Path Display XSS | Phase 17 (Path Display) | CSP headers block inline scripts, DOMPurify sanitizes all paths |
| Search Relevance Over-Optimization | Phase 18 (Search Relevance) | Baseline metrics established, A/B test shows measurable improvement |
| Pagination Cursor Stability | Phase 19 (Browse Page) | Concurrent insert test doesn't create duplicate results |
| Timezone Bugs in Date Filters | Phase 19 (Browse Page) | DST transition dates (March 8, Nov 1) return correct results |
| Clipboard API Permission Handling | Phase 17 (Path Display) | HTTP localhost shows fallback UI when permission denied |
| Filter Combination Validation | Phase 16 (Source Filtering) | Zero-results state shows helpful message, suggests removing filters |
| Database Index Performance | Phase 16-19 (All phases) | EXPLAIN shows index usage for all filter queries |

## Backward Compatibility Risks

Specific to adding features to existing working system.

### Risk 1: Breaking Existing Search Results with Relevance Changes

**What breaks:** Users have bookmarked search URLs that return specific results. New relevance algorithm changes result ordering, breaking their workflows.

**Prevention:**
- Add `v=2` version parameter to search API for new relevance
- Keep default behavior unchanged, new relevance opt-in only
- Log old vs new ranking differences, verify no major disruptions

### Risk 2: URL State Migration Breaking Shared Links

**What breaks:** Existing shared search URLs use different query param names. New filter system uses different param names, old links return 404 or incorrect results.

**Prevention:**
- Support both old and new param names during transition period
- Add redirect logic: old params → new params transparently
- Document deprecated params, show migration timeline

### Risk 3: Database Schema Changes Requiring Re-Indexing

**What breaks:** Adding indexes for filter performance requires locking table, causing downtime.

**Prevention:**
- Use `CREATE INDEX CONCURRENTLY` in PostgreSQL (no table lock)
- Schedule index creation during low-traffic periods
- Use online schema migration tools (gh-ost, pt-online-schema-change)

**Sources:**
- [Backward Compatibility Database Patterns](https://www.pingcap.com/article/database-design-patterns-for-ensuring-backward-compatibility/)
- [Schema Evolution in Kafka](https://oneuptime.com/blog/post/2026-01-21-kafka-schema-evolution/view)

## Sources

### High Confidence (Official Documentation & 2026 CVEs)

- **nuqs - Type-safe URL State Management:** https://nuqs.dev/ — React URL state library preventing filter state synchronization issues
- **CVE-2026-1866 (Path XSS):** https://www.redpacketsecurity.com/cve-alert-cve-2026-1866-jeroenpeters1986-name-directory/ — Real-world file path XSS vulnerability
- **OWASP XSS Prevention:** https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html — Authoritative XSS prevention guidance
- **Clipboard API (MDN):** https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API — Browser compatibility and security requirements
- **Pagination Performance Issues (2026):** https://www.the-main-thread.com/p/quarkus-cursor-pagination-infinite-scroll — Real-world offset pagination failures

### Medium Confidence (Industry Analysis & Best Practices)

- **Filter UX Best Practices:** https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering — Filter UI/UX patterns from enterprise analysis
- **State Management Pitfalls:** https://logicloom.in/state-management-gone-wrong-avoiding-common-pitfalls-in-modern-ui-development/ — Modern UI state management anti-patterns
- **Search Relevance Tuning:** https://rbmsoft.com/blogs/search-relevance-tuning-for-ecommerce/ — E-commerce search optimization patterns
- **Python Datetime Pitfalls:** https://dev.arie.bovenberg.net/blog/python-datetime-pitfalls/ — Comprehensive timezone and DST issue catalog
- **Timestamp Best Practices:** https://www.datetimeapp.com/learn/common-timestamp-pitfalls — Common timestamp handling mistakes

### Low Confidence (Requires Validation for WIMS Context)

- **LanceDB Filter Performance:** No specific documentation found on LanceDB filter performance with multiple predicates — needs empirical testing
- **FastAPI + React URL State Patterns:** General patterns found but WIMS-specific integration needs validation
- **Embedding Re-Indexing Costs:** FastEmbed re-indexing performance with 1000+ conversations needs benchmarking

## Additional Research Recommended for v1.4

1. **LanceDB Multi-Column Filtering Performance:** Test filter performance with compound predicates (`source='claude' AND created_at > '2026-01-01'`) — Phase 16 kickoff
2. **Clipboard API Browser Support Matrix:** Verify fallback behavior on Safari, Firefox, and HTTP contexts — Phase 17 implementation
3. **FastEmbed Re-Ranking Strategies:** Research semantic search re-ranking approaches without full re-indexing — Phase 18 research
4. **React 19 `useTransition` for Filter Updates:** Validate that marking filter state updates as non-urgent prevents UI freezing — Phase 16 implementation
5. **LanceDB Date Range Query Optimization:** Test if date range filters benefit from specific indexing strategies — Phase 19 implementation

---
*Pitfalls research for: Adding Search & Browse UX Features to Existing Search Application*
*Researched: 2026-02-12*
*Confidence: MEDIUM-HIGH (High confidence on web security, medium on WIMS-specific performance)*
