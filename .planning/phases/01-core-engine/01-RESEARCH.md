<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Architecture:** Hybrid Sidecar (Python/FastAPI server + Chrome Extension).
- **Storage:** LanceDB (embedded) for zero-dependency deployment.
- **Search Behavior:**
    - **Ranking strategy:** Hybrid Search (combining semantic embeddings with keyword matching).
    - **Low relevance handling:** Apply a relevance cutoff to filter out noise.
    - **Result grouping:** Group multiple hits from the same conversation.
    - **Pagination:** Configurable limit via API (default 20).
- **Developer Tools:**
    - **Documentation:** Embed Swagger/OpenAPI UI.
    - **Manual Testing:** Include a simple built-in HTML/JS test page.
    - **Health Reporting:** Detailed metrics (DB size, memory, component status).
    - **Logging:** Structured JSON logging.

### Claude's Discretion
- Exact database schema definition.
- Choice of embedding model (e.g., all-MiniLM-L6-v2).
- API endpoint structure and naming.
- Implementation of the "All-in-One" Docker container specifics.

### Deferred Ideas (OUT OF SCOPE)
- None.
</user_constraints>

# Phase 01: Core Engine - Research

**Researched:** 2026-02-05
**Domain:** Local Semantic Search & Vector Storage (Python/FastAPI)
**Confidence:** HIGH

## Summary

This phase implements a standalone, local-first search engine using Python, FastAPI, and LanceDB. The system must run as a single Docker container, handling ingestion of text data, embedding generation, and hybrid retrieval (semantic + keyword).

The research confirms that **FastAPI** coupled with **LanceDB** is the optimal "modern" stack for this. LanceDB runs in-process (no separate DB server), supports hybrid search natively, and integrates well with Python data tools. For embeddings, **all-MiniLM-L6-v2** remains the gold standard for local CPU inference due to its speed/size ratio, though `fastembed` is recommended for lighter runtime dependencies.

**Primary recommendation:** Use `FastAPI` + `LanceDB` + `FastEmbed` (Python library) for a lightweight, zero-dependency container that pre-downloads the model at build time.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Python** | 3.12+ | Runtime | Current stable release with perf improvements. |
| **FastAPI** | 0.109+ | Web Framework | Modern, async, auto-Swagger docs, Pydantic integration. |
| **LanceDB** | 0.5+ | Vector DB | Embedded (serverless), native hybrid search, efficient storage. |
| **FastEmbed** | 0.2+ | Embeddings | Lighter/faster than `sentence-transformers` for inference. |
| **Pydantic** | 2.0+ | Validation | Data validation and serialization (FastAPI default). |
| **Uvicorn** | Standard | ASGI Server | Production-grade ASGI server for FastAPI. |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| **structlog** | Logging | For structured JSON logging requirement. |
| **psutil** | Metrics | For "Detailed Health Reporting" (RAM/CPU usage). |
| **tantivy** | FTS Engine | Used internally by LanceDB for keyword search. |

**Installation:**
```bash
pip install fastapi uvicorn[standard] lancedb fastembed structlog psutil pydantic-settings
```

## Architecture Patterns

### Recommended Project Structure
Modular structure separating API concerns from Core Logic.
```
src/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/   # search.py, health.py, ingest.py
│   │   │   └── router.py    # Router aggregation
│   │   └── dependencies.py  # DB connection, Settings injection
│   ├── core/
│   │   ├── config.py        # Pydantic Settings (Env vars)
│   │   └── logging.py       # Structlog setup
│   ├── db/
│   │   └── client.py        # LanceDB connection/singleton
│   ├── services/
│   │   ├── embedding.py     # Embedding logic
│   │   └── search.py        # Hybrid search & grouping logic
│   ├── schemas/             # Pydantic models (Request/Response)
│   └── main.py              # App entrypoint
├── static/                  # Built-in HTML test page
├── Dockerfile
└── requirements.txt
```

### Pattern 1: Async/Sync Separation
**What:** FastAPI is async, but embedding generation (CPU-bound) and some DB operations can block the event loop.
**Recommendation:** Run embedding generation in a thread pool or use libraries that release the GIL. LanceDB's python client has async support, but CPU-intensive tasks should be offloaded.
**Example:**
```python
# Service layer
from fastembed import TextEmbedding

model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

def generate_embedding(text: str):
    # CPU bound operation
    return list(model.embed([text]))[0]

# Route layer
from fastapi.concurrency import run_in_threadpool

@router.post("/ingest")
async def ingest_doc(doc: Document):
    vector = await run_in_threadpool(generate_embedding, doc.content)
    # ... save to DB
```

