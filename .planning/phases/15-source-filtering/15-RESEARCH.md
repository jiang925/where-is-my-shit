# Phase 15: Source Filtering - Research

**Researched:** 2026-02-12
**Domain:** React filter UI with LanceDB backend filtering
**Confidence:** HIGH

## Summary

Phase 15 implements source filtering capabilities for search results. Users will be able to filter by multiple platforms (ChatGPT, Claude, Gemini, Perplexity, Claude Code), apply quick presets, and share filtered searches via URL. The backend already has a `platform` field in the SearchRequest schema, but the search endpoint doesn't currently filter by this field - it only filters by `conversation_id`. The frontend needs new filter UI components, URL query parameter synchronization, and real-time result count updates.

This is a UI enhancement phase with limited backend changes. The core challenge is designing a clean filter interface that handles multi-select, presets, and URL state without causing performance issues from excessive re-renders or API calls.

**Primary recommendation:** Implement filter state as URL query parameters using React's `useSearchParams`. This provides bookmarkable/sharable links automatically. Use debounced or explicit user action (Apply button) for triggering searches to avoid excessive API calls. For backend filtering, extend the existing LanceDB `where()` clause pattern to support multiple platforms using OR logic.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | Latest | UI framework with hooks | Project standard, built-in hooks (`useSearchParams`) |
| Vite | Latest | Build tool | Project standard, fast development |
| Tailwind CSS | 4.1.18 | Styling | Project standard, utility classes |
| @tanstack/react-query | Latest | Data fetching | Already used for `useSearch` hook |

### Additional (Needs Research)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | Installed | Icons | Already installed, used for existing icons |
| clsx, tailwind-merge | Installed | Utility for className | Already installed, used in `cn()` utility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React useSearchParams | React Router useParams | `useSearchParams` handles query params natively |
| Multiple checkboxes | Select dropdown | Checkboxes provide better UX for multi-select |
| URL query params | React Context | Query params enable shareable links automatically |

**Installation:**
```bash
# No additional dependencies needed
# React Router (for useSearchParams) should be included with Vite/React setup
# Already installed: lucide-react, clsx, tailwind-merge, @tanstack/react-query
```

## Architecture Patterns

### Recommended Test Structure
```
tests/e2e/
├── spec/
│   ├── auth-flow.spec.ts              # INTEG-02: Existing auth tests
│   ├── search-flow.spec.ts            # INTEG-01: Existing search tests
│   └── filter-flow.spec.ts            # NEW: FILT-01, FILT-02, FILT-03 tests
├── fixtures/
│   ├── auth.ts                        # Existing: apiKey, authenticatedPage
│   ├── database.ts                    # Existing: testDbPath, testMessages
│   └── testData.ts                    # NEW: Multi-platform test data fixtures
```

### Pattern 1: URL Query Parameter State Management
**What:** Use `useSearchParams` from `react-router-dom` to manage filter state
**When to use:** Filter state that should be shareable via URL
**Example:**
```typescript
import { useSearchParams } from 'react-router-dom';

function FilterSection() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current filter values from URL
  const platforms = searchParams.getAll('platform'); // Returns array: ['chatgpt', 'gemini']

  // Update filter values in URL
  const handlePlatformToggle = (platform: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (platforms.includes(platform)) {
      newParams.delete('platform', platform); // Remove one occurrence
    } else {
      newParams.append('platform', platform); // Add new value
    }
    setSearchParams(newParams);
  };

  return (
    <div className="flex gap-4">
      {AVAILABLE_PLATFORMS.map(p => (
        <label key={p}>
          <input
            type="checkbox"
            checked={platforms.includes(p)}
            onChange={() => handlePlatformToggle(p)}
          />
          {p}
        </label>
      ))}
    </div>
  );
}
```

