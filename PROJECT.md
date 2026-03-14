# PROJECT.md — Where Is My Shit (WIMS)

## 1. Project Structure

This project uses a **Milestone > Phase > Plan** hierarchy managed under `.planning/`.

- **Milestone**: A versioned release with a theme (e.g., v1.8 UI Polish). Defined in `ROADMAP.md`.
- **Phase**: A focused deliverable within a milestone (e.g., Phase 28: Statistics Dashboard). Each phase has a goal, success criteria, and one or more plans.
- **Plan**: An implementation unit within a phase. Each plan is a concrete task that produces a commit.

Key files:
- `.planning/ROADMAP.md` — All milestones and phases with status
- `.planning/STATE.md` — Current position, progress metrics, session continuity
- `PROJECT.md` — This file. Dev workflow, testing, and pending work.
- `TESTING.md` — Test inventory, coverage gaps, and implementation checklist. Audit before shipping.

Completed: v1.0 through v3.0 (48 phases, 84 plans).

## 2. Development Cycle

The workflow is an iterative loop:

```
Brainstorm --> Define Milestone --> Plan Phases --> Execute --> Test --> Audit Tests --> Audit Docs --> Ship
    ^                                                                                    |
    +------------------------------------------------------------------------------------+
```

1. **Brainstorm**: Identify pain points from real usage. What's the most impactful thing to build next? Discuss freely before committing to scope.
2. **Define Milestone**: Set a version number, theme, and high-level goals.
3. **Plan Phases**: Break the milestone into phases. Each phase has a goal, success criteria, and plans.
4. **Execute**: Implement plans one at a time. Commit after each plan.
5. **Test**: Run all test layers (see section 3). Fix before moving on.
6. **Audit Tests**: Check `TESTING.md` — enumerate gaps, implement missing tests, run, fix. Tests must be up to date and coverage targets met (90%+ unit) before shipping.
7. **Audit Docs**: Review and update all documentation (`PROJECT.md`, `TESTING.md`, `README.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`) to reflect the features just built. Docs must be accurate before shipping.
8. **Ship**: Push to main, verify CI, update ROADMAP.md and STATE.md.

Between milestones, brainstorm the next set of features before writing any code. No milestone should start without a brainstorm session.

### Rules of Thumb

1. **Always document the work.** Record decisions, changes, and rationale in `.planning/`, `PROJECT.md`, or other files — but always make them discoverable from `PROJECT.md`.
2. **Reflect after each implementation round.** After completing a phase or milestone, write down what went well, what was missed, mistakes to avoid next time, and patterns that worked. Add these to the Lessons section below.
3. **Commit after each phase, don't push.** Each phase should produce a commit. Push only when the user explicitly asks, or when shipping a milestone.
4. **Use agent teams and subagents as much as possible.** Parallelize independent research, exploration, and implementation tasks using subagents. Prefer dispatching multiple agents over sequential work when tasks don't depend on each other.

## 3. Testing

**Rule: Always test in UI.** Automated tests catch regressions, but visual confirmation in the browser is required for any UI change.

**See `TESTING.md`** for the full test inventory, coverage gaps, and implementation checklist. The audit step in the dev cycle (step 6) uses TESTING.md to enumerate → audit → implement → run → fix until coverage targets are met.

### Test layers

| Layer | Tool | Command | Count | What it covers |
|-------|------|---------|-------|----------------|
| Backend unit/integration | pytest | `uv run pytest` | 194 tests | API endpoints, DB operations, auth, search, browse, thread, delete, terminal, stats, export, import, embeddings, reranker, migration, compaction, config, schemas, SPA, health, ingest, MCP server |
| Frontend unit | vitest | `cd ui && npm test` | 82 tests (12 files) | ResultCard (13), SearchBar (5), useKeyboardNavigation (12), SourceFilterUI (7), PresetButtons (6), DateRangeFilter (5), CopyablePath (5), TimelineSection (4), useTheme (6), dateGroups (9), pathUtils (9), App smoke (1) |
| E2E (browser) | Playwright (Chromium) | `npx playwright test` | 70 CI tests | Full-stack flows: auth, search, browse, filters, path display, relevance, timeline, keyboard nav, export, thread search, delete, open terminal, UI regressions, stats page, dark mode |
| E2E (manual) | Playwright | `npx playwright test tests/e2e/spec/exploratory.spec.ts` | 11 tests | Exploratory tests against a live server (excluded from CI) |
| Extension | webpack build | `cd extension && npm run build` | Build check | TypeScript compilation, bundling |
| Lint | ruff | `uv run ruff check src/ tests/` | - | Python code quality |
| Lint | eslint | `cd extension && npx eslint src/` | - | Extension TypeScript quality |

