# Architecture Research

**Domain:** AI Conversation Search & Browse UX Enhancements
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

This architecture research identifies integration points for adding source filtering, path display with copy functionality, search relevance improvements, and browse page features to the existing FastAPI/React/LanceDB conversation search application.

**Key Finding:** The existing architecture is well-suited for incremental enhancement. All four features integrate cleanly through:
- Backend: Extend existing `/search` endpoint with query parameters, minimal schema changes
- Frontend: New components that compose with existing SearchBar/ResultCard patterns
- Data Model: No schema changes required - all metadata already present in LanceDB

**Build Strategy:** Features are independent and can be built in parallel or sequentially. Recommended order based on dependencies:
1. Source filtering (foundation for browse page filtering)
2. Path display with copy (standalone UI enhancement)
3. Search relevance (algorithm improvement, no UI changes)
4. Browse page (combines filtering + infinite scroll patterns)

## Current Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer (React)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │SearchBar │  │ResultCard│  │  State   │  │Infinite  │    │
│  │          │  │          │  │Management│  │ Scroll   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
├───────┴─────────────┴─────────────┴─────────────┴───────────┤
│                     API Client (Axios)                       │
│                  TanStack Query Caching                      │
├─────────────────────────────────────────────────────────────┤
│                     Backend Layer (FastAPI)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │          API Router (/api/v1)                       │    │
│  │  /ingest (POST) │ /search (POST) │ /health (GET)   │    │
│  └────────┬────────────────┬────────────────┬─────────┘    │
│           │                │                │               │
│  ┌────────▼────────┐  ┌───▼──────────┐  ┌─▼──────────┐    │
│  │ Embedding       │  │Search Logic  │  │Auth Guard  │    │
│  │ Service         │  │(Vector Query)│  │(API Key)   │    │
│  │(FastEmbed)      │  │              │  │            │    │
│  └────────┬────────┘  └───┬──────────┘  └────────────┘    │
│           │               │                                 │
├───────────┴───────────────┴─────────────────────────────────┤
│                     Data Layer (LanceDB)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Messages Table                                      │   │
│  │  - id, conversation_id, platform, title, content    │   │
│  │  - role, timestamp, url, vector (384d)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Existing Data Flow

```
User Search Query
    ↓
SearchBar (debounce 300ms)
    ↓
TanStack useInfiniteQuery
    ↓
Axios POST /search {query, limit, offset}
    ↓
FastAPI /search endpoint
    ↓
EmbeddingService.embed_text(query) → vector
    ↓
LanceDB.search(vector).limit(50).offset(0)
    ↓
Transform: DB → SearchResult with nested meta
    ↓
Group by conversation_id
    ↓
Response: {groups: [], count: N}
    ↓
Frontend flattens groups → results[]
    ↓
ResultCard renders with infinite scroll
```

## Integration Points for New Features

### 1. Source Filtering

**Backend Integration:**

Location: `/search` endpoint (`src/app/api/v1/endpoints/search.py`)

```python
# EXISTING SearchRequest schema
class SearchRequest(BaseModel):
    query: str
    limit: int = 50
    offset: int = 0
    conversation_id: str | None = None
    platform: str | None = None  # ← ALREADY EXISTS but unused

# MODIFY search endpoint to apply filter
@router.post("/search", response_model=SearchResponse)
async def search_documents(request: SearchRequest):
    # ... existing embedding logic ...

    search_builder = table.search(query_vector)

    # ADD: Apply platform filter if provided
    if request.platform:
        search_builder = search_builder.where(f"platform = '{request.platform}'")

    # ... rest unchanged ...
```

**Frontend Integration:**

New component: `ui/src/components/SourceFilter.tsx`

```typescript
interface SourceFilterProps {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
  availableSources: string[];  // ['claude', 'chrome', 'terminal', etc.]
}

export function SourceFilter({ selectedSources, onSourcesChange }: SourceFilterProps) {
  // Multi-select checkboxes or pills
  // On change, triggers parent state update → new search query
}
```

Integration into App.tsx:

