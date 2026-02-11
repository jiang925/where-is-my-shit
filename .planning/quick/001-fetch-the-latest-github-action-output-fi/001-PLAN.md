---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/core/config.py
  - src/app/main.py
  - src/cli.py
  - tests/core/test_auth.py
  - ui/src/App.test.tsx
  - extension/src/popup/popup.ts
autonomous: true

must_haves:
  truths:
    - "uv run ruff check . passes with zero errors"
    - "npm run lint passes in ui/ directory"
    - "npm run test -- --run passes in ui/ directory"
    - "npm run lint passes in extension/ directory"
  artifacts:
    - path: "src/app/core/config.py"
      provides: "Clean config without unnecessary mode args"
    - path: "ui/src/App.test.tsx"
      provides: "Working test that matches current App component"
    - path: "extension/src/popup/popup.ts"
      provides: "Clean TS without unused imports/variables"
  key_links: []
---

<objective>
Fix all CI failures on main branch: Python ruff lint errors, frontend test failure, and extension lint warnings.

Purpose: Get CI green on main so future PRs have a clean baseline.
Output: All three CI jobs (backend-check, frontend-check, extension-check) pass.
</objective>

<execution_context>
@/home/pter/.claude/get-shit-done/workflows/execute-plan.md
@/home/pter/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.github/workflows/ci.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Python ruff lint errors</name>
  <files>src/app/core/config.py, src/app/main.py, src/cli.py, tests/core/test_auth.py</files>
  <action>
Run `uv run ruff check --fix .` to auto-fix all 5 ruff errors:

1. `src/app/core/config.py` lines 93 and 110: Remove unnecessary `"r"` mode argument from `open()` calls (UP015)
2. `src/app/main.py` line 32: Remove extraneous `f` prefix from f-string with no placeholders (F541)
3. `src/cli.py` line 4: Remove unused import `pathlib.Path` (F401)
4. `tests/core/test_auth.py` line 1: Fix import sorting (I001)

Then run `uv run ruff format --check .` and fix any formatting issues with `uv run ruff format .`.

Then run `uv run pytest` to confirm tests still pass.
  </action>
  <verify>`uv run ruff check .` exits 0 AND `uv run ruff format --check .` exits 0 AND `uv run pytest` exits 0</verify>
  <done>All Python lint and format checks pass, tests pass</done>
</task>

<task type="auto">
  <name>Task 2: Fix frontend test and extension lint warnings</name>
  <files>ui/src/App.test.tsx, extension/src/popup/popup.ts</files>
  <action>
**Frontend test fix (ui/src/App.test.tsx):**
The test expects a `textbox` role but the App component now shows an `ApiKeyPrompt` first (since no localStorage key exists in test env). The input is `type="password"` which does NOT have the `textbox` role -- password inputs have no implicit ARIA role.

Fix the test to match the current App behavior:
- The initial render shows ApiKeyPrompt with an API Key password input
- Query by `screen.getByLabelText('API Key')` or `screen.getByPlaceholderText('sk-wims-...')` instead of `getByRole('textbox')`
- Update the test description to reflect what it actually tests (e.g., "renders api key prompt when not authenticated")

**Extension lint fix (extension/src/popup/popup.ts):**
Two warnings from the CI annotations:
1. Line 20: `mainContent` is assigned but never used -- prefix with underscore `_mainContent` or remove the declaration entirely (the variable is not referenced anywhere in the file)
2. Line 1: `setSettings` is imported but never used -- remove `setSettings` from the import, keeping only `getSettings`

Run `cd ui && npm run lint && npm run test -- --run` and `cd extension && npm run lint && npm run build` to verify.
  </action>
  <verify>`cd ui && npm run lint && npm run test -- --run` exits 0 AND `cd extension && npm run lint && npm run build` exits 0</verify>
  <done>Frontend tests pass, extension builds with no lint warnings</done>
</task>

</tasks>

<verification>
Run full CI check locally:
```bash
uv run ruff check . && uv run ruff format --check . && uv run pytest
cd ui && npm run lint && npm run test -- --run && npm run build
cd extension && npm run lint && npm run build
```
All commands exit 0.
</verification>

<success_criteria>
- All 5 Python ruff errors resolved
- Frontend test passes with updated assertions matching ApiKeyPrompt component
- Extension lint warnings for unused import and variable resolved
- Full local CI simulation passes
</success_criteria>

<output>
After completion, create `.planning/quick/001-fetch-the-latest-github-action-output-fi/001-SUMMARY.md`
</output>
