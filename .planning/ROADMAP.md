# Roadmap: Where Is My Shit (WIMS)

**Overview:**
A local-first indexing system to recall AI interactions across Web and Dev environments. The roadmap follows a "Brain → Sensor → Interface" execution strategy, ensuring the core storage engine exists before building ingestion sensors, and polishing the UI last.

**Phases:** 4
**Depth:** Quick (Aggressive grouping)
**Status:** Initial Planning

## Phase 1: Core Engine
**Goal:** System can store, embed, and search generic text data via a self-contained local server.

**Status:** Complete

| Requirement | Description |
|-------------|-------------|
| **DEP-01** | Central server packaged as single "All-in-One" Docker image |
| **DEP-02** | Vector DB (LanceDB) embedded within container (no external deps) |
| **DEP-03** | Configuration via environment variables (API keys, paths) |
| **CORE-01** | User can search by semantic meaning (embeddings) |
| **CORE-02** | Index stores content, timestamp, source, and deep link URL |
| **CORE-03** | Results return "Deep Links" to exact message/position |

**Success Criteria:**
1. Docker container starts successfully with no external dependencies (database embedded).
2. API accepts JSON document payload and returns 200 OK.
3. Vector search returns semantically relevant results for manually injected test data.
4. Data persists correctly across container restarts.

## Phase 2: Web Intelligence
**Goal:** Browser history and active chats are automatically indexed in real-time.

| Requirement | Description |
|-------------|-------------|
| **WEB-01** | Browser extension captures ChatGPT conversations |
| **WEB-02** | Browser extension captures Gemini conversations |
| **WEB-03** | Browser extension captures Perplexity conversations |
| **WEB-04** | Extension detects new content and pushes to local server |

**Success Criteria:**
1. Extension installs in Chrome/Edge without policy errors.
2. Visiting ChatGPT/Gemini triggers automatic background data capture.
3. Search index updates within 10 seconds of new chat messages appearing in DOM.
4. Metadata (Deep Link URL, timestamp) is correctly extracted and stored.

## Phase 3: Dev Intelligence
**Goal:** Local development logs and CLI interactions are automatically indexed.

| Requirement | Description |
|-------------|-------------|
| **DEV-01** | Local watcher indexes Claude Code logs from disk |
| **DEV-02** | Local watcher indexes Antigravity logs |
| **DEV-03** | Local watcher indexes Cursor chat logs |

**Success Criteria:**
1. File watcher detects changes in target log directories immediately.
2. New log entries appear in the search index without manual triggers.
3. Parsers correctly extract conversation text from raw log formats (handling JSON/text differences).

## Phase 4: Unified Interface
**Goal:** Users can intuitively search and navigate to specific conversations.

| Requirement | Description |
|-------------|-------------|
| **UI-01** | Standalone Web/App UI (React/Tauri) for searching |
| **UI-02** | Results displayed with source icons and relevance snippets |

**Success Criteria:**
1. Search bar accepts natural language queries and returns sub-second results.
2. Result cards clearly identify source (e.g., "Claude Code" vs "ChatGPT").
3. Clicking a result opens the browser directly to the deep-linked message.

## Progress

| Phase | Status | Completion |
|-------|--------|------------|
| 1. Core Engine | **Complete** | 100% |
| 2. Web Intelligence | Pending | 0% |
| 3. Dev Intelligence | Pending | 0% |
| 4. Unified Interface | Pending | 0% |