### Pattern 2: Hybrid Search & Grouping
**What:** Combining semantic vector search with keyword search (LanceDB `search_type='hybrid'`) and then grouping results by conversation.
**Constraint:** LanceDB returns flat results. Grouping must happen in the application layer.
**Logic:**
1. Retrieve `N` candidates (e.g., 50) via LanceDB hybrid search.
2. Group by `conversation_id`.
3. Select top `K` groups based on max score within group.
4. Return paginated groups.

## Database Schema (Claude's Discretion)

To support the constraints (grouping, deep links, filtering):

**Table: `conversations`**
| Field | Type | Purpose |
|-------|------|---------|
| id | string | UUID/Platform-ID (Primary Key) |
| platform | string | 'claude', 'chatgpt', etc. |
| title | string | Conversation title |
| created_at | timestamp | For date filtering |

**Table: `messages`** (The Vector Table)
| Field | Type | Purpose |
|-------|------|---------|
| id | string | Unique Message ID |
| conversation_id | string | Foreign Key to parent |
| content | string | The actual text (Indexed for FTS) |
| vector | vector(384) | Embedding (Indexed for ANN) |
| role | string | 'user' or 'assistant' |
| timestamp | timestamp | Message time |
| url | string | Deep link to specific message |
| metadata | json | Extra platform-specific data |

*Note: In LanceDB, these can be a single table if denormalized, which is often faster for read-heavy vector workloads. Recommendation: **Single Denormalized Table** for v1 simplicity.*

**Denormalized Schema:**
```python
class Message(LanceModel):
    id: str
    conversation_id: str
    platform: str
    title: str          # Duplicated from convo
    content: str        # func=create_index(fts=True)
    vector: Vector(384) # func=create_index(metric="cosine")
    role: str
    timestamp: datetime
    url: str
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **Embedding Model** | Custom PyTorch code | `fastembed` or `sentence-transformers` | Optimized, quantized, handles tokenization automatically. |
| **FTS Indexing** | Regex/Python filtering | LanceDB FTS (Tantivy) | Much faster, supports boolean operators, stemming. |
| **API Docs** | Custom HTML/Markdown | FastAPI built-in (Swagger) | Automatic, interactive, compliant with OpenAPI spec. |
| **Config Parsing** | `os.environ.get()` | `pydantic-settings` | Type safety, validation, .env file support. |

## Common Pitfalls

### Pitfall 1: Model Download at Runtime
**What:** The Docker container tries to download the embedding model (HuggingFace) on first run.
**Why bad:** Slow startup, fails in air-gapped/offline environments, unpredictable behavior.
**Fix:** Download model during the Docker build phase.
```dockerfile
# Dockerfile
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"
```

### Pitfall 2: Blocking the Event Loop
**What:** Running heavy embedding calculations directly in an `async def` path.
**Impact:** The entire server freezes while processing a large document.
**Fix:** Use `fastapi.concurrency.run_in_threadpool` for embedding generation.

### Pitfall 3: Low-Relevance Noise
**What:** Vector search always returns results (nearest neighbors), even if irrelevant.
**Fix:** Implement the **Relevance Cutoff** decision.
```python
# Filter results with score < threshold (e.g. 0.7)
# Note: Cosine distance: 0 is identical, 1 is opposite.
# LanceDB usually returns distance. Threshold needs to match metric.
```

## Code Examples

### Hybrid Search Implementation
```python
# Source: LanceDB Docs / FastEmbed
import lancedb

async def search_hybrid(query_text: str, limit: int = 20):
    # 1. Generate Query Vector
    query_vector = list(embedding_model.embed([query_text]))[0]

    # 2. Search
    tbl = db.open_table("messages")
    results = tbl.search(query_text, vector=query_vector)\
        .limit(limit)\
        .to_list()

    return results
```

### Detailed Health Check
```python
import psutil
import shutil

@router.get("/health")
def health_check():
    total, used, free = shutil.disk_usage("/")
    return {
        "status": "ok",
        "memory": psutil.virtual_memory()._asdict(),
        "disk": {
            "total_gb": total // (2**30),
            "free_gb": free // (2**30)
        },
        "db_stats": db.open_table("messages").count_rows()
    }
```

## Sources

### Primary (HIGH confidence)
- **FastAPI Documentation** - Project structure, Async patterns.
- **LanceDB Documentation** - Hybrid search API, FTS integration.
- **FastEmbed Repo** - Usage and model caching.

### Secondary (MEDIUM confidence)
- **WebSearch** - "Best local embedding models 2025" (Confirmed all-MiniLM-L6-v2 / BGE-small).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - FastAPI/LanceDB is a proven combination.
- Architecture: HIGH - Standard microservice patterns apply.
- Pitfalls: MEDIUM - Specific LanceDB edge cases (versioning) might appear.

**Research date:** 2026-02-05
