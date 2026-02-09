# Phase 04 Research: Unified Interface

**Status:** Complete
**Date:** 2026-02-07

## 1. Architecture & Integration

### Frontend-Backend Coupling
The React application will live in a `ui/` directory at the project root but will be served by the existing FastAPI backend in production.

- **Development:**
  - FastAPI runs on `:8000`
  - Vite (React) runs on `:5173` (proxies `/api` to `:8000`)
- **Production:**
  - `npm run build` outputs to `src/static/`
  - FastAPI serves `index.html` and static assets

### Serving Strategy
We need to modify `src/app/main.py` to support Single Page Application (SPA) routing:
1. **Assets:** Continue mounting `/static` for build artifacts (JS/CSS).
2. **Root:** Serve `index.html` directly.
3. **Fallback:** Catch-all route for client-side routing (if we use React Router) to return `index.html`.

**Current Gap:** `main.py` currently redirects `/` to `/static/test.html`. This needs to be replaced.

## 2. Technology Stack (Frontend)

Based on decisions:
- **Build Tool:** Vite (Fast, standard)
- **Framework:** React + TypeScript
- **Styling:** Tailwind CSS
- **Components:** Shadcn/UI (Radix Primitives + Tailwind)
- **Icons:** `lucide-react` (General UI), custom SVGs (Platform logos)
- **State/Fetching:** TanStack Query (v5)
  - Critical for "Instant Search" debouncing and caching.
  - Handles loading states and "infinite scroll" data merging.

## 3. Backend Gaps (Critical)

The current `search.py` and `SearchRequest` schema lack pagination support, which is required for the "Infinite Scroll" decision.

### Missing: Pagination Logic
The `SearchRequest` model needs an `offset` field.
```python
class SearchRequest(BaseModel):
    query: str
    limit: int = 50
    offset: int = 0  # <--- Missing
```

The `search_documents` endpoint needs to pass this offset to LanceDB:
```python
search_builder = table.search(query_vector).limit(limit).offset(offset)
```

**Risk:** Vector search pagination can be unstable if the index changes, but for an append-only log, it's acceptable.

### Missing: Grouping Stability
The current grouping logic happens *after* retrieval.
- If we request `limit=50`, we might get 50 messages from the same conversation.
- **Mitigation:** We will accept this behavior for V1. The UI will just show one large group. "Infinite Scroll" will simply fetch the next chunk of matches.

## 4. UI/UX Specifications

### Layout
- **Header:** Search Bar (centered, sticky).
- **Main:** Card Grid (Masonry or simple uniform grid).
- **Card Content:**
  - Header: Platform Icon + Title + Date.
  - Body: Text snippet with highlighting (if possible, otherwise raw text).
  - Footer: "Open" button.

### Interaction Details
- **Debounce:** 300ms on search input.
- **Zero State:** "Type to search your history..." (Simple start).
- **Click:** Opens `url` in new tab.

## 5. Implementation Plan Draft

1. **Scaffold:** Create `ui/` with Vite + Tailwind.
2. **Backend Update:** Add `offset` to `SearchRequest` and implementation.
3. **SPA Serving:** Update `main.py` to serve React build.
4. **UI Core:** Install Shadcn (Card, Input, Button).
5. **Feature:** Implement Search Hook with React Query.
6. **Feature:** Build Result List with Infinite Scroll.

## 6. Directory Structure
```
/
├── ui/                 # New Frontend Source
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts  # Configured to buildOutDir: '../src/static'
├── src/
│   ├── static/         # Build destination
│   └── app/            # Existing Backend
```