### Pattern 2: LanceDB Multiple Platform Filtering
**What:** Use SQL-like WHERE clause with OR logic for multiple platforms
**When to use:** Backend needs to filter by multiple platform values
**Example:**
```python
# Source: Current implementation (search.py L42-43) needs extension
# Current: Single filter (conversation_id only)
if request.conversation_id:
    search_builder = search_builder.where(f"conversation_id = '{request.conversation_id}'")

# New: Multiple filter support with AND/OR logic
filters = []
if request.conversation_id:
    filters.append(f"conversation_id = '{request.conversation_id}'")
if request.platform:
    # platform is a list if multiple selected, string if single
    if isinstance(request.platform, list):
        # OR logic: platform IN ('chatgpt', 'gemini', 'claude-code')
        platform_list = "', '".join(request.platform)
        filters.append(f"platform IN ('{platform_list}')")
    else:
        filters.append(f"platform = '{request.platform}'")

# Combine all filters with AND
if filters:
    search_builder = search_builder.where(" AND ".join(filters))
```

**Important:** LanceDB WHERE clause syntax follows SQL conventions:
- `platform = 'chatgpt'` - single value
- `platform IN ('chatgpt', 'gemini')` - multiple values with OR logic
- `col1 = val1 AND col2 = val2` - combine multiple conditions

### Pattern 3: Preset Implementation with URL Sync
**What:** Predefined filter combinations stored as configuration
**When to use:** Quick filter shortcuts ("Web Chats Only", "Dev Sessions Only")
**Example:**
```typescript
// Preset definitions
const PRESETS = [
  { id: 'web-chats', name: 'Web Chats Only', platforms: ['chatgpt', 'claude', 'gemini', 'perplexity'] },
  { id: 'dev-sessions', name: 'Dev Sessions Only', platforms: ['claude-code'] },
  { id: 'all', name: 'All Sources', platforms: [] }, // Empty array = no filter
] as const;

function PresetButtons({ currentPlatforms, onApplyPreset }: Props) {
  const [searchParams] = useSearchParams();

  return (
    <div className="flex gap-2">
      {PRESETS.map(preset => {
        // Check if current state matches preset
        const isActive = !preset.platforms.length
          ? searchParams.getAll('platform').length === 0
          : JSON.stringify([...searchParams.getAll('platform')].sort()) ===
            JSON.stringify([...preset.platforms].sort());

        return (
          <button
            key={preset.id}
            className={isActive ? 'bg-blue-500 text-white' : 'bg-gray-100'}
            onClick={() => onApplyPreset(preset.platforms)}
          >
            {preset.name}
          </button>
        );
      })}
    </div>
  );
}
```

### Pattern 4: Debounced vs Explicit Search Trigger
**What:** Control when searches are triggered after filter changes
**When to use:** Performance optimization, prevent excessive API calls
**Options:**
```typescript
// Option A: Debounced automatic search (300ms delay)
import { useEffect } from 'react';
import { useDebounce } from './hooks/useDebounce'; // Or use lodash.debounce

function SearchWithFilters() {
  const [query, setQuery] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, 300);

  // Search triggers automatically after 300ms of no changes
  useEffect(() => {
    if (debouncedQuery) {
      searchDocuments({ query: debouncedQuery, platforms });
    }
  }, [debouncedQuery, platforms]);
}

// Option B: Explicit Apply button
function FilterSection() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const handleApply = () => {
    // Only trigger search when user clicks Apply
    setSearchParams({ platform: selectedPlatforms });
  };

  return (
    <div>
      <CheckboxGroup onChange={setSelectedPlatforms} />
      <button onClick={handleApply}>Apply Filters</button>
    </div>
  );
}

// Option C: Hybrid - instant for presets, debounced for manual selection
const APPLY_MODE = {
  presets: 'instant',     // Click preset → immediate search
  manual: 'debounced',    // Checkbox toggle → 300ms debounce
} as const;
```

**Recommendation:** Start with debounced approach (Option A) for simplicity. If users find it annoying (unexpected searches while clicking), switch to explicit Apply button (Option B).