### CI pipeline (GitHub Actions)

4 jobs run on every push to main:
- `backend-check`: pytest + ruff
- `frontend-check`: npm build (ui)
- `extension-check`: npm build (extension)
- `e2e-tests`: Playwright against auto-launched FastAPI + LanceDB in Docker

### Running tests locally

```bash
# Backend
uv run pytest                           # All 120 tests
uv run pytest tests/test_stats.py -v    # Single file

# E2E (starts server automatically)
npx playwright test                     # All 41 tests
npx playwright test --headed            # Watch in browser
npx playwright test spec/search-flow    # Single spec

# Frontend
cd ui && npm test

# Lint
uv run ruff check src/ tests/
```

## 4. Dev Tools Reference

### Backend
- **Python 3.11+** with **uv** package manager
- **FastAPI** — API framework
- **LanceDB** — Vector database (local, no server)
- **sentence-transformers** — Default embedding backend (bge-m3, 1024d)
- **pytest** + **pytest-asyncio** — Backend testing
- **ruff** — Python linter

### Frontend
- **React 19** + **TypeScript** + **Vite**
- **TanStack Query** — Data fetching
- **Recharts** — Charts (stats dashboard)
- **Tailwind CSS** — Styling
- **vitest** + **@testing-library** — Frontend unit tests

### E2E
- **Playwright** — Browser automation (Chromium)
- Config: `playwright.config.ts`
- Specs: `tests/e2e/spec/*.spec.ts`
- Fixtures: `tests/e2e/fixtures/` (auth helper, test data)
- `exploratory.spec.ts` excluded from CI (hardcoded live server URL)

### Extension
- **Chrome Manifest V3**
- **TypeScript** + **webpack**
- Source: `extension/src/`, Dist: `extension/dist/`
- Load unpacked from `extension/dist/` in Chrome

### Infrastructure
- **GitHub Actions** CI on every push
- **Docker** images published to GHCR (full + slim variants)
- **CalVer** versioning (YYYY.MM.DD)

## 5. Pending Work

### Current state

The core indexing pipeline works well — web chats (ChatGPT, Claude, Gemini, Perplexity) and dev sessions (Claude Code, Cursor) are captured and searchable. The infrastructure is solid: Docker distribution, Chrome extension, daemon installer, CI/CD.

### Known UX problems

The **search and browse experience needs improvement**:

1. **Truncated content** — Search and browse results show a short snippet that's often not enough to recognize the conversation. The text is cut off mid-sentence.
2. **Last message only** — Results show only the last AI message, which doesn't convey what the conversation was about. A conversation about "debugging React hooks" might show a generic "Let me know if you need anything else" as the snippet.
3. **Hard to identify conversations** — Without seeing the user's question or the conversation topic, it's hard to tell conversations apart in search results.

### Pending features to brainstorm

These are areas identified from README goals and real usage. Each needs a brainstorm session before becoming a milestone.

- [x] ~~**Export/import**~~ — Export done in v2.1 (single + bulk). Import deferred.
- [ ] **Multi-device sync** — Optional sync between machines (currently local-only).
- [x] ~~**Better deep links**~~ — Done in v2.3 (Open in Terminal for CLI sessions).
- [x] ~~**Search within threads**~~ — Done in v2.2 (in-thread search with highlighting and dimming).

### v1.9 — Result Context & Readability (complete)

**Phase 29-30: Conversation-level browse + Richer result cards** — Group browse by conversation_id, show message_count and first_user_message, line-clamp adjustments.

**Phase 31: Search result context** — Batch conversation context lookup, highlight matching terms with `<mark>` tags.

### v2.0 — Keyboard Navigation & Quality (complete)