```typescript
function SearchInterface() {
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);  // NEW

  const { data, ... } = useSearch(query, selectedSources);  // MODIFY hook

  return (
    <>
      <SearchBar onSearch={setQuery} />
      <SourceFilter
        selectedSources={selectedSources}
        onSourcesChange={setSelectedSources}  // NEW
      />
      {/* Results */}
    </>
  );
}
```

Modify `ui/src/lib/api.ts`:

```typescript
export const search = async ({
  query,
  limit = 20,
  offset = 0,
  platform = null  // NEW parameter
}: SearchParams): Promise<SearchResponse> => {
  const response = await api.post<BackendSearchResponse>('/search', {
    query,
    limit,
    offset,
    platform,  // Pass to backend
  });
  // ... rest unchanged ...
}
```

**Data Model Changes:** None (platform field already exists)

**Confidence:** HIGH - LanceDB SQL WHERE clause filtering is documented and platform field exists in schema.

### 2. Path Display with Copy Button

**Backend Integration:** None required - URL already in metadata

**Frontend Integration:**

Modify existing `ResultCard.tsx`:

```typescript
// ADD: Copy to clipboard hook
import { useState } from 'react';

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return { copied, copy };
}

export function ResultCard({ result }: ResultCardProps) {
  const { copied, copy } = useCopyToClipboard();

  // ADD: Path display section
  const displayPath = result.meta.url || result.meta.conversation_id;

  return (
    <div className="result-card">
      {/* Existing content */}

      {/* NEW: Path display with copy button */}
      {displayPath && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
          <code className="flex-1 truncate bg-gray-100 px-2 py-1 rounded">
            {displayPath}
          </code>
          <button
            onClick={() => copy(displayPath)}
            className="p-1 hover:bg-gray-200 rounded"
            title="Copy path"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Data Model Changes:** None

**Confidence:** HIGH - Clipboard API is standard, URL field exists in metadata.

### 3. Search Relevance Improvements

**Backend Integration:**

Location: `/search` endpoint with hybrid search strategy

**Option A: Metadata Boosting (Simplest)**

```python
# In search.py
async def search_documents(request: SearchRequest):
    # ... existing vector search ...

    # ADD: Boost recent results
    search_builder = search_builder.select([
        "*",
        # Recency boost: score = distance - (age_days * 0.01)
        "(_distance - ((julianday('now') - julianday(timestamp)) * 0.01)) as boosted_score"
    ])

    results_list = await run_in_threadpool(search_builder.to_list)

    # Sort by boosted_score instead of _distance
    results_list = sorted(results_list, key=lambda x: x['boosted_score'])
```

**Option B: Hybrid Search (Better Quality)**

```python
# In search.py - requires LanceDB FTS
async def search_documents(request: SearchRequest):
    # Vector search
    vector_results = table.search(query_vector).limit(100)

    # Keyword search (if FTS index exists)
    keyword_results = table.search(request.query, query_type="fts").limit(100)

    # Reciprocal Rank Fusion
    merged_results = reciprocal_rank_fusion([vector_results, keyword_results])

    # Apply offset/limit after fusion
    return merged_results[offset:offset+limit]
```

**Option C: Re-ranking Layer (Production Quality)**

```python
# New service: src/app/services/reranker.py
from fastembed import TextEmbedding, Reranker

class RerankerService:
    def __init__(self):
        self.reranker = Reranker(model_name="BAAI/bge-reranker-base")

    def rerank(self, query: str, documents: list[dict], top_k: int = 50):
        """Re-rank vector search results for better relevance."""
        doc_texts = [d['content'] for d in documents]
        scores = self.reranker.rerank(query, doc_texts)

        # Combine scores with original documents
        reranked = sorted(
            zip(documents, scores),
            key=lambda x: x[1],
            reverse=True
        )
        return [doc for doc, score in reranked[:top_k]]

# In search.py
async def search_documents(request: SearchRequest):
    # Get top 100 from vector search
    results = await vector_search(query_vector, limit=100)

    # Re-rank to top 50
    reranked = await run_in_threadpool(
        reranker_service.rerank,
        request.query,
        results,
        top_k=50
    )

    return reranked[offset:offset+request.limit]