### Anti-Patterns to Avoid
- **Using internal state for filters:** URL params enable sharing, internal state doesn't
- **Triggering search on every checkbox click without debounce:** Causes excessive API calls
- **Not clearing filters when applying preset:** Users expect preset to replace current filters
- **Lost URL state on filter change:** Each change should update URL, not just search
- **Calculating result counts on frontend:** Backend should return count, frontend should display it

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL query parsing/encoding | Manual string manipulation | `useSearchParams` from react-router-dom | Built-in URL handling, handles encoding/decoding |
| Debounce logic | setTimeout with manual cleanup | `useDebounce` hook or lodash.debounce | Tested, handles edge cases |
| Combining filters | String concatenation | Array of conditions + `join(' AND ')` | Cleaner, easier to extend |
| Preset deduplication | Custom state comparison | JSON.stringify comparison | Simple and reliable |
| Result count tracking | Frontend counting | Backend `len(results)` | Single source of truth |

**Key insight:** React Router's `useSearchParams` provides sophisticated URL state management. Manual URL string parsing is error-prone and misses edge cases (encoding, special characters, multiple values).

## Common Pitfalls

### Pitfall 1: LanceDB WHERE Clause SQL Injection
**What goes wrong:** User-provided values injected unsafely into WHERE clause
**Why it happens:** Direct string interpolation without validation
**How to avoid:** Validate platform values against whitelist of allowed platforms
**Warning signs:** Errors from malformed SQL, unexpected filter behavior

**Safe pattern:**
```python
# Define allowed platforms as whitelist
ALLOWED_PLATFORMS = ['chatgpt', 'claude', 'gemini', 'perplexity', 'claude-code']

# Validate before using in WHERE clause
if request.platform:
    if isinstance(request.platform, list):
        # Validate each platform
        validated = [p for p in request.platform if p in ALLOWED_PLATFORMS]
        if validated:
            platform_list = "', '".join(validated)
            filters.append(f"platform IN ('{platform_list}')")
    else:
        # Single platform case from schema (or convert to list)
        if request.platform in ALLOWED_PLATFORMS:
            filters.append(f"platform = '{request.platform}'")
```

### Pitfall 2: URL Query Parameter Encoding Issues
**What goes wrong:** Platform names with special characters break URL
**Why it happens:** Manual URL construction without encoding
**How to avoid:** `useSearchParams` handles encoding automatically
**Warning signs:** Filters lost on page reload, unexpected 404 errors

**Example:**
```typescript
// ✅ CORRECT: useSearchParams handles encoding
const [searchParams, setSearchParams] = useSearchParams();
searchParams.set('platform', 'claude-code');  // Encodes to platform=claude-code
searchParams.append('platform', 'chatgpt');   // Encodes correctly

// ❌ WRONG: Manual construction breaks on special chars
const url = new URL(window.location.href);
url.searchParams.set('platform', 'claude code');  // Space not encoded by default
```

### Pitfall 3: Race Conditions with Debounced Filters
**What goes wrong:** Rapid clicks result in stale API responses
**Why it happens:** Multiple debounced timers running concurrently
**How to avoid:** Cancel pending searches when new one starts
**Warning signs:** Results don't match current filters, "results flashing"

**Solution:**
```typescript
// Use useRef to track and cancel pending requests
const currentSearchId = useRef(0);

useEffect(() => {
  const searchId = ++currentSearchId;
  const timer = setTimeout(async () => {
    const result = await searchDocuments(query, platforms);
    // Only update if this is the most recent search
    if (searchId === currentSearchId.current) {
      setResults(result);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [query, platforms]);
```

### Pitfall 4: Preset State Not Synchronized with URL
**What goes wrong:** Clicking preset updates filters but URL shows old values
**Why it happens:** Preset handler updates internal state but not URL params
**How to avoid:** Update URL params immediately when applying preset
**Warning signs:** Sharing URL doesn't show selected preset, back button breaks

**Correct pattern:**
```typescript
const applyPreset = (presetPlatforms: string[]) => {
  const newParams = new URLSearchParams(searchParams);
  newParams.delete('platform'); // Clear existing

  if (presetPlatforms.length > 0) {
    presetPlatforms.forEach(p => newParams.append('platform', p));
  }

  setSearchParams(newParams); // Updates URL and triggers search
};
```

