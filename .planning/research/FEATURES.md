# Feature Research

**Domain:** AI Conversation Search & Browse Interface
**Researched:** 2026-02-12
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Source Filtering (Multi-Select)** | Standard faceted search pattern - users expect to filter by category in any search tool | MEDIUM | Checkbox-based multi-select with OR logic, show result counts per source, persist filter state. Industry standard is 78% increase in filter usage with multi-select |
| **Filter State Visibility** | Users need to see active filters at a glance | LOW | Display active filters as removable chips/tags near results, with "Clear All" option. Critical for mobile where filters may be hidden in drawer |
| **Result Count Feedback** | Users expect to know result quantity | LOW | Display total results and per-filter counts. Provides feedback on filter effectiveness and helps users decide if query needs refinement |
| **Copy-to-Clipboard for Paths** | Standard UX pattern for file paths and code snippets | LOW | One-click copy with visual "Copied!" feedback (2-3 second display). Modern Clipboard API is standard across all browsers in 2026 |
| **Chronological Sorting** | Users expect "most recent first" as default in activity feeds | LOW | Reverse chronological order (newest first) is universal standard for timeline views. Option to sort oldest-first for historical exploration |
| **Timestamp Display** | Activity feeds require exact date/time for context | LOW | Display both relative time ("2 hours ago") and absolute timestamp ("2026-02-12 14:30"). Helps users identify when conversations occurred |
| **Relevance Score Threshold** | Vector search always returns k results even if irrelevant | MEDIUM | Minimum similarity threshold (e.g., 0.5 or 0.6) filters noise. Without threshold, search returns "closest match" regardless of actual relevance |
| **Pagination or Load More** | Goal-oriented search requires navigable results | LOW | Pagination preferred over infinite scroll for search results. "Load More" button is acceptable middle ground. Infinite scroll breaks bookmarking and footer access |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Hybrid Search (Semantic + Keyword)** | 10% higher conversion vs pure vector search. Combines semantic understanding with exact match precision | HIGH | BM25 text search + vector embeddings with RRF (Reciprocal Rank Fusion). Elasticsearch/OpenSearch pattern is industry standard for 2026 |
| **Content Quality Filtering** | Eliminates noise from short fragments ("proceed", "continue") that dilute search quality | MEDIUM | Filter chunks below minimum character/sentence thresholds. Research shows tiny chunks dilute retrieval quality by returning fragments instead of meaningful content |
| **Semantic Re-Ranking** | Fine-tunes vector search results for better precision | MEDIUM | Vector search as coarse filter, semantic re-ranker as fine-tuner. Reduces noise before final presentation. Azure AI Search pattern |
| **Metrics-Based Boosting** | Boost results by recency, conversation length, or source priority | MEDIUM | Combine semantic relevance with business logic (e.g., boost recent conversations, prioritize human messages over system prompts). "AI determines relevance, metrics determine value" |
| **Context-Aware Chunk Display** | Show surrounding context (±2 messages) for better comprehension | MEDIUM | Expand chunks on demand to show conversation flow. Makes sense of isolated matches. Improves usefulness of search results |
| **Grouped Timeline View** | Group conversations by date sections (Today, Yesterday, This Week, This Month) | LOW | Standard pattern for activity feeds and email clients. Improves scannability and navigation of chronological data |
| **Source Statistics in Browse** | Show per-source activity metrics (messages per day, total conversations) | LOW | Provides insight into usage patterns. Helps users understand their conversation distribution across tools |
| **Deep Link Preservation** | Maintain working deep links for web-based sources (ChatGPT, Gemini, Perplexity) | LOW | Already implemented for some sources. Differentiates from tools that only show content without original context |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-Time Live Updates** | Feels modern and responsive | Adds complexity (WebSocket/polling), high resource cost for marginal value in personal search tool | Manual refresh or periodic background sync (every 5-10 minutes) |
| **Infinite Scroll for Search** | Popular on social media | Breaks bookmarking, can't return to specific result, poor for goal-oriented search (usability research shows negative impact) | Pagination or "Load More" button with state preservation |
| **Complex Boolean Search (AND/OR/NOT)** | Power users request advanced query syntax | Steep learning curve, most users never learn it, semantic search already handles concept matching | Natural language queries with semantic understanding |
| **Score Display to Users** | Transparency seems good | Similarity scores (0.0-1.0) mean nothing to users, creates confusion rather than clarity | Use threshold internally, show results as "relevant" or hide them |
| **Per-Query Source Selection** | Seems convenient to filter while typing | Creates decision fatigue, slows down search flow, requires more UI space | Persistent filter state that applies across searches (standard faceted search pattern) |