Brainstormed 2026-03-12. Power users need keyboard-driven workflows for fast result navigation.

**Phase 32: Keyboard navigation for search** — Arrow keys navigate results, Enter opens conversation panel, `/` focuses search bar, Esc clears focus. Visual focus ring on active card. `useKeyboardNavigation` hook.

**Phase 33: Frontend component tests** — Vitest tests for ResultCard, SearchBar, SourceFilterUI.

**Status**: Complete. 47 e2e tests + 31 vitest tests pass.

### v2.1 — Export & Data Portability (complete)

Brainstormed 2026-03-12. Users want to save, share, and back up their conversation history.

**Phase 34: Export single conversation as markdown** — Add "Export" button in ConversationPanel that downloads the full thread as a `.md` file. Backend endpoint: `GET /api/v1/thread/{id}/export`.

**Phase 35: Bulk export** — Export all conversations or filtered set as a zip of markdown files. Backend endpoint: `POST /api/v1/export`.

**Status**: Complete. 124 backend + 31 vitest + 51 e2e tests pass.

### v2.2 — In-Thread Search (complete)

Brainstormed 2026-03-12. Users need to find specific messages within long conversation threads.

**Phase 36: In-thread search** — Search input in ConversationPanel header, `highlightText()` marks matching text with `<mark>` tags, `messageMatchesQuery()` filters by word, non-matching messages dimmed with `opacity-30`, match count indicator (e.g. "2/4"), Esc clears search before closing panel.

**Status**: Complete. 124 backend + 31 vitest + 55 e2e tests pass.

### v2.3 — Data Management & Deep Links (complete)

Brainstormed 2026-03-12. Two practical quality-of-life features:
1. Users need to delete unwanted/test conversations from the UI — no current way to do data hygiene.
2. CLI tool deep links (Claude Code, Cursor) should offer "Open in Terminal" instead of just copying the path.

**Phase 37: Delete Conversations** — Backend `DELETE /api/v1/conversations/{id}` endpoint that removes all messages for a conversation_id from LanceDB. UI: delete button in ConversationPanel header with confirmation dialog. Updates browse/search after deletion.

**Phase 38: Open in Terminal for CLI Sessions** — For ResultCard and ConversationPanel, when `url` is a file path (dev sessions), add "Open in Terminal" button that uses a backend endpoint `POST /api/v1/open-terminal` to launch the user's terminal at that directory. macOS: `open -a Terminal <path>`, Linux: `xdg-open` or `xterm`.

**Status**: Complete. 133 backend + 31 vitest + 61 e2e tests pass.

### v2.4 — Dark Mode (complete)

Brainstormed 2026-03-12. Every user benefits from dark mode — it's a polished touch for the open-source repo and reduces eye strain for heavy users.

**Phase 39: Dark Mode Support** — Added `darkMode: 'class'` to Tailwind config. Created `useTheme` hook with localStorage persistence and system preference detection (cycles system → light → dark). Added theme toggle button to NavHeader (Sun/Moon/Monitor icons). Added `dark:` variants to all 12 components: App, SearchPage, BrowsePage, StatsPage, ConversationPanel, ResultCard, SearchBar, SourceFilterUI, PresetButtons, DateRangeFilter, CopyablePath, TimelineSection.

**Status**: Complete. 133 backend + 31 vitest + 61 e2e tests pass.

### v2.5 — Brainstorm (2026-03-12)

**Context:** v2.4 shipped. 39 phases complete. All core features work. Time to address gaps and improve the experience for growing conversation libraries.

**Key findings from codebase review:**
1. **Claude.ai extractor is missing** — README claims "ChatGPT, Claude, Gemini, Perplexity via Chrome extension" but there's no Claude extractor in `extension/src/content/extractors/`. Only ChatGPT, Gemini, Perplexity have extractors. This is the most visible gap.
2. **Known UX problems partially unresolved** — Content snippets are still limited to `line-clamp-3`. Users still struggle with truncated previews.
3. **No organization features** — No way to bookmark, tag, or star conversations. Growing libraries become hard to navigate.
4. **Conversation panel shows raw text** — AI responses contain markdown (code blocks, lists, headers) but render as plain text with `whitespace-pre-wrap`.
5. **No search history** — Users must re-type queries every time.

