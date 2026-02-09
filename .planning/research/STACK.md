# Technology Stack

**Project:** Where Is My Shit (WIMS)
**Researched:** 2026-02-05

## Recommended Stack

### Local Server (The Core)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Python** | 3.12+ | Runtime | Best ecosystem for LLM/Embedding libs (LangChain, LlamaIndex support). Easy LanceDB integration. |
| **FastAPI** | 0.100+ | Web Server | Fast, async (good for proxying API calls), auto-generated Swagger docs for extension dev. |
| **LanceDB** | Latest | Vector Store | Serverless (embedded in app), extremely fast, stores data in files (perfect for local-first), Rust-core speed. |
| **SQLite** | 3.x | Metadata DB | Robust, simple, everywhere. Good for storing relational data (tags, visit history) that doesn't need vector search. |

*Alternative (Node.js):* If team is strong in TS, Node.js + LanceDB (Node bindings) is valid. Python is preferred only due to superior AI/Embedding library maturity.

### Browser Extension
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **React** | 18+ | UI Framework | Component-based UI for search results. Rich ecosystem. |
| **Vite** | Latest | Bundler | Fast builds, easy CRX (Chrome Extension) plugin integration (`@crxjs/vite-plugin`). |
| **Tailwind** | 3.x | Styling | Rapid UI development, scoped styles. |

### Infrastructure / DevOps
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Poetry** | Latest | Python Pkg Mgmt | Better dependency resolution than pip. |
| **Docker** | Optional | Deployment | Can be used to ship the local server, but a native OS binary (via PyInstaller) is better for end-users. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **Vector DB** | **LanceDB** | **Chroma** | Chroma is great but heavier (often requires running a full server process/container). LanceDB is embedded. |
| **Vector DB** | **LanceDB** | **SQLite-vec** | SQLite-vec is very new. LanceDB is purpose-built for multi-modal/large datasets and has better tooling currently. |
| **Server** | **Python/FastAPI** | **Go/Gin** | Go is great for performance, but AI libraries are less mature than Python's. |
| **Server** | **Python/FastAPI** | **Electron** | Electron bundles Chromium, making the download huge (100MB+). A lightweight Python background process + System Tray is lighter. |

## Sources
- [LanceDB Docs](https://lancedb.com/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