```

**Recommended Approach:** Start with Option A (metadata boosting), upgrade to Option C (re-ranking) if relevance is insufficient.

**Frontend Integration:** None - transparent to UI

**Data Model Changes:** None

**Confidence:** MEDIUM-HIGH
- Metadata boosting: HIGH confidence (simple SQL)
- Hybrid search: MEDIUM confidence (depends on FTS index setup)
- Re-ranking: HIGH confidence (fastembed supports re-ranking models)

### 4. Browse Page (Chronological View)

**Backend Integration:**

New endpoint: `/browse` (or extend `/search` with `browse_mode` flag)

```python
# In src/app/api/v1/endpoints/search.py

class BrowseRequest(BaseModel):
    """Browse without semantic search - chronological order."""
    limit: int = 50
    offset: int = 0
    platform: str | None = None  # Filter by source
    start_date: datetime | None = None
    end_date: datetime | None = None

@router.post("/browse", response_model=SearchResponse)
async def browse_documents(request: BrowseRequest):
    """
    Browse all documents in chronological order (no vector search).
    Supports filtering by platform and date range.
    """
    table = db_client.get_table("messages")

    # Build query without vector search
    query = table.search()  # No vector = full table scan

    # Apply filters
    where_clauses = []
    if request.platform:
        where_clauses.append(f"platform = '{request.platform}'")
    if request.start_date:
        where_clauses.append(f"timestamp >= '{request.start_date.isoformat()}'")
    if request.end_date:
        where_clauses.append(f"timestamp <= '{request.end_date.isoformat()}'")

    if where_clauses:
        query = query.where(" AND ".join(where_clauses))

    # Sort by timestamp descending (most recent first)
    query = query.select(["*"]).order_by("timestamp DESC")

    # Apply pagination
    query = query.limit(request.limit).offset(request.offset)

    # Execute
    results_list = await run_in_threadpool(query.to_list)

    # Transform to SearchResult format (same as /search)
    results = transform_to_search_results(results_list)

    return SearchResponse(groups=group_by_conversation(results), count=len(results))