**Proposed milestone options:**

#### Option A: "Platform Coverage & Polish" (Recommended)
Focus on filling gaps and improving content display.
- Phase 40: Claude.ai web extractor (fix the README promise)
- Phase 41: Markdown rendering in conversation panel (react-markdown)
- Phase 42: Expandable content preview in ResultCard (click to expand snippet)

**Pros:** Fixes the most visible gap (Claude.ai), makes conversations actually readable (markdown), and addresses the known UX problem (truncated snippets).
**Cons:** No organization features (bookmarks/tags).

#### Option B: "Organization"
Focus on managing growing conversation libraries.
- Phase 40: Conversation bookmarks/favorites (star icon, starred filter)
- Phase 41: Conversation title editing
- Phase 42: Search history dropdown (recent queries)

**Pros:** Adds long-requested organization features.
**Cons:** Claude.ai gap persists, content readability unchanged.

#### Option C: "Full Stack Polish"
Mix of coverage, readability, and organization.
- Phase 40: Claude.ai web extractor
- Phase 41: Markdown rendering in conversation panel
- Phase 42: Conversation bookmarks/favorites
- Phase 43: Settings/preferences UI page

**Pros:** Broadest coverage of gaps.
**Cons:** Larger scope, settings page is lower impact.

**Recommendation:** Option A. The Claude.ai extractor is a credibility issue (README claims it works), markdown rendering dramatically improves conversation readability, and expandable previews fix the last known UX problem. These three changes will have the most visible impact for users. Bookmarks can wait for v2.6.

**Phase 40: Claude.ai Web Extractor** — Created `ClaudeExtractor` class in `extension/src/content/extractors/claude.ts` with multiple DOM selector strategies, artifact handling, and code block extraction. Added `claude.ai` to manifest content_scripts matches.

**Phase 41: Markdown Rendering** — Installed `react-markdown` and `@tailwindcss/typography`. Updated MessageBubble to render content as markdown with prose styling. Falls back to plain text with highlighting during in-thread search.

**Phase 42: Expandable Content Preview** — Added expand/collapse toggle to ResultCard content area. Content over 200 chars shows "Show more" button that removes `line-clamp-3`. Click stops propagation to avoid opening the conversation panel.

**Status**: Complete. 133 backend + 31 vitest + 61 e2e tests pass.

### v2.6 — Brainstorm (2026-03-12)

**Context:** v2.5 shipped. Core experience is polished (dark mode, markdown rendering, expandable previews, all platforms covered). Next most impactful area: organization features for users with growing conversation libraries.

**Recommended: "Organization"**
- Phase 43: Conversation bookmarks/favorites — Add `starred` boolean column to LanceDB, star icon on ResultCard and ConversationPanel, "Starred" filter in browse/search. Backend: PATCH endpoint to toggle star.
- Phase 44: Search history dropdown — Store recent queries in localStorage. Show dropdown below search bar with last 10 queries. Click to fill search bar.
- Phase 45: Conversation title editing — Allow users to rename conversation titles from ConversationPanel. Backend: PATCH endpoint to update title.

**Phase 43: Conversation Bookmarks** — Created `useBookmarks` hook with localStorage-based Set<string> storage. Added star icons to ResultCard (next to title) and ConversationPanel (header). Added "Starred (N)" filter button on SearchPage. Wired bookmarks through BrowsePage → TimelineSection → ResultCard.

**Phase 44: Search History** — Created `useSearchHistory` hook storing last 10 queries in localStorage. Added dropdown to SearchBar that appears on focus when input is empty, showing recent queries with individual remove and clear all actions.

**Phase 45: Conversation Title Editing** — Added PATCH `/api/v1/conversations/{id}/title` endpoint. Added inline title editing in ConversationPanel header with pencil icon on hover, Enter to save, Esc to cancel. Invalidates search/browse caches after save.

**Status**: Complete. 133 backend + 31 vitest + 61 e2e tests pass.

### Backlog

- [x] Audit and keep all documentation up to date (PROJECT.md, TESTING.md, README.md, ROADMAP.md, STATE.md)
- [x] Dark mode toggle button not working — Fixed: Tailwind v4 ignores `tailwind.config.js`; added `@custom-variant dark` and `@plugin` directives to `index.css`
- [ ] Multi-device sync
- [ ] Settings/preferences UI page
- [ ] Bulk delete UI
- [ ] Conversation dedup detection