### Pitfall 5: Test Data Lacks Platform Diversity
**What goes wrong:** Filter tests pass because all test data has same platform
**Why it happens:** Test fixtures don't create multi-platform data
**How to avoid:** Extend testMessages fixture with platform-specific data
**Warning signs:** Filter tests always return all results regardless of selection

**Enhanced fixture:**
```typescript
// Source: tests/e2e/fixtures/database.ts - needs extension
const testMessages: TestMessage[] = [
  {
    conversation_id: 'test-conv-1',
    message: 'ChatGPT conversation about API design',
    role: 'user',
    timestamp: Date.now() - 86400000,
    platform: 'chatgpt',  // ADD: Platform field
  },
  {
    conversation_id: 'test-conv-2',
    message: 'Claude Code dev session',
    role: 'user',
    timestamp: Date.now() - 3600000,
    platform: 'claude-code',  // ADD: Platform field
  },
  {
    conversation_id: 'test-conv-3',
    message: 'Gemini response about database optimization',
    role: 'assistant',
    timestamp: Date.now() - 1800000,
    platform: 'gemini',  // ADD: Platform field
  },
  // ... more diverse platforms
];
```

## Code Examples

Verified patterns from official sources and current codebase:

### Complete Filter Component
```typescript
// Source: React Router useSearchParams + current component patterns
import { useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';

export interface Platform {
  id: string;
  name: string;
}

const AVAILABLE_PLATFORMS: Platform[] = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'claude', name: 'Claude' },
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'perplexity', name: 'Perplexity' },
];

export function FilterSection({
  resultCount,
  totalCount,
  onFilterChange,
}: {
  resultCount: number;
  totalCount: number;
  onFilterChange: (platforms: string[]) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get selected platforms from URL query params
  const selectedPlatforms = searchParams.getAll('platform');

  // Handle checkbox toggle
  const handleToggle = (platformId: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (selectedPlatforms.includes(platformId)) {
      // Remove one occurrence (for OR logic)
      const newArray = selectedPlatforms.filter(p => p !== platformId);
      newParams.delete('platform');
      newArray.forEach(p => newParams.append('platform', p));
    } else {
      // Add new platform
      newParams.append('platform', platformId);
    }

    setSearchParams(newParams);
    onFilterChange(newParams.getAll('platform'));
  };

  // Handle clear all filters
  const handleClear = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('platform');
    setSearchParams(newParams);
    onFilterChange([]);
  };

  const hasFilters = selectedPlatforms.length > 0;
  const showingCount = resultCount;
  const showingLabel = hasFilters
    ? `${showingCount} of ${totalCount} results`
    : `${totalCount} results`;

  return (
    <div className="flex flex-col gap-3">
      {/* Result count */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{showingLabel}</span>
        {hasFilters && (
          <button
            onClick={handleClear}
            className="text-blue-600 hover:text-blue-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filter checkboxes */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" />
          <span>Filter by source:</span>
        </div>
        {AVAILABLE_PLATFORMS.map(platform => (
          <label
            key={platform.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedPlatforms.includes(platform.id)}
              onChange={() => handleToggle(platform.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">{platform.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

### Backend Filter Implementation
```python
# Source: Current search.py L42-43 with extension for multi-platform
@router.post("/search", response_model=SearchResponse)
async def search_documents(request: SearchRequest):
    """Search for documents using hybrid search with platform filtering."""

    # ... embedding generation code unchanged ...

    table = db_client.get_table("messages")
    search_builder = table.search(query_vector)

    # Apply limit and offset
    search_builder = search_builder.limit(request.limit).offset(request.offset)

    # Apply filters with AND logic
    filters = []

    # 1. Conversation filter (existing)
    if request.conversation_id:
        filters.append(f"conversation_id = '{request.conversation_id}'")

    # 2. Platform filter (NEW)
    if request.platform:
        # Schema: platform can be str | str[] | None
        # Handle list for multi-select OR logic
        if isinstance(request.platform, list):
            # Filter to only allowed platforms (whitelist validation)
            allowed_platforms = ['chatgpt', 'claude', 'claude-code', 'gemini', 'perplexity']
            validated = [p for p in request.platform if p in ALLOWED_PLATFORMS]
            if validated:
                platform_list = "', '".join(validated)
                filters.append(f"platform IN ('{platform_list}')")
        elif isinstance(request.platform, str):
            if request.platform in ALLOWED_PLATFORMS:
                filters.append(f"platform = '{request.platform}'")

    # Combine all filters with AND logic
    if filters:
        where_clause = " AND ".join(filters)
        search_builder = search_builder.where(where_clause)

    # Execute search
    results_list = await run_in_threadpool(search_builder.to_list)

    # ... rest of response building unchanged ...
