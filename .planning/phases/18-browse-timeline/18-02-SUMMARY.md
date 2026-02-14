---
phase: 18-browse-timeline
plan: 02
subsystem: frontend
tags: [ui, components, browse, timeline, filtering]
dependency_graph:
  requires: [react-router-dom, date-fns, tanstack-query, lucide-react]
  provides: [browse-infrastructure, timeline-components]
  affects: [browse-page]
tech_stack:
  added: [date-fns, timeline-grouping, date-range-filter]
  patterns: [url-state-management, component-reuse, adapter-pattern]
key_files:
  created:
    - ui/src/lib/dateGroups.ts
    - ui/src/components/DateRangeFilter.tsx
    - ui/src/components/TimelineSection.tsx
  modified:
    - ui/src/lib/api.ts
    - ui/package.json
decisions:
  - "date-fns for Timeline Grouping: Use date-fns relative time functions (isToday, isYesterday, isThisWeek, isThisMonth) for automatic daily group refresh"
  - "5-Bucket Timeline Structure: Today, Yesterday, This Week, This Month, Older buckets provide clear chronological organization"
  - "URL State for Date Range: Persist date range selection in URL query params for shareable links"
  - "All Time Default: Omit 'all_time' from URL when active for cleaner default URLs"
  - "Inline Section Headers: Use inline headers instead of sticky to avoid stacking on page header"
  - "ResultCard Reuse via Adapter: Convert BrowseItem to SearchResult format to reuse existing ResultCard without modification"
  - "PresetButtons Style Consistency: Match rounded-full blue active state pattern for visual consistency"
metrics:
  duration: 91 seconds (~1.5 minutes)
  completed: 2026-02-14T02:27:07Z
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  tests_added: 0
  commits: 2
---

# Phase 18 Plan 02: Frontend Browse Infrastructure Summary

**One-liner:** Browse API types, useBrowse hook with cursor pagination, timeline grouping utility with date-fns, and reusable DateRangeFilter and TimelineSection components.

## What Was Built

Created the foundational frontend infrastructure for the browse feature that will enable the BrowsePage to display chronologically grouped conversations. All components are designed to be composed together, keeping each focused and within context budget.

**Key components:**
1. **Browse API Types** (BrowseItem, BrowseResponse, DateRangeOption) - TypeScript interfaces for browse API
2. **useBrowse Hook** - React Query infinite query hook with cursor-based pagination
3. **Timeline Grouping Utility** (groupByTimeline, flattenAndGroup, totalGroupedItems) - Groups items into 5 relative time buckets using date-fns
4. **DateRangeFilter Component** - Quick-select date range buttons with URL state persistence
5. **TimelineSection Component** - Timeline section renderer with header, count, and ResultCard list

## How It Works

**Browse Hook:**
- Uses `useInfiniteQuery` from TanStack Query for cursor-based infinite scroll
- Query key includes date range and sorted platforms for cache consistency
- Calls `/browse` endpoint with cursor, limit, date_range, and platforms
- Returns pages with items, nextCursor, hasMore, and total

**Timeline Grouping:**
- `groupByTimeline()` uses date-fns functions (isToday, isYesterday, isThisWeek, isThisMonth) to categorize items
- Date-fns functions compare against current time on each call, so groups auto-update daily
- `flattenAndGroup()` takes pages from useInfiniteQuery and flattens all items before grouping
- `totalGroupedItems()` counts total items across all 5 timeline buckets

**DateRangeFilter:**
- Renders 4 quick-select buttons (Today, This Week, This Month, All Time)
- Uses `useSearchParams` from React Router for URL state persistence
- Active button gets blue background/border (consistent with PresetButtons pattern)
- "All Time" is default and omitted from URL when active

**TimelineSection:**
- Takes title, items array, and isEmpty flag
- Renders inline section header (not sticky) with count badge
- Maps BrowseItems to SearchResults via adapter function
- Reuses existing ResultCard component without modification
- Shows "No conversations" message for empty sections

## Deviations from Plan

None - plan executed exactly as written.

## Testing

No automated tests added in this plan. Testing will be performed in Phase 18 Plan 03 when the BrowsePage integrates these components with E2E tests.

**Manual verification performed:**
- TypeScript compilation passed without errors
- date-fns package installed successfully
- All imports resolve correctly
- Component structure follows existing patterns

## Commits

- **888230c** - feat(18-02): add browse API types, hook, and timeline grouping utility
- **8864f68** - feat(18-02): add DateRangeFilter and TimelineSection components

## Key Files

**Created:**
- `ui/src/lib/dateGroups.ts` - Timeline grouping utility with date-fns
- `ui/src/components/DateRangeFilter.tsx` - Date range quick-select component
- `ui/src/components/TimelineSection.tsx` - Timeline section renderer

**Modified:**
- `ui/src/lib/api.ts` - Added browse types, browse function, and useBrowse hook
- `ui/package.json` - Added date-fns dependency

## Technical Notes

**date-fns Relative Time Functions:**
The key benefit of using date-fns functions like `isToday()` and `isThisWeek()` is they compare against current time on every call. This means timeline groups automatically update daily without manual cache invalidation or date calculations. A conversation from yesterday automatically moves to "Yesterday" bucket at midnight.

**Component Composition Strategy:**
This plan builds infrastructure components that the BrowsePage will compose in the next plan. By separating these from the page rewrite, we keep each plan focused and within context budget. The modular design also makes components reusable for future browse-related features.

**Adapter Pattern for ResultCard:**
The `browseItemToSearchResult()` adapter function converts BrowseItem to SearchResult format, letting us reuse the existing ResultCard component. This keeps the search result card stable and avoids creating a separate browse card component. The adapter hides the relevance_score field (browse items have no relevance) and the ResultCard's timeAgo display becomes the primary time indicator.

**URL State Design:**
DateRangeFilter uses URL query parameters for state persistence, making browse links shareable. The default "all_time" range is omitted from the URL for cleaner default URLs (e.g., `/browse` instead of `/browse?range=all_time`).

## Self-Check: PASSED

**Files exist:**
```
FOUND: ui/src/lib/dateGroups.ts
FOUND: ui/src/components/DateRangeFilter.tsx
FOUND: ui/src/components/TimelineSection.tsx
FOUND: ui/src/lib/api.ts (modified)
FOUND: ui/package.json (modified)
```

**Commits exist:**
```
FOUND: 888230c
FOUND: 8864f68
```

**TypeScript compilation:**
```
PASSED: No errors
```

**Package installation:**
```
FOUND: date-fns@4.1.0
```

## Success Criteria: MET

- [x] date-fns installed as dependency
- [x] useBrowse hook uses useInfiniteQuery with cursor-based pagination
- [x] groupByTimeline correctly categorizes items into 5 time buckets
- [x] DateRangeFilter provides 4 quick-select buttons with URL state in search params
- [x] TimelineSection renders header with count, conversation cards, and empty state
- [x] All TypeScript compiles without errors