### v3.0 — Active Context (complete)

Brainstormed 2026-03-13. Transform WIMS from a passive archive into an active context provider for AI tools.

**Phase 46: MCP Server** — Created `src/app/mcp_server.py` with FastMCP. Three tools: `search_conversations` (semantic search with platform filter), `get_conversation` (full thread retrieval), `get_recent_conversations` (latest activity). Runs via `python -m src.app.mcp_server` or `wims mcp` CLI command. Fully local, stdio transport.

**Phase 47: WIMS JSON Round-trip** — Added `format: "json"` option to `POST /api/v1/export` returning `wims-archive.json` with full metadata. Added `POST /api/v1/import` endpoint accepting WIMS archive uploads, re-generating embeddings on the target machine. CLI: `wims import file.json`.

**Phase 48: Platform Import** — Added `POST /api/v1/import/chatgpt` (parses `conversations.json` mapping/content structure) and `POST /api/v1/import/claude` (parses `chat_messages` and content arrays). CLI: `wims import --format chatgpt conversations.json` with auto-detection. Added `python-multipart` and `fastmcp` dependencies.

**Status**: Complete. 194 backend + 82 vitest + 70 e2e tests pass.

### Feature Research (2026-03-13)

Comprehensive research conducted with 4 parallel Opus agents across UX, platform expansion, new features, and dev tooling. Full findings below, organized into a proposed roadmap.

#### v3.1 — Search UX

Fix the 3 known UX problems and add power-user search features.

- **Jump-to-match in thread** (P0) — When opening a conversation from search, scroll to and highlight the specific matching message. Currently users must scroll manually through long threads. Pass `matchedMessageId` to ConversationPanel, call `scrollIntoView()`.
- **Smart snippet selection** (P0) — Show the best-matching passage (KWIC — Keyword in Context), not the last AI message. Fixes "Let me know if you need anything else" problem.
- **Question-first card layout** (P0) — Lead ResultCard with the user's question (already available as `first_user_message`). People remember conversations by what they asked.
- **Date range filter on search** (P0) — Reuse existing `DateRangeFilter` component from BrowsePage. Add `date_start`/`date_end` to search API.
- **Search result sorting** (P1) — Toggle: "Best Match" (relevance) vs "Most Recent" (timestamp). Client-side sort, no backend change.
- **Search operators** (P1) — `from:chatgpt`, `before:2026-03-01`, `has:code`. Parse from search input, translate to backend filters. Aligns with keyboard-driven workflow.
- **Result count + timing** (P1) — "Found N results in X ms" above results. `total` field already in API response.
- **Copy individual messages** (P1) — Clipboard icon on hover in ConversationPanel message bubbles.
- **Collapsible messages** (P1) — Collapse long AI responses (>500 chars) in thread view. Similar to existing ResultCard expand/collapse.
- **Prev/next navigation** (P1) — Arrow buttons in ConversationPanel header to jump between search results without closing the panel.
- **Compact card mode** (P1) — Single-line result rows for 3x density. Toggle between detailed and compact views.
- **Bulk selection & actions** (P1) — Checkboxes on result cards, floating action bar for bulk delete/export/bookmark. Addresses backlog item.
- **Empty state suggestions** (P1) — Show recent queries from search history when no results found.

#### v3.2 — Platform Expansion

New Chrome extension extractors and watcher daemon integrations.

**Watcher daemon (file-based):**
| Platform | Stars/Users | Feasibility | Storage format |
|----------|-------------|-------------|----------------|
| Gemini CLI | 97.6k stars | Easy | JSON sessions in `~/.gemini/tmp/*/chats/` |
| Windsurf/Antigravity | $3B acquisition | Medium | Already partially implemented in `antigravity.py` |
| Continue.dev | 31.8k stars, 2.3M installs | Easy | JSON sessions in `~/.continue/sessions/` |
| Cline | 59k stars, 3.3M installs | Medium | JSON tasks in VS Code globalStorage |
| Aider | 41.9k stars, 680k PyPI/mo | Medium | Markdown history `.aider.chat.history.md` per project |
| Qwen Code | 20.5k stars | Easy-Medium | Open-source terminal agent, format TBD |
| Cherry Studio | 41.4k stars | Easy-Medium | Open-source Electron app, local storage |
| Jan.ai | 41k stars | Easy | Offline-first, JSON in `~/jan/` |