```

**Schema Update Needed:**
```python
# Source: src/app/schemas/message.py L176
class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    offset: int = 0
    conversation_id: str | None = None
    platform: str | list[str] | None = None  # CHANGE: Add list support

    # Or separate into request query params
    # FastAPI query params handle arrays automatically:
    # ?platform=chatgpt
    # ?platform=chatgpt&platform=gemini
```

**FastAPI Query Parameter Pattern:**
```python
# Alternative approach using Query() for array parameters
from fastapi import Query

@router.post("/search", response_model=SearchResponse)
async def search_documents(
    query: str,
    limit: int = 10,
    offset: int = 0,
    conversation_id: str | None = None,
    platform: list[str] | None = Query(default=None, description="Filter by platform(s)"),
):
    # FastAPI automatically parses ?platform=chatgpt&platform=gemini as list
    ...

# Or keep POST with body for consistency with existing API
# This is cleaner for React Query integration
```

### Preset Component
```typescript
// Source: CONTEXT.md preset requirements
const PRESETS = [
  { id: 'web-chats', name: 'Web Chats Only', platforms: ['chatgpt', 'claude', 'gemini', 'perplexity'] },
  { id: 'dev-sessions', name: 'Dev Sessions Only', platforms: ['claude-code'] },
  { id: 'all', name: 'All Sources', platforms: [] },
] as const;

