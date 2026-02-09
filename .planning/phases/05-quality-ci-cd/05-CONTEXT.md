# Phase 5: Quality & CI/CD - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated pipelines prevent regression and ensure code quality. Focus on setting up GitHub Actions, Unit Tests (Pytest/Vitest), and Linting (Ruff/ESLint).

</domain>

<decisions>
## Implementation Decisions

### CI Workflow Strategy
- **Trigger:** Run on Pull Requests and Main branch only (save resources).
- **Platforms:** Linux environment only (Production target).
- **Failure Behavior:** Run all tests even if one fails (comprehensive feedback).
- **Artifacts:** Verify code only; do not build/upload artifacts for every build.

### Test Environment & Data
- **Database:** Use TestContainers for realistic Postgres integration testing.
- **Coverage Gate:** Hard failure if coverage drops below 80%.

### Claude's Discretion
- **LLM Mocking:** Strategy for OpenAI/Ollama calls (likely VCR or simple mocks).
- **Data Seeding:** Fixtures vs static files for test data.
- **Vector DB:** Whether to spin up Qdrant in CI or mock the client.
- **Linting Strictness:** Balance between strictness and developer velocity.
- **Formatting:** Auto-fix vs fail-and-instruct.
- **Local Enforcement:** Pre-commit hooks usage.

</decisions>

<specifics>
## Specific Ideas

- "TestContainers" explicitly requested for DB interactions.
- Hard gate on >80% coverage to ensure "stable engineering product" goal.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-quality-ci-cd*
*Context gathered: 2026-02-07*
