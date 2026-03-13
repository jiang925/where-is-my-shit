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

Completed: v1.0 through v1.8 (28 phases, 64 plans).

## 2. Development Cycle

The workflow is an iterative loop:

```
Brainstorm --> Define Milestone --> Plan Phases --> Execute --> Test --> Ship
    ^                                                                   |
    +-------------------------------------------------------------------+
```

1. **Brainstorm**: Identify pain points from real usage. What's the most impactful thing to build next? Discuss freely before committing to scope.
2. **Define Milestone**: Set a version number, theme, and high-level goals.
3. **Plan Phases**: Break the milestone into phases. Each phase has a goal, success criteria, and plans.
4. **Execute**: Implement plans one at a time. Commit after each plan.
5. **Test**: Run all test layers (see section 3). Fix before moving on.
6. **Ship**: Push to main, verify CI, update ROADMAP.md and STATE.md.

Between milestones, brainstorm the next set of features before writing any code. No milestone should start without a brainstorm session.

## 3. Testing

**Rule: Always test in UI.** Automated tests catch regressions, but visual confirmation in the browser is required for any UI change.

### Test layers

| Layer | Tool | Command | Count | What it covers |
|-------|------|---------|-------|----------------|
| Backend unit/integration | pytest | `uv run pytest` | 120 tests | API endpoints, DB operations, auth, search, browse, thread, stats, embeddings, reranker, migration, compaction |
| Frontend unit | vitest | `cd ui && npm test` | 1 test | React component smoke test (App.test.tsx) |
| E2E (browser) | Playwright (Chromium) | `npx playwright test` | 41 tests | Full-stack flows: auth, search, browse, filters, path display, relevance, timeline, UI regressions |
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

- [ ] **Better result previews** — Show conversation topic/summary instead of truncated last message. Could show first user message, auto-generated title, or AI-summarized snippet.
- [ ] **Frontend test coverage** — Only 1 vitest test exists. Need component tests for SearchPage, BrowsePage, StatsPage, ResultCard, ThreadPanel.
- [ ] **Conversation context in results** — Show a few turns of conversation (user question + AI answer beginning) so results are recognizable at a glance.
- [ ] **Full-text search improvements** — Search within conversation threads, highlight matching terms in results.
- [ ] **Keyboard navigation** — Arrow keys to navigate results, Enter to open, Esc to close panels.
- [ ] **Export/import** — Export conversations as markdown, import from other tools.
- [ ] **Multi-device sync** — Optional sync between machines (currently local-only).
- [ ] **Better deep links** — For CLI tools (Claude Code, Cursor), opening the original session is difficult. Explore launching terminal to the right directory.
- [ ] **Conversation grouping** — Group related messages into logical conversations (currently each message is a separate result).

### Next action

**Brainstorm the next milestone.** Focus on the highest-impact UX improvements:
1. Better result previews (show topic, not truncated tail)
2. Conversation context in search/browse results
3. Frontend test coverage as a foundation for rapid iteration