export function PresetFilter({
  selectedPlatforms,
  onApplyPreset,
}: {
  selectedPlatforms: string[];
  onApplyPreset: (platforms: string[]) => void;
}) {
  const [searchParams] = useSearchParams();

  // Determine which preset is active
  const activePresetId = PRESETS.find(preset => {
    if (preset.platforms.length === 0) {
      return selectedPlatforms.length === 0;
    }
    return JSON.stringify([...selectedPlatforms].sort()) ===
           JSON.stringify([...preset.platforms].sort());
  })?.id;

  return (
    <div className="flex gap-2">
      {PRESETS.map(preset => (
        <button
          key={preset.id}
          onClick={() => onApplyPreset(preset.platforms)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activePresetId === preset.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
}
```

### E2E Test for Filters
```typescript
// Source: Phase 14 test patterns + new filter requirements
import { test as authTest } from '../fixtures/auth';
import { test as dbTest } from '../fixtures/database';
import { mergeFixtures } from '../fixtures/merge';

const test = mergeFixtures(authTest, dbTest);

test('user can filter search results by platform', async ({ page, apiKey, request, baseURL, testDbPath }) => {
  // Setup: Create test data with multiple platforms
  const messages = [
    { conversation_id: 'chatgpt-conv', content: 'ChatGPT message', platform: 'chatgpt' },
    { conversation_id: 'claude-conv', content: 'Claude message', platform: 'claude' },
    { conversation_id: 'claude-code-conv', content: 'Claude Code message', platform: 'claude-code' },
  ];

  // Ingest test data
  for (const msg of messages) {
    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: msg,
    });
  }

  // Test without filters
  await page.goto('/');
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();

  await page.getByPlaceholder(/search/i).fill('message');
  await page.getByPlaceholder(/search/i).press('Enter');

  // Should find all 3 results
  await expect(page.locator('article')).toHaveCount(3);

  // Apply ChatGPT filter
  await page.getByLabel('ChatGPT').click();

  // Should only find ChatGPT result
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.getByText('ChatGPT message')).toBeVisible();

  // URL should reflect filter
  await expect(page).toHaveURL(/platform=chatgpt/);

  // Apply Claude filter (add to existing)
  await page.getByLabel('Claude').click();

  // Should find 2 results (ChatGPT + Claude)
  await expect(page.locator('article')).toHaveCount(2);

  // URL should have multiple platforms
  await expect(page).toHaveURL(/platform=chatgpt/);
  await expect(page).toHaveURL(/platform=claude/);

  // Clear filters
  await page.getByText('Clear filters').click();

  // Should show all results again
  await expect(page.locator('article')).toHaveCount(3);
  await expect(page).not.toHaveURL(/platform=/);
});

test('preset filters work correctly', async ({ page, apiKey, request, baseURL }) => {
  // Setup: Create test data
  const webChatMessages = [
    { content: 'ChatGPT web chat', platform: 'chatgpt' },
    { content: 'Gemini web chat', platform: 'gemini' },
  ];
  const devMessages = [
    { content: 'Claude Code session', platform: 'claude-code' },
  ];

  // Ingest data
  for (const msg of [...webChatMessages, ...devMessages]) {
    await request.post(`${baseURL}/api/v1/ingest`, {
      headers: { 'X-API-Key': apiKey },
      data: {
        conversation_id: `test-${msg.platform}`,
        platform: msg.platform,
        content: msg.content,
        role: 'user',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Navigate and search
  await page.goto('/');
  await page.getByLabel('API Key').fill(apiKey);
  await page.getByRole('button', { name: 'Connect' }).click();
  await page.getByPlaceholder(/search/i).fill('chat');
  await page.getByPlaceholder(/search/i).press('Enter');

  // Click "Web Chats Only" preset
  await page.getByRole('button', { name: 'Web Chats Only' }).click();

  // Should only show web chat platforms
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByText('ChatGPT web chat')).toBeVisible();
  await expect(page.getByText('Gemini web chat')).toBeVisible();
  await expect(page.getByText('Claude Code session')).not.toBeVisible();

  // Click "Dev Sessions Only" preset
  await page.getByRole('button', { name: 'Dev Sessions Only' }).click();

  // Should only show dev platforms
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.getByText('Claude Code session')).toBeVisible();

  // Click "All Sources" preset
  await page.getByRole('button', { name: 'All Sources' }).click();

  // Should show all results
  await expect(page.locator('article')).toHaveCount(3);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Internal React state | URL query parameters | React Router 6+ | Shareable links, browser navigation support |
| Single-value filters | Multi-select with OR logic | Modern filter UIs | Better UX for finding content across platforms |
| Manual filter lists | Preset shortcuts | E-commerce patterns | Faster access to common filter combinations |
| Immediate search on change | Debounced search | Performance optimization | Fewer API calls, better UX |
| Frontend result counting | Backend result counting | Single source of truth | Consistent counts, no frontend calculation |

**Deprecated/outdated:**
- Manual URL string manipulation: `window.location.search += '&platform=test'` - Use `setSearchParams` instead
- `componentDidMount` data fetching: Use React Query or `useEffect` for fetching
- `setTimeout` for debounce without cleanup: Use proper `useEffect` cleanup or debounce library

**Modern standards:**
- `useSearchParams` for URL state: Part of React Router Hooks API (React Router 6.4+)
- URL-encoded query arrays: `?platform=chatgpt&platform=gemini` - Standard for multi-value query params
- Debounce for user input: 300ms delay is standard practice (avoids excessive calls)
- Backend filtering with SQL IN clause: Standard database pattern for multi-value filters

## Open Questions

### Question 1: Debounce vs Explicit Apply for Filters
- **What we know:** Search bar already has 300ms debounce (SearchBar.tsx L15-17)
- **What's unclear:** Should filters use automatic debounce or require Apply button?
- **Analysis:**
  - *Pro debounce:* Matches current search behavior, feels smoother, no extra clicks
  - *Pro Apply button:* Explicit control, no unexpected searches, works better on slow connections
  - *Current code:* Search bar has auto-debounce, suggests UX expectation of instant responses
- **Recommendation:** Start with debounce (matches current pattern). If users complain or if device lab testing shows issues, add Apply button option. Consistency with existing search behavior is more important for initial release.

### Question 2: Result Count - Backend or Frontend Calculation
- **What we know:** SearchResponse already has `count` field (total matching items)
- **What's unclear:** Should backend send filtered count only, or both filtered and total count?
- **Analysis:**
  - *Current behavior:* SearchResponse.count = count of matching results (currently no filtering applied, so this is total)
  - *Option A:* Backend only returns filtered count (e.g., "3 results")
  - *Option B:* Backend returns both filtered count and total count (e.g., "3 of 15 results")
  - *Requirement check:* FILT-04 says "User sees result counts update in real-time" - doesn't specify format
  - *Context CONTEXT.md:* "Zero results shows empty state message with option to clear filters"
- **Recommendation:** Backend returns only filtered count (simpler, consistent with current API). Frontend displays "X results" and "X of Y results" if cached total is available. For Phase 15, fallback to "X results" text is acceptable. Can add total count endpoint in future phase if needed.

### Question 3: Schema Change Location
- **What we know:** SearchRequest.platform currently accepts string (message.py L176)
- **What's unclear:** Should we change schema to accept string[] directly, or use FastAPI Query() pattern?
- **Analysis:**
  - *Option A (schema change):* Update SearchRequest.platform to `str | list[str] | None`
    - Pro: Type safety, consistent with current POST API pattern
    - Con: Requires schema change, affects all existing API consumers
  - *Option B (Query param):* Use FastAPI Query() with array support (`?platform=chatgpt&platform=gemini`)
    - Pro: Clean API design, standard FastAPI pattern
    - Con: Changes how search is called, React Query updates required
  - *Option C (separate endpoint or param):* Add new `platforms` parameter alongside existing `platform`
    - Pro: Backward compatible, zero breaking changes
    - Con: Confusing to have two similar parameters
- **Decision needed:** This is an architect's decision.
- **My recommendation:** Option B (Query param) is cleaner and follows FastAPI best practices. Modern React Query handles serialization seamlessly. The alternative introduces unnecessary complexity.

### Question 4: Filter Component Location and Layout
- **What we know:** Current UI has SearchBar above results (App.tsx L104-120)
- **What's unclear:** Where should filter UI go? Above search bar? Below? In a panel?
- **Analysis:**
  - *Option A (below search bar):* Filters section between search bar and results
    - Pro: Clear visual hierarchy, results always visible above fold
    - Con: Takes up vertical space, especially with many platforms
  - *Option B (side panel):* Collapsible drawer on the right
    - Pro: Results always visible, filters don't push content down
    - Con: Hides filters behind interaction, adds complexity
  - *Option C (compact row):* Horizontal chips next to search bar
    - Pro: Compact, always visible
    - Con: Crowded with many platforms
  - *Current state:* SearchBar is sticky, results scroll independently
- **Recommendation:** Start with Option A (below search bar, above results). Use horizontal layout with "Filter by:" label. This pattern is used by GitHub, Gmail, Shopify - familiar to users. Can expand to side panel in future if UX research suggests it.

### Question 5: Preset Visual Design
- **What we know:** CONTEXT.md lists 3 presets: "Web Chats Only", "Dev Sessions Only", "All Sources"
- **What's unclear:** Should presets be chips, toolbar buttons, or dropdown?
- **Analysis:**
  - *Chips (pil-like pills):* `--- Selected ---` compact, scannable, clear active state
  - *Toolbar buttons:* Full-width row, more prominent
  - *Dropdown:* Saves space, hides presets until clicked
  - *Context CONTEXT.md:* "Claude's Discretion - Preset visual display (chips, toolbar icons, or dropdown)"
- **Recommendation:** Use chips (pill-shaped buttons). Matches Tailwind's own dashboard patterns. Show preset chips next to filter checkboxes or in a separate row above them. Clicking a preset updates filter state AND applies immediately.

## Sources

### Primary (HIGH confidence)
- Project codebase:
  - `src/app/api/v1/endpoints/search.py` - Current search endpoint implementation (L42-43 shows conversation_id filter)
  - `src/app/schemas/message.py` - SearchRequest schema has `platform: str | None` field (L176)
  - `ui/src/App.tsx` - Current UI structure, SearchBar placement, infinite scroll pattern
  - `ui/src/components/SearchBar.tsx` - Existing debounce pattern (L15-17)
  - `ui/src/lib/api.ts` - React Query patterns (useSearch)
  - `.planning/phases/15-source-filtering/15-CONTEXT.md` - Context capture with requirements and approved decisions
- [React Router useSearchParams Documentation](https://reactrouter.com/hooks/use-search-params) - Official hooks API for URL state
- [LanceDB Python Reference - search().where()](https://lancedb.github.io/lancedb/python/python.html#lancedb.table.Table.search) - WHERE clause syntax
- [FastAPI Query Parameters Documentation](https://fastapi.tiangolo.com/tutorial/query-params/) - Query parameters including lists

### Secondary (MEDIUM confidence)
- [Tailwind UI Filter Patterns 2024](https://tailwindui.com/templates/application-ui-filters) - Design patterns for filter UI
- [Radix UI Checkbox Component Patterns](https://www.radix-ui.com/docs/primitives/components/checkbox) - Accessible checkbox patterns
- [Vercel Analytics Dashboard Patterns](https://vercel.com/design/analytics) - Filter UI examples
- [GitHub Filter Chip Patterns](https://github.com/vercel/next.js/blob/canary/packages/website/components/filter.tsx) - Chip-based filtering
- [React Query useQuery with Dependent Queries](https://tanstack.com/query/v5/docs/react/reference/useQuery) - Debouncing pattern with React Query

### Tertiary (LOW confidence)
- [State of React Routing 2025](https://www.builder.io/blog/react-router-vs-remix) - Comparison of routing patterns
- [URL Best Practices for Web Apps 2026](https://web.dev/url-best-practices/) - URL encoding guidelines
- [Performance Patterns for React Debouncing](https://www.pattern.dev/react-performance-patterns/) - Debounce best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React 19, Vite, Tailwind already installed, patterns documented
- Architecture: HIGH - URL state management is standard React pattern, LanceDB WHERE clause follows SQL conventions
- Pitfalls: HIGH - Identified from current codebase patterns (search.py existing filter) and common React issues (race conditions, URL encoding)
- Open questions: MEDIUM - All clearly defined with recommendations provided

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - React/LanceDB/FastAPI are stable, patterns unlikely to change)

**Key Insights for Planning:**

1. **Backend work is minimal:** Just extend existing WHERE clause pattern from line 42-43 of search.py to support multiple platforms. No new endpoints or complex logic needed.

2. **Frontend state management is the core challenge:** URL parameter sync with checkbox state, proper encoding, and preventing race conditions with rapid clicks. Use `useSearchParams` from react-router-dom - it handles all edge cases.

3. **Test infrastructure is ready:** Phase 13 (test-setup) and Phase 14 (integration tests) provide fixtures. Just need to create multi-platform test data in database fixture and write new specs in `tests/e2e/spec/filter-flow.spec.ts`.

4. **Schema change required:** Current `platform: str | None` needs to accept array and/or handle string values. Decision point: use FastAPI Query() pattern vs existing schema pattern.

5. **UX consistency matters:** Follow existing debounce pattern (300ms) from SearchBar.tsx. Don't introduce new interaction model (Apply button) unless user testing reveals issues.

6. **Presets are state snapshots:** Current implementation should track which preset is active based on selected platforms. Use deep comparison (JSON.stringify) for reliable active state detection.

7. **Real-time update requirement:** FILT-04 requires "result counts update in real-time." If using debounce, counts update automatically when search completes. No complex polling or websocket needed.
