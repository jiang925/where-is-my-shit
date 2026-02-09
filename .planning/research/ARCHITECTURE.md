# Architecture Patterns

**Domain:** Local-First Personal Search Engine
**Researched:** 2026-02-05

## Recommended Architecture

The "Sidecar" pattern is recommended. The Browser Extension is a transient interface; the Local Server is the persistent brain.

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Environment                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐      ┌──────────────┐     ┌─────────────┐ │
│  │ Content      │      │ Popup /      │     │ Background  │ │
│  │ Script       │      │ Side Panel   │     │ Service     │ │
│  │ (Scraper)    │      │ (Search UI)  │     │ Worker      │ │
│  └──────┬───────┘      └──────┬───────┘     └──────┬──────┘ │
│         │                     │                    │        │
├─────────┼─────────────────────┼────────────────────┼────────┤
│         │ (Messaging)         │ (HTTP/WS)          │        │
│         ▼                     ▼                    ▼        │
├─────────────────────────────────────────────────────────────┤
│                        Local Server                         │
│                    (localhost:port)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐      ┌──────────────┐     ┌─────────────┐ │
│  │ API Gateway  │◄────►│ Ingest Queue │────►│ Vectorizer  │ │
│  │ (Auth/Rate)  │      │ (Job Mgmt)   │     │ (Cloud API) │ │
│  └──────┬───────┘      └──────┬───────┘     └──────┬──────┘ │
│         │                     │                    │        │
│         ▼                     ▼                    ▼        │
│  ┌──────────────┐      ┌──────────────┐     ┌─────────────┐ │
│  │  Metadata    │      │  Vector DB   │     │ File Store  │ │
│  │  (SQLite)    │      │  (LanceDB)   │     │ (Raw HTML)  │ │
│  └──────────────┘      └──────────────┘     └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Extension** | Capture current page, Display search results, Detect user context. | Local Server (via HTTP/WS) |
| **Local Server** | API endpoint, Auth, Data processing, Embedding generation, Storage. | Extension, Cloud APIs (OpenAI/Anthropic), Local DB |
| **Dev Watchers** | File system monitoring (optional module of server). | Local Server Core |

### Data Flow

#### 1. Ingest Flow (Capture)
```
[User visits page]
    ↓
[Content Script] extracts text/metadata
    ↓
[Background Worker] sanitizes & batches
    ↓ (HTTP POST /ingest)
[Local Server] → [Ingest Queue]
    ↓
[Vectorizer] chunks text → Calls Cloud API for Embeddings
    ↓
[Vector DB] stores vectors + [SQLite] stores metadata
```

#### 2. Search Flow (Query)
```
[User types in Extension Popup]
    ↓ (HTTP GET /search?q=...)
[Local Server] receives query
    ↓
[Vectorizer] embeds query string (Cloud API)
    ↓
[Vector DB] performs similarity search (ANN)
    ↓
[Local Server] re-ranks/formats results
    ↓
[Extension] renders results list
```

## Recommended Build Order

1.  **Local Server (The Foundation)**
    *   Why: You cannot test the extension's data sending capabilities without a receiver. The server defines the data schema.
    *   Focus: API endpoints, Database setup, Embedding pipeline.

2.  **Extension (The Sensor)**
    *   Why: Depends on Server API.
    *   Focus: Capture logic, Authentication handshake, Search UI.

3.  **Dev Watchers (The Expander)**
    *   Why: Independent modules that feed the existing Server API.

## Architectural Patterns

### Pattern 1: Optimistic Local State (Extension)
**What:** The extension UI should not wait for the server for every keystroke.
**When to use:** Search bar typing.
**Trade-offs:** Fast UI vs potential stale data.

### Pattern 2: Queued Ingestion
**What:** Server accepts ingest requests immediately (`202 Accepted`) and processes embedding in background.
**When to use:** All ingest operations. Embedding is slow (network call); browser extension expects fast response.
**Trade-offs:** User might not see "just added" page in search results for a few seconds.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **< 10k docs** | **SQLite + LanceDB** on local disk is instant. Simple naive chunking. |
| **> 100k docs** | **FTS (Full Text Search)** becomes critical to filter before Vector Search. Hybrid Search (Keyword + Vector) needed for accuracy. |

## Sources
- [Local-First Architecture Patterns](https://localfirstweb.dev/)
- [LanceDB Architecture](https://lancedb.com/)
- [Chrome Extension Architecture](https://developer.chrome.com/docs/extensions/mv3/architecture-overview/)
