# Phase 1: Core Engine - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A Dockerized REST API wrapping LanceDB for local semantic search. This phase delivers the storage and retrieval engine. Ingestion (sensors) and the full User Interface are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Search Behavior
- **Ranking strategy:** Hybrid Search (combining semantic embeddings with keyword matching) for best recall.
- **Low relevance handling:** Apply a relevance cutoff to filter out noise; do not return low-confidence matches.
- **Result grouping:** Group multiple hits from the same conversation together to provide context.
- **Pagination:** Default to 20 results, but make the limit configurable via API query parameters (to support autoscroll/loading more).

### Developer Tools
- **Documentation:** Embed Swagger/OpenAPI UI for interactive API documentation.
- **Manual Testing:** Include a simple built-in HTML/JS test page to run queries manually without needing external tools.
- **Health Reporting:** Provide detailed metrics (DB size, memory usage, component status) rather than a simple up/down check.
- **Logging:** Use structured JSON logging to support machine parsing and production monitoring.

### Claude's Discretion
- Exact database schema definition (beyond core fields).
- Choice of embedding model (e.g., all-MiniLM-L6-v2 or similar lightweight model).
- API endpoint structure and naming.
- Implementation of the "All-in-One" Docker container specifics.

</decisions>

<specifics>
## Specific Ideas

- The user specifically requested that the result count be configurable or support autoscroll logic, rather than a hardcoded fixed number.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within the scope of the Core Engine.

</deferred>

---

*Phase: 01-core-engine*
*Context gathered: 2026-02-05*