## Feature Dependencies

```
[Source Filtering]
    └──requires──> [Source Metadata in Index]

[Relevance Score Threshold]
    └──requires──> [Vector Search Implementation]

[Hybrid Search]
    └──requires──> [Vector Search Implementation]
    └──requires──> [Full-Text Index (BM25)]

[Content Quality Filtering]
    └──requires──> [Chunk Metadata (length, sentence count)]

[Semantic Re-Ranking]
    └──requires──> [Vector Search Implementation]
    └──enhances──> [Hybrid Search]

[Metrics-Based Boosting]
    └──requires──> [Conversation Metadata (timestamp, length, source)]
    └──enhances──> [Hybrid Search or Semantic Re-Ranking]

[Context-Aware Chunk Display]
    └──requires──> [Message Adjacency Data]
    └──requires──> [Conversation Thread Structure]

[Grouped Timeline View]
    └──requires──> [Timestamp Metadata]

[Deep Link Preservation]
    └──requires──> [Source-Specific URL Schemas]
```

### Dependency Notes

- **Source Filtering requires Source Metadata:** Each indexed chunk needs source identifier (ChatGPT, Claude Code, Gemini, etc.). Already exists in current implementation.
- **Relevance Threshold requires Vector Search:** Threshold filtering only makes sense with similarity scores from vector search. Already exists in current implementation.
- **Hybrid Search requires Both Indexes:** Needs both vector embeddings and traditional full-text index (BM25). Significant infrastructure addition.
- **Content Quality Filtering requires Chunk Metadata:** Need to track chunk length and sentence count during ingestion. Minimal schema change.
- **Semantic Re-Ranking enhances Hybrid Search:** Can be applied to any result set (pure vector or hybrid). Works better with hybrid results.
- **Metrics-Based Boosting requires Conversation Metadata:** Needs timestamp, message count, source type. Most already exists in current schema.
- **Context-Aware Display requires Thread Structure:** Need to reconstruct conversation flow from chunks. Requires storing message adjacency/ordering.
- **Grouped Timeline requires Timestamps:** Already exists in current implementation.
- **Deep Links require Source-Specific Logic:** Each source has different URL format. Already working for ChatGPT, needs path-based fallback for file sources.

## MVP Definition

### Launch With (v1 - This Milestone)

Minimum viable product — what's needed to validate the concept.

