# Requirements: Where Is My Shit (WIMS)

**Defined:** 2026-02-05
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Ingestion: Web
- [ ] **WEB-01**: Browser extension captures ChatGPT conversations (content + metadata)
- [ ] **WEB-02**: Browser extension captures Gemini conversations
- [ ] **WEB-03**: Browser extension captures Perplexity conversations
- [ ] **WEB-04**: Extension detects new content and pushes to local server (real-time/near real-time)

### Ingestion: Dev
- [ ] **DEV-01**: Local watcher indexes Claude Code logs from disk
- [ ] **DEV-02**: Local watcher indexes Antigravity logs
- [ ] **DEV-03**: Local watcher indexes Cursor chat logs

### Core Search
- [ ] **CORE-01**: User can search by semantic meaning (embeddings)
- [ ] **CORE-02**: Index stores conversation content, timestamp, source, and deep link URL
- [ ] **CORE-03**: Results return "Deep Links" to exact message/scroll position where possible

### Interface
- [ ] **UI-01**: Standalone Web/App UI (React/Tauri) for searching
- [ ] **UI-02**: Results displayed with source icons and relevance snippets

### Deployment
- [ ] **DEP-01**: Central server packaged as a single "All-in-One" Docker image
- [ ] **DEP-02**: Vector DB (LanceDB) embedded/packaged within the same Docker container (no external service dependencies)
- [ ] **DEP-03**: Configuration via environment variables (API keys for embeddings, paths)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Providers
- **PROV-01**: Claude.ai support (deferred per user selection)
- **PROV-02**: Local Markdown file ingestion

### Advanced Search
- **ADV-01**: Keyword-specific search (exact match)
- **ADV-02**: Date range filters
- **ADV-03**: Source filters
- **ADV-04**: Conversation grouping in results

### Integration
- **INT-01**: MCP Server interface for querying from inside AI tools

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| **Chat with Data (RAG)** | v1 focus is on *recall* (finding the chat), not Q&A. |
| **Write-back** | We index *from* platforms, we don't write *back* to them (read-only). |
| **Bi-directional Sync** | Complexity; source of truth remains the original platform. |
| **Cloud Vector DB** | Privacy requirement: Data stays local/self-hosted. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WEB-01 | Phase 2 | Pending |
| WEB-02 | Phase 2 | Pending |
| WEB-03 | Phase 2 | Pending |
| WEB-04 | Phase 2 | Pending |
| DEV-01 | Phase 3 | Pending |
| DEV-02 | Phase 3 | Pending |
| DEV-03 | Phase 3 | Pending |
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Complete |
| CORE-03 | Phase 1 | Complete |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| DEP-01 | Phase 1 | Complete |
| DEP-02 | Phase 1 | Complete |
| DEP-03 | Phase 1 | Complete |

---
*Requirements defined: 2026-02-05*