```

**Frontend Integration:**

New page component: `ui/src/pages/BrowsePage.tsx`

```typescript
export function BrowsePage() {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: null,
    end: null
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useBrowse({
    platform: selectedSources[0],  // Single source for now
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  return (
    <div>
      <h1>Browse All Conversations</h1>

      {/* Filter controls */}
      <SourceFilter selectedSources={selectedSources} onChange={setSelectedSources} />
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* Results with infinite scroll */}
      <div>
        {data?.pages.map(page =>
          page.results.map(result => <ResultCard key={result.id} result={result} />)
        )}
      </div>

      {/* Infinite scroll trigger */}
      {hasNextPage && <div ref={lastElementRef}>Loading...</div>}
    </div>
  );
}
```

Add to `ui/src/lib/api.ts`:

```typescript
export const browse = async ({
  platform,
  startDate,
  endDate,
  limit = 20,
  offset = 0
}: BrowseParams): Promise<SearchResponse> => {
  const response = await api.post<BackendSearchResponse>('/browse', {
    platform,
    start_date: startDate?.toISOString(),
    end_date: endDate?.toISOString(),
    limit,
    offset,
  });

  // Same transformation as search
  const results = response.data.groups.flatMap(g => g.results);
  return {
    results,
    total: response.data.count,
    has_more: offset + limit < response.data.count,
    next_offset: offset + limit,
  };
}

export const useBrowse = (params: BrowseParams) => {
  return useInfiniteQuery({
    queryKey: ['browse', params.platform, params.startDate, params.endDate],
    queryFn: async ({ pageParam = 0 }) => browse({ ...params, offset: pageParam }),
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_offset : undefined,
    initialPageParam: 0,
  });
}
```

Routing setup: Add to `ui/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SearchInterface />} />
          <Route path="/browse" element={<BrowsePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

**Performance Consideration:** For large datasets (>10K documents), browse page needs virtual scrolling:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function BrowsePage() {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data?.pages.flatMap(p => p.results).length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,  // Estimated card height
  });

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const result = allResults[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ResultCard result={result} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Data Model Changes:** None

**Confidence:** HIGH - Browse is simpler than search (no vector embedding), uses existing pagination patterns.

## Component Architecture Patterns

### Pattern 1: Filter State Management

**What:** Centralized filter state that affects query parameters

**When to use:** Source filtering, date range filtering, any faceted search

**Trade-offs:**
- Pro: Single source of truth for filters
- Pro: Easy to sync with URL query params
- Con: Props drilling if deeply nested
- Con: All components re-render on filter change

**Example:**
```typescript
// Container component owns filter state
function SearchContainer() {
  const [filters, setFilters] = useState<SearchFilters>({
    sources: [],
    dateRange: null,
  });

  const { data } = useSearch({ query, ...filters });

  return (
    <>
      <FilterPanel filters={filters} onChange={setFilters} />
      <ResultsList data={data} />
    </>
  );
}
```

**Alternative:** Use URL search params as state:

```typescript
function SearchContainer() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {
    sources: searchParams.getAll('source'),
    query: searchParams.get('q') || '',
  };

  const { data } = useSearch(filters);

  // Filters stored in URL automatically
}
```

### Pattern 2: Optimistic Copy Feedback

**What:** Immediate UI feedback before async operation completes

**When to use:** Copy to clipboard, like/favorite actions, quick state toggles

**Trade-offs:**
- Pro: Feels instant to user
- Pro: Works offline for most operations
- Con: Must handle rollback if operation fails
- Con: Can desync if multiple clients

**Example:**
```typescript
function useCopyWithFeedback() {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    setCopied(true);  // Optimistic update

    try {
      await navigator.clipboard.writeText(text);
      // Success - keep showing checkmark
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Rollback on failure
      setCopied(false);
      toast.error('Failed to copy');
    }
  };

  return { copied, copy };
}
```

### Pattern 3: Infinite Query Invalidation

**What:** Smart cache invalidation when underlying data changes

**When to use:** Real-time updates, after mutations, filter changes

**Trade-offs:**
- Pro: Always shows fresh data
- Pro: Minimal refetch (only stale pages)
- Con: Can cause scroll jump if not handled
- Con: Network overhead if invalidating too often

**Example:**
```typescript
function SearchInterface() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});

  const { data } = useInfiniteQuery({
    queryKey: ['search', query, filters],
    queryFn: ({ pageParam = 0 }) => search({ query, filters, offset: pageParam }),
  });

  // When filters change, invalidate and refetch from page 0
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['search', query] });
  }, [filters]);

  return <ResultsList data={data} />;
}
```

### Pattern 4: Virtualized Infinite Scroll

**What:** Combine virtual scrolling with infinite loading for massive datasets

**When to use:** Browse page with 10K+ items, chat history, logs

**Trade-offs:**
- Pro: Handles unlimited data without memory leak
- Pro: Maintains 60fps with 100K+ items
- Con: Complex implementation (two state machines)
- Con: Scroll restoration tricky

**Example:**
```typescript
function VirtualBrowseList() {
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['browse'],
    queryFn: ({ pageParam = 0 }) => browse({ offset: pageParam }),
  });

  const allItems = data?.pages.flatMap(p => p.results) ?? [];

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,
    overscan: 5,
  });

  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    // When scrolling past 80% of loaded items, fetch next page
    if (lastItem.index >= allItems.length - 1 && hasNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), fetchNextPage, hasNextPage]);

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const isLoaderRow = virtualRow.index > allItems.length - 1;
          const item = allItems[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div>Loading more...</div>
              ) : (
                <ResultCard result={item} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## Data Flow for New Features

### Source Filtering Flow

```
User clicks "Claude" filter
    ↓
setSelectedSources(['claude'])
    ↓
TanStack Query invalidates ['search', query]
    ↓
useInfiniteQuery re-executes with new queryKey
    ↓
POST /search { query: "hello", platform: "claude", limit: 20, offset: 0 }
    ↓
FastAPI applies .where("platform = 'claude'")
    ↓
LanceDB returns filtered results
    ↓
Frontend renders only Claude results
```

### Copy Path Flow

```
User clicks copy button
    ↓
useCopyToClipboard().copy(result.meta.url)
    ↓
navigator.clipboard.writeText(url)
    ↓
setCopied(true) → UI shows checkmark
    ↓
setTimeout 2s → setCopied(false) → UI resets to copy icon
```

### Browse Page Flow

```
User navigates to /browse
    ↓
BrowsePage mounts → useBrowse() hook
    ↓
POST /browse { limit: 50, offset: 0 }
    ↓
FastAPI: table.search().order_by("timestamp DESC")
    ↓
LanceDB returns chronological results (no vector search)
    ↓
Frontend renders with infinite scroll
    ↓
User scrolls to bottom → Intersection Observer fires
    ↓
fetchNextPage() → POST /browse { limit: 50, offset: 50 }
    ↓
Append to existing pages
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10K documents | Current architecture sufficient. Single-server FastAPI + embedded LanceDB handles well. |
| 10K-100K documents | Add browse page virtual scrolling (@tanstack/react-virtual). Consider re-ranking for relevance. Consider database indices on platform, timestamp for faster filtering. |
| 100K-1M documents | Move to LanceDB Cloud or self-hosted server mode (separate process). Add Redis cache for frequently accessed conversations. Implement hybrid search (vector + FTS) for better relevance. |
| 1M+ documents | Shard by date range or platform. Implement result caching at API layer. Consider approximate nearest neighbor (ANN) index tuning. Add pagination limits (cap at 1000 results per query). |

### Scaling Priorities

1. **First bottleneck:** Browse page scroll performance with 10K+ items
   - **Solution:** Virtual scrolling with @tanstack/react-virtual
   - **When:** Immediately if dataset > 10K items
   - **Impact:** Maintains 60fps, prevents memory bloat

2. **Second bottleneck:** LanceDB file locking with multiple writers
   - **Solution:** Move to LanceDB server mode (separate process)
   - **When:** Multiple concurrent writers (e.g., multiple ingestion sources)
   - **Impact:** Allows concurrent reads/writes

3. **Third bottleneck:** Search relevance degrades with more data
   - **Solution:** Hybrid search (vector + keyword) + re-ranking
   - **When:** User feedback indicates poor results
   - **Impact:** Better precision, slightly slower queries (100ms → 300ms)

## Anti-Patterns

### Anti-Pattern 1: Filtering in Frontend

**What people do:** Fetch all results, filter client-side with `.filter()`

**Why it's wrong:**
- Transfers unnecessary data (bandwidth waste)
- Breaks pagination (offset/limit meaningless)
- Doesn't scale beyond first page

**Do this instead:** Pass filters to backend as query parameters

```typescript
// ❌ BAD
const { data } = useSearch({ query: "hello", limit: 1000 });
const filtered = data?.results.filter(r => r.meta.source === 'claude');

// ✅ GOOD
const { data } = useSearch({ query: "hello", platform: "claude", limit: 50 });
```

### Anti-Pattern 2: Re-fetching Entire Query on Filter Change

**What people do:** Invalidate all pages when filter changes

**Why it's wrong:**
- Loses scroll position
- Wastes network fetching pages user may not scroll to
- Poor UX (flash of empty state)

**Do this instead:** Use different queryKey for each filter combination

```typescript
// ❌ BAD
const { data } = useInfiniteQuery({ queryKey: ['search'] });
useEffect(() => {
  queryClient.invalidateQueries({ queryKey: ['search'] });
}, [filters]);

// ✅ GOOD
const { data } = useInfiniteQuery({
  queryKey: ['search', query, filters],  // Filter changes = new cache entry
});
```

### Anti-Pattern 3: Rendering 10K+ Items Without Virtualization

**What people do:** Map over all loaded items in DOM

**Why it's wrong:**
- Browser struggles with >1000 DOM nodes (scroll jank)
- Memory usage grows unbounded
- Slow initial render

**Do this instead:** Use virtual scrolling for large lists

```typescript
// ❌ BAD
{data?.pages.flatMap(p => p.results).map(item => <ResultCard key={item.id} result={item} />)}

// ✅ GOOD (for >1000 items)
const virtualizer = useVirtualizer({
  count: allItems.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 150,
});
{virtualizer.getVirtualItems().map(virtualRow => <ResultCard result={allItems[virtualRow.index]} />)}
```

### Anti-Pattern 4: Copying with execCommand

**What people do:** Use deprecated `document.execCommand('copy')`

**Why it's wrong:**
- Deprecated API (may break in future browsers)
- Requires creating temporary DOM elements
- Doesn't work in all contexts (e.g., async functions)

**Do this instead:** Use Clipboard API with fallback

```typescript
// ❌ BAD
const textarea = document.createElement('textarea');
textarea.value = text;
document.body.appendChild(textarea);
textarea.select();
document.execCommand('copy');
document.body.removeChild(textarea);

// ✅ GOOD
try {
  await navigator.clipboard.writeText(text);
} catch (err) {
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
```

## Recommended Project Structure

### Backend Structure (FastAPI)

```
src/app/
├── api/
│   └── v1/
│       ├── router.py              # API router registration
│       └── endpoints/
│           ├── search.py          # MODIFY: Add platform filter, /browse endpoint
│           ├── ingest.py          # UNCHANGED
│           └── health.py          # UNCHANGED
├── core/
│   ├── config.py                  # UNCHANGED
│   ├── auth.py                    # UNCHANGED
│   └── logging.py                 # UNCHANGED
├── db/
│   └── client.py                  # UNCHANGED
├── schemas/
│   └── message.py                 # MODIFY: Add BrowseRequest, BrowseResponse
├── services/
│   ├── embedding.py               # UNCHANGED
│   └── reranker.py                # NEW: Re-ranking service (optional)
└── main.py                        # UNCHANGED
```

### Frontend Structure (React)

```
ui/src/
├── components/
│   ├── SearchBar.tsx              # UNCHANGED
│   ├── ResultCard.tsx             # MODIFY: Add path display with copy button
│   ├── SourceFilter.tsx           # NEW: Multi-select source filter
│   ├── DateRangePicker.tsx        # NEW: Date range selector (for browse)
│   └── Navigation.tsx             # NEW: Navigation between search/browse
├── pages/
│   ├── SearchPage.tsx             # EXTRACT from App.tsx
│   └── BrowsePage.tsx             # NEW: Chronological browse view
├── lib/
│   ├── api.ts                     # MODIFY: Add platform param, browse(), useBrowse()
│   └── utils.ts                   # UNCHANGED
├── hooks/
│   └── useCopyToClipboard.ts      # NEW: Copy functionality hook
├── App.tsx                        # MODIFY: Add routing, extract SearchPage
└── main.tsx                       # UNCHANGED
```

### Structure Rationale

- **components/:** Reusable UI components (SourceFilter, DateRangePicker) used by multiple pages
- **pages/:** Full page components with routing (SearchPage, BrowsePage)
- **lib/:** API client and utilities (keeps components clean)
- **hooks/:** Reusable stateful logic (useCopyToClipboard can be used in multiple components)

**Why extract SearchPage from App.tsx?**
- App.tsx becomes routing container
- SearchPage and BrowsePage are sibling routes
- Easier to share layout (Navigation component)

**Why NEW services/reranker.py optional?**
- Start simple (metadata boosting)
- Add re-ranking only if relevance is insufficient
- Follows progressive enhancement principle

## Build Order and Dependencies

### Recommended Build Order

**Phase 1: Source Filtering (Foundation)**
- Backend: Modify `/search` to use existing `platform` parameter
- Frontend: Add `SourceFilter` component
- Frontend: Pass platform to `useSearch` hook
- **Estimated effort:** 4 hours
- **Dependencies:** None
- **Blockers:** None

**Phase 2: Path Display with Copy (Standalone)**
- Frontend: Add `useCopyToClipboard` hook
- Frontend: Modify `ResultCard` to show path with copy button
- **Estimated effort:** 2 hours
- **Dependencies:** None
- **Blockers:** None

**Phase 3: Search Relevance (Algorithm)**
- Backend: Implement metadata boosting in `/search` endpoint
- (Optional) Add re-ranking service if boosting insufficient
- **Estimated effort:** 3-6 hours
- **Dependencies:** None (transparent to frontend)
- **Blockers:** None

**Phase 4: Browse Page (Combines All)**
- Backend: Add `/browse` endpoint
- Frontend: Extract `SearchPage` from `App.tsx`
- Frontend: Add routing with react-router-dom
- Frontend: Create `BrowsePage` component
- Frontend: Add `DateRangePicker` component
- Frontend: Add `Navigation` component
- Frontend: Implement `useBrowse` hook
- (Optional) Add virtual scrolling if dataset > 10K
- **Estimated effort:** 8 hours
- **Dependencies:** Reuses `SourceFilter` from Phase 1
- **Blockers:** Routing requires restructuring App.tsx

### Parallel vs Sequential

**Can be built in parallel:**
- Phase 1 (Source Filtering) + Phase 2 (Path Display)
- Phase 3 (Relevance) independent of all others

**Must be sequential:**
- Phase 4 (Browse) should come after Phase 1 (reuses SourceFilter)
- All phases can be deployed independently (no breaking changes)

### Deployment Strategy

Each phase can be deployed incrementally:

1. **Source Filtering:** Backend change is backward compatible (platform already in schema), frontend adds new UI
2. **Path Display:** Frontend-only change, no backend impact
3. **Relevance:** Backend change is transparent (same API contract)
4. **Browse Page:** New endpoint + new route (existing search unchanged)

**Recommended:** Deploy features as ready, don't wait for all four

## Integration Points Summary

| Feature | Backend Change | Frontend Change | Data Model Change | Complexity |
|---------|---------------|-----------------|-------------------|------------|
| Source Filtering | Modify `/search` to use `platform` param | Add `SourceFilter` component, modify `useSearch` hook | None (field exists) | Low |
| Path Display + Copy | None | Modify `ResultCard`, add `useCopyToClipboard` hook | None | Low |
| Search Relevance | Add boosting/re-ranking in `/search` logic | None (transparent) | None | Medium |
| Browse Page | Add `/browse` endpoint | Add routing, `BrowsePage`, `Navigation`, `useBrowse` | None | Medium-High |

## Sources

**FastAPI Query Parameters:**
- [FastAPI Query Parameters Documentation](https://fastapi.tiangolo.com/tutorial/query-params/)
- [How to Use FastAPI Query Parameters Effectively](https://oneuptime.com/blog/post/2026-02-03-fastapi-query-parameters/view)

**LanceDB Filtering:**
- [LanceDB SQL Filtering Documentation](https://lancedb.github.io/lancedb/sql/)
- [LanceDB Metadata Filtering Guide](https://lancedb.com/docs/search/filtering/)

**React Infinite Scroll with TanStack Query:**
- [TanStack Query Infinite Queries Documentation](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [Seamless infinite scrolling: TanStack Query and Intersection Observer](https://medium.com/@sanjivjangid/seamless-infinite-scrolling-tanstack-query-and-intersection-observer-c7ec8a544c83)

**Search Relevance and Re-ranking:**
- [Optimizing RAG with Hybrid Search & Reranking - Superlinked](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [Azure AI Search: Hybrid Retrieval and Reranking](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/azure-ai-search-outperforming-vector-search-with-hybrid-retrieval-and-reranking/3929167)

**Copy to Clipboard:**
- [Implementing copy-to-clipboard in React with Clipboard API](https://blog.logrocket.com/implementing-copy-clipboard-react-clipboard-api/)
- [useCopyToClipboard Hook](https://usehooks-ts.com/react-hook/use-copy-to-clipboard)

**Virtual Scrolling:**
- [Handling Large Data With Infinite Scrolling in React](https://www.ignek.com/blog/handling-large-data-with-infinite-scrolling-in-react)
- [How To Render Large Datasets In React](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react)

---
*Architecture research for: AI Conversation Search & Browse UX Enhancements*
*Researched: 2026-02-12*
