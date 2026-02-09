# Phase 04: Unified Interface - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone Web/App UI (React) for searching and navigating to indexed conversations.
Users can intuitively search and navigate to specific conversations from a unified interface.
New capabilities (like organizing or editing) belong in other phases.

</domain>

<decisions>
## Implementation Decisions

### Application Architecture
- **Type:** Web App (Browser based)
- **Serving:** Bundled with Core Engine (Core serves static files)
- **Framework:** React (Recommended)
- **Theme:** Modern Clean (Tailwind + Shadcn)

### Search Experience
- **Input:** Instant Search (results update as you type, debounced)
- **Filtering:** UI Filters (visible dropdowns/chips for Source, Date, etc.)
- **Zero State:** Recent Activity (show recently indexed items or recent searches)
- **Pagination:** Infinite Scroll

### Result Presentation
- **Layout:** Card Grid
- **Content:** Rich Snippets (matching text + surrounding context)
- **Source Indication:** Visual Icons (badges/logos for Slack, Chrome, etc.)
- **Metadata:** Hidden / On Hover (keep interface clean)

### Interaction Flow
- **Click Action:** Open Source (Direct) - opens deep link in new tab
- **Dev Links:** Editor Deep Links (try to open `vscode://` where possible)
- **Quick Actions:** Visible Action Buttons on cards (Copy Text, Copy Link)
- **Navigation:** Standard / Mouse (no complex keyboard shortcuts required)

### Claude's Discretion
- Exact component library choices (within React/Tailwind ecosystem)
- Specific icon set selection
- Debounce timing and error boundary behavior
- Responsive design breakpoints

</decisions>

<specifics>
## Specific Ideas

- "Modern Clean" aesthetic implies a polished, professional look (Linear/Vercel style)
- Instant search requires efficient backend querying or optimistic UI
- "Bundled" means the build process needs to output static files that the Python core server can serve via FastAPI/Starlette StaticFiles

</specifics>

<deferred>
## Deferred Ideas

- Desktop App (Tauri) wrapper - deferred to future if needed
- Advanced keyboard shortcuts (vim bindings) - deferred
- Complex saved searches or workspaces

</deferred>

---

*Phase: 04-unified-interface*
*Context gathered: 2026-02-06*