- [x] **Source Filtering (Multi-Select Checkboxes)** — Core user request, table stakes for any search interface with multiple sources. Low complexity, high user value.
- [x] **Filter State Visibility (Active Filter Chips)** — Required companion to filtering. Users need to see what filters are active.
- [x] **Result Count Feedback** — Low effort, high clarity. Standard search UX pattern.
- [x] **Relevance Score Threshold** — Critical for noise reduction. Prevents irrelevant results from appearing. Addresses "0.7 scores for unrelated results" problem.
- [x] **File Path Display with Copy Button** — Replaces broken "Open" links for Claude Code. Low complexity, high user value.
- [x] **Basic Timeline/Browse View** — Chronological display of all conversations. Addresses "no browse mode" problem.
- [x] **Timestamp Display** — Required for timeline view. Low complexity, table stakes.
- [x] **Pagination or Load More** — Standard search UX, prevents infinite scroll problems.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Content Quality Filtering** — Removes noise from short fragments. Medium complexity. Triggers: User feedback about "proceed"/"continue" pollution.
- [ ] **Grouped Timeline View** — Improves scannability of timeline. Low complexity enhancement to basic timeline. Triggers: Timeline view shows value.
- [ ] **Metrics-Based Boosting (Recency)** — Boost recent conversations in search results. Medium complexity. Triggers: Users report wanting recent conversations surfaced.
- [ ] **Context-Aware Chunk Display** — Show surrounding messages on demand. Medium complexity. Triggers: Users want more context around search matches.
- [ ] **Source Statistics in Browse** — Activity metrics per source. Low complexity. Triggers: Users explore browse view regularly.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Hybrid Search (Semantic + Keyword)** — High complexity, significant infrastructure change. Triggers: User feedback shows pure semantic search misses important exact-match queries.
- [ ] **Semantic Re-Ranking** — Requires hybrid search or standalone model. High complexity. Triggers: Search quality issues persist after threshold filtering.
- [ ] **Advanced Time Filters** — Date range pickers, "last week" shortcuts. Medium complexity. Triggers: Users frequently browse specific time periods.
- [ ] **Source Priority Preferences** — User-configurable boost per source. Low complexity. Triggers: Users express clear source preferences in usage patterns.
- [ ] **Conversation Thread View** — Full conversation reconstruction with message threading. High complexity. Triggers: Users want to see full conversation context regularly.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Source Filtering (Multi-Select) | HIGH | MEDIUM | P1 |
| Filter State Visibility | HIGH | LOW | P1 |
| Result Count Feedback | MEDIUM | LOW | P1 |
| Relevance Score Threshold | HIGH | MEDIUM | P1 |
| File Path Display + Copy | HIGH | LOW | P1 |
| Basic Timeline/Browse View | HIGH | LOW | P1 |
| Timestamp Display | HIGH | LOW | P1 |
| Pagination/Load More | HIGH | LOW | P1 |
| Content Quality Filtering | MEDIUM | MEDIUM | P2 |
| Grouped Timeline View | MEDIUM | LOW | P2 |
| Metrics-Based Boosting | MEDIUM | MEDIUM | P2 |
| Context-Aware Chunk Display | MEDIUM | MEDIUM | P2 |
| Source Statistics | LOW | LOW | P2 |
| Hybrid Search | HIGH | HIGH | P3 |
| Semantic Re-Ranking | MEDIUM | HIGH | P3 |
| Advanced Time Filters | MEDIUM | MEDIUM | P3 |
| Source Priority Preferences | LOW | LOW | P3 |
| Conversation Thread View | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (this milestone)
- P2: Should have, add when possible (v1.x iterations)
- P3: Nice to have, future consideration (v2+)

## Pattern References

### Source Filtering Best Practices

**Multi-Select Pattern (Standard 2026):**
- Checkbox-based facets with OR logic (selecting multiple sources shows results from ANY selected source)
- Display result count per source: "ChatGPT (42)", "Claude Code (18)"
- Mobile-optimized: collapsible drawer with "Apply" button (batch filtering)
- Desktop: instant filter application on checkbox change
- Show active filters as removable chips above results
- "Clear All" button visible when any filters active
- Research shows 78% increase in filter usage with multi-select vs single-select

**Implementation Pattern (2026 Standard):**
```typescript
// Filter state management
const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

// Query construction
const filteredResults = results.filter(result =>
  activeFilters.size === 0 || activeFilters.has(result.source)
);

// Result counts per source
const sourceCounts = computeSourceCounts(allResults);
```

### Copy-to-Clipboard UX Pattern

**Modern Standard (2026):**
- Icon + text label ("Copy" or copy icon) for 89% faster recognition
- Click triggers Async Clipboard API (industry standard)
- Visual feedback: "Copied!" message for 2-3 seconds
- Position: Top-right of code block or path display (desktop), full-width button (mobile)
- Accessibility: `aria-label="Copy file path to clipboard"`, `aria-live="polite"` for success announcement
- State management: button shows "Copied!" then reverts to "Copy"

**Implementation Pattern:**
```typescript
async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
  showFeedback("Copied!", 2500); // 2.5 second display
}
```

### Timeline/Browse View Pattern

**Activity Feed Standard (2026):**
- Reverse chronological order (newest first) as default
- Timestamps: relative + absolute ("2 hours ago" + "2026-02-12 14:30")
- Visual connectors: vertical line linking timeline items
- Grouped by date sections: "Today", "Yesterday", "This Week", "This Month", "Older"
- Preview text: First 100-200 characters of content
- Click to expand full conversation or jump to search with context