**Chrome extension extractors:**
| Platform | Visits/Users | Feasibility | Notes |
|----------|--------------|-------------|-------|
| DeepSeek Chat | 40-60M MAU | Medium | Largest unserved global AI chat, mirrors ChatGPT pattern |
| Microsoft Copilot | 50-80M MAU | Medium | Watch for Shadow DOM (Fluent UI) |
| Le Chat (Mistral) | 5-10M MAU | Easy | Clean React SPA, strong EU/developer audience |
| Poe | 10-20M MAU | Medium | Multi-model users = ideal WIMS audience |
| Doubao | 60M MAU | Medium-Hard | China's #1 AI chat (ByteDance) |
| Grok | 30-50M MAU | Hard | Target grok.com, not x.com |
| Kimi | 20-35M MAU | Medium | kimi.com, strong in China |
| Qwen Chat | 15-30M MAU | Medium | chat.qwen.ai, multiple redirect domains |
| HuggingChat | 2-5M MAU | Easy | Open-source codebase = easy selectors |

**Self-hosted / API integration:**
| Platform | Stars/Users | Feasibility | Notes |
|----------|-------------|-------------|-------|
| Open WebUI | 50k stars | Easy | REST API at `/api/v1/chats`, covers all Ollama/LLM self-hosted users |

**Browser expansion:** Firefox (P2 — privacy-focused audience aligns), Safari (P2 — requires Xcode + App Store), Mobile (defer — consider companion app instead).

#### v3.3 — Smart Organization

Intelligence features that help users navigate growing conversation libraries.

- **Related conversations** (P1) — Vector similarity search from ConversationPanel. Show 3-5 related conversations at panel bottom. New `GET /api/v1/related/{conversation_id}` endpoint.
- **Auto-tagging** (P1) — Extract tags from content: programming languages, frameworks, topics. Keyword-based, no LLM needed. Tags as clickable filter chips.
- **Daily/weekly digest** (P1) — `GET /api/v1/digest?period=today|this_week`. Tier 1 (no LLM): stats + keyword frequency ("12 conversations: 5 Claude Code debugging auth, 4 ChatGPT React hooks"). Tier 2 (optional LLM): prose summary.
- **Obsidian-compatible export** (P1) — Markdown files with YAML frontmatter (title, date, platform, tags). Folder structure by platform. Low effort formatting layer on existing export.
- **Conversation notes** (P2) — Free-text annotations per conversation. Stored in DB, searchable.
- **Pinned conversations** (P2) — Extend bookmarks with persistent top-of-browse pinning.
- **Copy context for new chat** (P2) — Extract key decisions + code snippets from a conversation into LLM-friendly format for pasting into new sessions.
- **Conversation merge** (P2) — Combine multiple conversations on the same topic into a single thread.
- **Share as HTML** (P2) — Export conversation as self-contained HTML file with embedded styling.

#### v3.4 — Dev Foundation

Tooling improvements for maintainability and contributor experience.

- **pytest-cov** (P0) — `--cov=src/app --cov-branch --cov-fail-under=60`. Start at 60%, ratchet up over time.
- **vitest coverage** (P0) — v8 provider, 50% threshold. `npm run test -- --run --coverage`.
- **Dependabot config** (P0) — Create `.github/dependabot.yml` for pip, npm (ui + extension), Docker, GitHub Actions. Grouped PRs to reduce noise.
- **Pyright** (P1) — `typeCheckingMode = "basic"`. Catches type bugs in FastAPI/Pydantic code. Graduate to `standard` after initial cleanup.
- **justfile** (P1) — Unified task runner: `just test-all`, `just lint-all`, `just ci`, `just dev`.
- **Pre-commit hooks** (P1) — ruff format + lint, trailing whitespace, large file check, merge conflict detection.
- **Codecov** (P1) — Coverage badges for README, PR delta comments, trend tracking. Free for open source.
- **Extension unit tests** (P1) — Biggest test gap: 2,200 lines, zero tests. vitest + jest-chrome for mocking `chrome.*` APIs. Target 20-30 initial tests.
- **Devcontainer** (P1) — `.devcontainer/devcontainer.json` for VS Code / GitHub Codespaces. One-click contributor setup.
- **Trivy Docker scanning** (P1) — Scan images before publishing to GHCR. Integrate with GitHub Security tab via SARIF upload.
- **PR/issue templates** (P2) — Bug report YAML template, PR template with test plan checklist.
- **git-cliff changelog** (P2) — Automated release notes from commit messages.

