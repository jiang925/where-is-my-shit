# Phase 05 Research: Quality & CI/CD

## 1. Current State Analysis

### Backend (`src/`)
*   **Framework:** FastAPI
*   **Dependencies:** defined in `requirements.txt`
*   **Testing Status:** No testing framework installed (missing `pytest`). No tests exist.
*   **Linting Status:** No linter installed (missing `ruff`).
*   **CI/CD:** No existing workflows.

### Frontend (`ui/`)
*   **Framework:** React + Vite + TypeScript
*   **Dependencies:** `eslint` is present.
*   **Testing Status:** No testing framework installed (missing `vitest`).
*   **Linting Status:** `eslint` configured (`eslint.config.js` exists).
*   **CI/CD:** No existing workflows.

### Extension (`extension/`)
*   **Framework:** TypeScript + Webpack
*   **Dependencies:** Basic build deps only.
*   **Testing Status:** No testing framework.
*   **Linting Status:** No linter configured in `package.json`.

## 2. Gap Analysis

| Requirement | Current Status | Missing Action Items |
|-------------|----------------|----------------------|
| **CI-01** (Backend Tests) | Not Started | Install `pytest`, `httpx`. Create `tests/` folder. Create GitHub Action. |
| **CI-02** (FE/Ext Build & Lint) | Partial | **UI:** `lint` exists. `build` exists. **Ext:** `build` exists. Need to add linting to Extension. Create GitHub Action. |
| **CI-03** (Style Enforcement) | Partial | **UI:** Has ESLint. **Backend:** Needs `ruff`. **Ext:** Needs ESLint. |
| **TEST-01** (Backend Unit Tests) | Not Started | Write tests for Embedding and DB services. |
| **TEST-03** (Frontend Unit Tests) | Not Started | Install `vitest`, `jsdom`, `@testing-library/react`. Write component tests. |

## 3. Implementation Plan

### Step 1: Backend Quality Infrastructure
1.  Update `requirements.txt` with dev dependencies:
    *   `pytest`
    *   `ruff`
    *   `httpx` (for API testing)
2.  Create `pyproject.toml` or `ruff.toml` for configuration.
3.  Create `tests/` directory structure.

### Step 2: Frontend Quality Infrastructure (`ui/`)
1.  Install dev dependencies:
    *   `vitest`
    *   `jsdom`
    *   `@testing-library/react`
    *   `@testing-library/dom`
2.  Create `vite.config.ts` update (or separate `vitest.config.ts`) to enable testing.
3.  Add `test` script to `package.json`.

### Step 3: Extension Quality Infrastructure (`extension/`)
1.  Install `eslint` and config.
2.  Add `lint` script to `package.json`.

### Step 4: GitHub Actions (`.github/workflows/ci.yml`)
Create a single workflow with three parallel jobs:

1.  **Backend:**
    *   Setup Python.
    *   Install dependencies.
    *   Run `ruff check .` (Linting).
    *   Run `ruff format --check .` (Formatting).
    *   Run `pytest` (Testing).

2.  **Frontend:**
    *   Setup Node.
    *   Install dependencies (`ui/`).
    *   Run `npm run lint`.
    *   Run `npm run test` (once Vitest is set up).
    *   Run `npm run build` (verify build passes).

3.  **Extension:**
    *   Setup Node.
    *   Install dependencies (`extension/`).
    *   Run `npm run build`.

## 4. Technology Selection (Confirmed)
*   **Backend Linting:** `ruff` (Fast, replaces Black/Isort/Flake8).
*   **Backend Testing:** `pytest`.
*   **Frontend Testing:** `vitest` (Native Vite integration, Jest-compatible).
*   **CI Provider:** GitHub Actions.

## 5. Risks & Mitigation
*   **Risk:** Extension build might be tricky in CI if it depends on browser APIs.
    *   *Mitigation:* Webpack build usually just bundles code; if it doesn't run the code, it should be fine.
*   **Risk:** Frontend tests might require mocking backend API.
    *   *Mitigation:* Use Vitest mocking for API calls.

## 6. Actionable Tasks (for implementation phase)
1.  [ ] Setup Backend: Install `ruff`, `pytest`. Create config.
2.  [ ] Setup Frontend: Install `vitest`.
3.  [ ] Create CI Workflow `.github/workflows/ci.yml`.
4.  [ ] Write initial Backend tests (Skeleton + DB connection).
5.  [ ] Write initial Frontend tests (App component render).