**Implementation Pattern:**
```typescript
interface TimelineItem {
  id: string;
  timestamp: Date;
  source: string;
  preview: string;
  fullContent: string;
  deepLink?: string;
}

// Group by date sections
function groupByDate(items: TimelineItem[]): GroupedTimeline {
  const now = new Date();
  return {
    today: items.filter(isToday),
    yesterday: items.filter(isYesterday),
    thisWeek: items.filter(isThisWeek),
    thisMonth: items.filter(isThisMonth),
    older: items.filter(isOlder)
  };
}
```

### Relevance Score Threshold Pattern

**Vector Search Filtering (2026 Best Practice):**
- Minimum similarity threshold: 0.5-0.6 for general search, 0.7-0.8 for high-precision
- Combine with k limit: "Return up to 50 results, but only if score > 0.6"
- Pre-filtering vs post-filtering trade-off:
  - Pre-filtering: Apply threshold during vector search (slower, guaranteed relevant)
  - Post-filtering: Apply threshold to top-k results (faster, may return fewer than k)
- Radial search: Alternative pattern retrieves all results above threshold (no k limit)
- User-facing: Don't show scores to users, use threshold internally

**Implementation Pattern:**
```typescript
// Post-filtering approach (recommended for performance)
const topK = await vectorSearch(query, k=100);
const filtered = topK.filter(result => result.score >= threshold);

// Radial search approach (when you need all matches above threshold)
const allRelevant = await radialSearch(query, minScore=0.6);
```

### Content Quality Filtering Pattern

**Semantic Chunking (2026 Standard):**
- Minimum chunk size: 3 sentences or 100-150 characters
- Filter out fragments: "Proceed", "Continue", "Yes, I understand"
- Semantic coherence: Each chunk should make sense without surrounding context
- Chunk size optimization: 256-512 tokens balances granularity with context
- Quality rule: "If it makes sense to a human standalone, it makes sense to the model"

**Implementation Pattern:**
```typescript
interface ChunkMetadata {
  text: string;
  sentenceCount: number;
  charCount: number;
  semanticScore: number; // Coherence metric
}

function filterLowQualityChunks(chunks: ChunkMetadata[]): ChunkMetadata[] {
  return chunks.filter(chunk =>
    chunk.sentenceCount >= 3 &&
    chunk.charCount >= 100 &&
    !isBoilerplate(chunk.text) // Filter "proceed", "continue", etc.
  );
}
```

## Competitor Feature Analysis

| Feature | GitHub Search | Slack Search | Gmail Search | Our Approach |
|---------|---------------|--------------|--------------|--------------|
| **Source Filtering** | Repository filters, language filters, path filters | Channel/DM filters, user filters | Label filters, sender filters | Source type filters (ChatGPT, Claude Code, etc.) with multi-select checkboxes |
| **File Path Display** | Full path with breadcrumbs, click to navigate, copy icon | N/A (messages not file-based) | N/A | Full path display with one-click copy button, no navigation (files may not exist locally) |
| **Timeline/Browse** | Recent activity feed, contribution graph | No pure timeline view (always search-based) | Chronological inbox view, grouped by date | Reverse chronological with date groupings (Today, Yesterday, etc.) |
| **Relevance Boosting** | Code-specific ranking (function names, comments), exact match boost | Recency bias, channel activity weight | Smart Reply signals, importance markers | Semantic search with recency boost and content quality filtering |
| **Search Thresholds** | Minimum match score (internal), spelling correction | Fuzzy matching with confidence threshold | Smart suggestions below result quality threshold | Similarity score threshold (0.5-0.6) to filter noise |

## Sources