## 6. Lessons Learned

Reflections from each milestone. Mistakes to avoid, patterns that work.

### v1.8 UI Polish (2026-03-08)

**What went well:**
- Phase 27 (thread panel) and Phase 28 (stats dashboard) shipped cleanly in one session
- Comprehensive backend tests caught issues early (16 new tests)

**Mistakes to avoid:**
- `exploratory.spec.ts` hardcodes a live server URL — caused 30+ minutes of CI timeout. Always check that tests can run in CI before pushing. Exclude environment-specific tests from CI config.
- Extension manifest had `"type": "module"` but webpack outputs IIFE — silent service worker failure. When using a bundler, don't declare `"type": "module"` unless the bundler outputs ES modules.
- Extension manifest had `"version": "0.0.0-dev"` — Chrome rejects non-numeric versions. Always use valid Chrome version format (dot-separated integers).
- `role="button"` on ResultCard divs broke Playwright selectors that matched by button name (strict mode found multiple matches). Use specific `aria-label` attributes for testable interactive elements.

**Patterns that work:**
- Visual UI testing with Playwright screenshots catches layout issues automated tests miss
- Fixing e2e selectors with `aria-label` is more robust than relying on text content matching

### v1.9 Result Context & Readability (2026-03-12)

**What went well:**
- Combined Phases 29-30 into one commit (backend + frontend changes are tightly coupled)
- Added `first_user_message` and `message_count` to both browse AND search in the same pass — avoided doing the same pattern twice
- Highlight function is simple and self-contained (no new dependencies)

**Mistakes to avoid:**
- TypeScript `meta` has `[key: string]: unknown` catch-all, so accessing new fields requires casting. When adding new fields to SearchResultMeta backend, also update the frontend TS interface explicitly rather than relying on the catch-all.
- Browse endpoint cursor pagination needed rethinking after grouping by conversation — cursor now uses the latest message per conversation, not individual message IDs. Breaking change for any existing cursor tokens (acceptable since cursors are ephemeral).

**Patterns that work:**
- Grouping messages by conversation in the backend (not frontend) keeps the API clean and reduces data transfer
- Graceful degradation with `try/except pass` for the conversation context query in search — if it fails, results still work, just without context
- `line-clamp-2` for first user message + `line-clamp-3` for content gives good information density without overwhelming the card
- When changing browse from per-message to per-conversation, existing e2e tests with small `limit` values fail because fewer items fit per page. Always increase test limits when changing result granularity.

### v2.0 Keyboard Navigation & Quality (2026-03-12)

**What went well:**
- `useKeyboardNavigation` hook is clean and reusable — 12 unit tests cover all edge cases
- Discovered React 19 `forwardRef` issue immediately via e2e tests — switched to `inputRef` prop
- 31 vitest tests written in one pass, all pass first try

**Mistakes to avoid:**
- `forwardRef` doesn't work reliably in React 19 — use regular props for refs. React 19 passes `ref` as a prop natively, so `forwardRef` wrapper is unnecessary and may cause silent failures.
- Test data from one e2e spec leaks into other specs since the test DB persists. ResultCard `role="button"` with content containing "clear" caused `getByRole('button', { name: 'Clear' })` to match 2 elements. Always use `{ exact: true }` for button name selectors that might collide with result card text content.
- `page.click('body')` and `page.keyboard.press('Tab')` are unreliable for blurring autoFocused inputs. Use `page.evaluate(() => { input.blur(); button.focus(); })` for deterministic focus control in Playwright tests.

