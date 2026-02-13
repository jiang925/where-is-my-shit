# Phase 15: Source Filtering - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can filter search results by data source (e.g., ChatGPT, Claude, Claude Code, Cursor). Users can filter by multiple sources, share filtered searches via URL, apply quick filter presets, and see real-time result updates. This phase adds filter controls to the existing search page — it does NOT add new data ingestion capabilities or change the underlying search algorithm.
</domain>

<decisions>
## Implementation Decisions

### Filter interaction behavior
- Multi-select checkboxes for choosing data sources (not single-select or chips)
- Zero results shows empty state message with option to clear filters (not dimmed last results)

### Preset system design
- Fixed presets only — users cannot create custom presets in v1.4
- Three default presets:
  - "Web Chats Only" — ChatGPT, Claude, Gemini
  - "Dev Sessions Only" — Claude Code, Cursor
  - "All Sources" — resets/shows all sources combined

### Claude's Discretion
- Filter application timing (instant real-time vs on-demand with Apply button)
- Result animation behavior when filters change (fade, slide, or no animation)
- Preset visual display (chips, toolbar icons, or dropdown)
- Preset toggle behavior (toggle on/off vs always apply)
</decisions>

<specifics>
## Specific Ideas

No specific requirements or references — open to standard UX patterns for filter components.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 15-source-filtering*
*Context gathered: 2026-02-12*