### Search Interface Filtering
- [Search Filters: 5 best practices for a great UX - Algolia](https://www.algolia.com/blog/ux/search-filter-ux-best-practices)
- [6 Essential Search UX Best Practices for 2026 - DesignRush](https://www.designrush.com/best-designs/websites/trends/search-ux-best-practices)
- [Filter UX Design Patterns & Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)
- [15 Filter UI Patterns That Actually Work in 2025 - BricxLabs](https://bricxlabs.com/blogs/universal-search-and-filters-ui)
- [PatternFly Filters - Design Guidelines](https://www.patternfly.org/patterns/filters/design-guidelines/)

### Copy-to-Clipboard UX
- [UI Copy: UX Guidelines for Command Names - Nielsen Norman Group](https://www.nngroup.com/articles/ui-copy/)
- [Copy to Clipboard Success Message: CSS, UX, and Best Practices for 2026](https://copyprogramming.com/howto/display-success-message-after-copying-url-to-clipboard)
- [76 SaaS Copy to clipboard UI Design Examples - SaaSFrame](https://www.saasframe.io/patterns/copy-to-clipboard)
- [How to build a copy code snippet button - whitep4nth3r](https://whitep4nth3r.com/blog/how-to-build-a-copy-code-snippet-button/)
- [PatternFly Clipboard Copy Component](https://www.patternfly.org/components/clipboard-copy/)

### Search Relevance & Semantic Search
- [Boosting search relevance: Automatic semantic enrichment - AWS](https://aws.amazon.com/blogs/big-data/boosting-search-relevance-automatic-semantic-enrichment-in-amazon-opensearch-serverless/)
- [Search relevance tuning: Balancing keyword and semantic search - Elasticsearch Labs](https://www.elastic.co/search-labs/blog/search-relevance-tuning-in-semantic-search)
- [Semantic ranking - Azure AI Search](https://learn.microsoft.com/en-us/azure/search/semantic-search-overview)
- [Metrics-Based Boosting in the AI Search Era - FindTuner](https://findtuner.com/metrics-based-boosting-in-the-ai-search-era/)

### Vector Search Filtering & Thresholds
- [A Complete Guide to Filtering in Vector Search - Qdrant](https://qdrant.tech/articles/vector-search-filtering/)
- [Vector search filtering: Keep it relevant - Elasticsearch Labs](https://www.elastic.co/search-labs/blog/vector-search-filtering)
- [The Missing WHERE Clause in Vector Search - Pinecone](https://www.pinecone.io/learn/vector-search-filtering/)
- [Understanding vector radial search in OpenSearch](https://opensearch.org/blog/vector-radial-search/)
- [Vector Relevance and Ranking - Azure AI Search](https://learn.microsoft.com/en-us/azure/search/vector-search-ranking)

### Timeline & Browse Patterns
- [Learn How to Design Chronological Activity Feeds - Aubergine](https://www.aubergine.co/insights/a-guide-to-designing-chronological-activity-feeds)
- [Timeline Component - Material UI](https://mui.com/material-ui/react-timeline/)
- [Tailwind CSS Timeline - Flowbite](https://flowbite.com/docs/components/timeline/)
- [Timeline View of Search Results - Exabeam Documentation](https://docs.exabeam.com/en/exa-search/all/search-guide/search-results/timeline-view-of-search-results.html)

### Pagination vs Infinite Scroll
- [UX: Infinite Scrolling vs. Pagination - UX Planet](https://uxplanet.org/ux-infinite-scrolling-vs-pagination-1030d29376f1)
- [Navigating search results: pagination vs infinite scroll vs load more - Meilisearch](https://www.meilisearch.com/blog/pagination-vs-infinite-scroll-vs-load-more)
- [Pagination vs. infinite scroll: Making the right decision for UX - LogRocket](https://blog.logrocket.com/ux-design/pagination-vs-infinite-scroll-ux/)
- [Infinite Scrolling, Pagination Or "Load More" Buttons? - Smashing Magazine](https://www.smashingmagazine.com/2016/03/pagination-infinite-scrolling-load-more-buttons/)

### Content Quality & Chunking
- [Chunking Strategies for LLM Applications - Pinecone](https://www.pinecone.io/learn/chunking-strategies/)
- [A Visual Exploration of Semantic Text Chunking - Towards Data Science](https://towardsdatascience.com/a-visual-exploration-of-semantic-text-chunking-6bb46f728e30/)
- [How Semantic Chunking Leads to Superior Data Accuracy - EW Solutions](https://www.ewsolutions.com/semantic-chunking/)
- [Semantic Chunker - Chonkie Documentation](https://docs.chonkie.ai/oss/chunkers/semantic-chunker)

---
*Feature research for: AI Conversation Search & Browse Interface*
*Researched: 2026-02-12*
*Confidence: HIGH - Based on industry standard UX patterns (2026), vector search documentation, and established design systems*