**Patterns that work:**
- Keyboard navigation as a separate hook makes it testable independently from UI components
- `inputRef` as a regular prop is simpler and more explicit than `forwardRef`
- `renderHook` from @testing-library/react makes hook tests readable and concise

### v2.1 Export & Data Portability (2026-03-12)

**What went well:**
- Single conversation export implemented entirely in frontend (no backend needed) — uses existing thread data
- Bulk export backend endpoint is clean: one query, group by conversation, zip in memory, stream response
- All 4 backend + 4 e2e tests passed on first attempt after minor platform casing fix

**Patterns that work:**
- Frontend-only export for single conversations (already have the data), backend export for bulk (avoids N API calls)
- `StreamingResponse` with `io.BytesIO` for zip files — no temp files needed
- ConversationPanel has 2 instances (desktop + mobile overlay) — always use `.first()` in e2e selectors

### v2.2 In-Thread Search (2026-03-12)

**What went well:**
- Pure frontend feature — no backend changes needed. Used existing thread data.
- All 4 e2e tests passed on first attempt.

**Patterns that work:**
- Dimming non-matching messages with `opacity-30` preserves conversation context better than hiding
- `highlightText()` with `<mark>` tags is simple and effective
- Match count indicator (`2/4`) provides useful navigation context

### v2.3 Data Management & Deep Links (2026-03-12)

**What went well:**
- LanceDB `table.delete()` works cleanly with SQL-like filter strings
- Delete confirmation dialog with message count provides good UX safety
- `useQueryClient().invalidateQueries()` cleanly refreshes search/browse/stats after deletion

**Mistakes to avoid:**
- Running `npx playwright test` from `ui/` directory instead of project root causes vitest/playwright Symbol clash errors ("Cannot redefine property: Symbol($$jest-matchers-object)"). Always run Playwright from project root.
- Renaming a button label ("Copy Path" → "Copy") breaks e2e selectors across multiple spec files. When modifying shared UI components, grep for the old text in all test files first.
- `uv run pytest` may resolve to system pytest (`/opt/homebrew/bin/pytest`) instead of venv pytest if the venv doesn't have pytest installed. Use `uv pip install pytest` to ensure it's in the venv.

**Patterns that work:**
- `subprocess.Popen` with list args (not shell=True) prevents command injection for the terminal opener
- `Path.expanduser().resolve()` + existence check validates paths safely
- For file paths that might be files instead of directories, fall back to `path.parent` for terminal opening

### v2.4 Dark Mode (2026-03-12)

**What went well:**
- All 12 components updated with `dark:` variants in one pass — no test regressions
- `useTheme` hook is clean: 3 states (system/light/dark), localStorage persistence, system preference listener
- Class-based dark mode (`darkMode: 'class'`) is the right choice — component-level control, no flash of wrong theme

**Patterns that work:**
- Consistent dark palette: `dark:bg-gray-900` (page bg), `dark:bg-gray-800` (cards/panels), `dark:bg-gray-700` (inputs/hover), `dark:border-gray-700` (dividers)
- For colored accent backgrounds, use `/30` opacity variant: `dark:bg-blue-900/30`, `dark:bg-red-900/30`
- Recharts hardcoded colors (hex) work fine in dark mode since they're on white card backgrounds that become `dark:bg-gray-800` — no need to change chart colors
- Theme toggle cycling (system → light → dark) is better than a binary toggle — respects OS preference by default

### v2.5 Platform Coverage & Polish (2026-03-12)

**What went well:**
- Claude.ai extractor follows exact same pattern as existing extractors — consistent architecture pays off
- react-markdown with @tailwindcss/typography prose classes gives good default styling with minimal config
- Expandable previews are simple (useState + conditional line-clamp) but high impact

**Patterns that work:**
- Extension extractors: multiple fallback DOM selectors in priority order. Platforms change their DOM frequently, so having 4-5 selector strategies is essential
- `e.stopPropagation()` on the expand toggle prevents the card click handler from also firing (which would open the conversation panel)
- For markdown rendering, fall back to plain text when search highlighting is active — highlighting markdown source isn't useful
- `@tailwindcss/typography` prose classes work well with dark mode: `prose dark:prose-invert`
- Content length threshold (200 chars) for showing expand button avoids cluttering short results
