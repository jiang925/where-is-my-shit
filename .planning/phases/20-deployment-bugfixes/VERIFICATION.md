# Phase 20: Deployment Bugfixes — Verification

**Status:** PASS (retroactive — all fixes deployed and verified on 192.168.50.202)
**Date:** 2026-02-15

## Summary

Retroactive phase documenting runtime bugs found during first real deployment on remote server and UI testing. All fixes committed, deployed, and verified working.

## Fixes Applied

### Backend Fixes

1. **LanceDB compaction API mismatch** (`09e5c0c`)
   - `list_fragments()` doesn't exist in lancedb 0.29.1
   - Fixed: use `table.stats()["fragment_stats"]["num_fragments"]` instead
   - Files: `src/app/db/compaction.py`, `tests/test_compaction.py`

2. **Embedding dimension mismatch on startup** (`09e5c0c`)
   - Existing DB has 384-dim vectors (bge-small-en-v1.5), new default bge-m3 produces 1024-dim
   - Server returned 500 on search: "query dim(1024) doesn't match column vector dim(384)"
   - Fixed: `_check_embedding_dimension_compat()` in `main.py` lifespan detects mismatch and auto-falls back to fastembed/bge-small-en-v1.5
   - Files: `src/app/main.py`

3. **Schema evolution: missing embedding_model column** (`28347f3`)
   - Tables created before Phase 19 lack `embedding_model` column
   - Ingest failed: "Field 'embedding_model' not found in target schema"
   - Fixed: `init_db()` adds column with default value on startup if missing
   - Files: `src/app/db/client.py`

### Frontend Fixes

4. **"All Sources" preset toggle stuck in loop** (`2feab69`, `ff1bc31`)
   - Clicking "All Sources" toggled to `[]` (empty), which `isPresetActive` treated as active, making further clicks no-ops
   - Fixed: "All Sources" always sets all platform IDs explicitly (not empty array), `isPresetActive` only checks explicit selection
   - Files: `ui/src/components/PresetButtons.tsx`

5. **"Search Results for X" layout shift** (`2feab69`)
   - Conditional `<h1>` above search box caused vertical jump when typing
   - Fixed: removed entirely (query already visible in search box)
   - Files: `ui/src/pages/SearchPage.tsx`

6. **Initial state: no source buttons lit** (`fb5ab35`)
   - `selectedPlatforms` defaulted to `[]` — all buttons unlit despite showing all sources
   - Fixed: default to all platform IDs so all buttons are highlighted on load
   - Files: `ui/src/pages/SearchPage.tsx`, `ui/src/pages/BrowsePage.tsx`

7. **"Showing results from: ..." layout shift** (`fb5ab35`)
   - Conditional text below filter buttons caused vertical repositioning
   - Fixed: removed the message and the filter active indicator
   - Files: `ui/src/components/SourceFilterUI.tsx`, `ui/src/pages/SearchPage.tsx`

8. **Content snippet truncation** (`fb5ab35`)
   - `line-clamp-4` with `font-mono` cut off content oddly, especially code/URLs
   - Fixed: increased to `line-clamp-6`, added `break-words` and `whitespace-pre-wrap`
   - Files: `ui/src/components/ResultCard.tsx`

## Verification

All fixes deployed to 192.168.50.202:8000 and verified:
- Search returns results (no 500 error)
- Compaction completes without errors
- Chrome extension ingests successfully
- All source buttons lit on initial load
- No layout shifts in sticky header
- Content snippets render properly
