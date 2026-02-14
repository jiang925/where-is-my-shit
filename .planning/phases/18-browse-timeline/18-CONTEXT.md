# Phase 18: Browse Page with Timeline - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Browse all conversations chronologically with flexible date and source filters — no search query needed. Users can scan a timeline of captured conversations, filter by date range and platform, and jump into any conversation. This is the "browse" complement to the existing "search" page.

</domain>

<decisions>
## Implementation Decisions

### Timeline layout & grouping
- Group into relative time buckets: Today / Yesterday / This Week / This Month / Older
- Buckets auto-update daily based on current date
- Show conversation count per section (e.g., "Today (5)")
- Show empty sections with a "No conversations" message rather than hiding them — keeps the timeline feeling continuous
- Section headers: Claude's discretion (sticky vs inline — pick what works best with existing UI)

### Browse card content
- Reuse the existing search result card component from search page — consistent look
- Show first ~2 lines of conversation content as a preview snippet
- Reuse the Phase 15 SourceFilter component on the browse page (full version with presets)
- Relevance score slot: Claude's discretion on what to show instead (timestamp, fragment count, or hide)

### Date range filtering
- Quick-select buttons: Today / This Week / This Month / All Time
- One button active at a time, similar to source filter preset pattern
- Default to "All Time" on first load
- Date filter state persists in URL query parameters (e.g., /browse?range=this_week) — shareable and bookmarkable

### Pagination & loading
- Infinite scroll — automatically load more conversations as user nears the bottom
- Cursor-based pagination to handle new items appearing without duplicates or gaps
- Empty state: friendly message with setup hint (e.g., "No conversations yet — install the extension or set up a watcher to start capturing")

### Claude's Discretion
- Section header style (sticky vs inline)
- What replaces relevance score on browse cards (timestamp, fragment count, or hidden)
- Loading skeleton design during infinite scroll
- Exact spacing and typography
- How "Older" bucket handles very old conversations (sub-grouping or flat)

</decisions>

<specifics>
## Specific Ideas

- Date filter buttons should feel consistent with the source filter presets from Phase 15 — same visual pattern
- URL state should work like the search page (React Router query params) so browse links are shareable
- Empty sections keep the timeline continuous — user always sees the full time structure

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-browse-timeline*
*Context gathered: 2026-02-13*
