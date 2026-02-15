# Phase 19: Embedding Model Upgrade & DB Maintenance - Research

**Researched:** 2026-02-14
**Domain:** Embedding model migration, vector database maintenance, Python async/threading
**Confidence:** MEDIUM-HIGH

## Summary

Phase 19 involves upgrading the embedding pipeline from bge-small-en-v1.5 (384d) to bge-m3 (1024d) with multiple backend support, implementing periodic LanceDB compaction, and creating a reusable migration promotion system. The research reveals that sentence-transformers provides the most mature ecosystem for model loading and inference, ONNX optimization via Optimum is straightforward but adds complexity, and LanceDB compaction requires careful concurrency handling due to blocking operations.

The key architectural challenge is managing non-blocking background operations (compaction, migration) in a single-user FastAPI application without affecting API responsiveness. The existing provider abstraction is well-designed and can accommodate the new backends with minimal changes. Migration promotion (v2→v1) is feasible using LanceDB's versioning system as a safety net.

**Primary recommendation:** Implement sentence-transformers as the default provider for bge-m3, keep fastembed for backward compatibility, use threading.Lock for compaction concurrency control, and leverage LanceDB's automatic versioning for safe migration promotion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Compaction behavior:**
- Trigger on **both startup and write counter threshold** (compact on server start, then again after every N writes)
- Concurrency: Claude's discretion on skip-silently vs queue (simplest safe approach)
- **Non-blocking**: compaction runs in background thread, API continues serving. Must ensure UX is not affected — if LanceDB has table-level locks during compaction, handle gracefully (e.g., short retry or queue reads)
- **Log lines only** for feedback: structlog messages for "compaction started" and "compaction complete (X fragments merged)"

**Provider config UX:**
- **Same flat config structure** with new provider name values: `provider: "sentence-transformers"`, `provider: "onnx"`, `provider: "openai"`
- **Auto-download on startup**: if model not cached locally, download from HuggingFace automatically with log progress
- FastEmbed fate: Claude's discretion on whether to keep or deprecate (evaluate what fastembed uniquely offers vs the new providers)
- External API config fields: `base_url`, `model`, `api_key` (optional), `timeout`, `batch_size`

**Migration promotion flow:**
- **Auto-promote**: when all rows have vector_v2 populated, automatically promote (copy v2->v1, drop v2 column). No separate promote command needed.
- Old vectors: Claude's discretion (overwrite vs temporary backup — pragmatic approach)
- **Resumable**: use existing `vector_v2 IS NULL` check to find unprocessed rows. No extra state tracking needed.
- **Auto-resume on server startup**: if server detects incomplete migration (some rows have v2, some don't), spawn background re-embedding at low priority. Single-user tool, resource contention is minimal.
- Reusable pattern: after promotion, v2 column is dropped. Next model change creates a fresh v2 column — same mechanism every time, never v3/v4/v5.

**OllamaProvider rename:**
- **No backward compatibility needed** — no external users have deployed this tool yet, and current setup uses local model
- Config provider name: `"openai"` — short, recognizable, represents the OpenAI embedding API format
- Internal class: `OpenAICompatibleProvider` implementing `ExternalAPIProvider` base class
- File structure: Claude's discretion (same file vs separate based on size/conventions)

### Claude's Discretion
- Compaction write counter threshold value (e.g., 50, 100, 200 writes)
- Concurrency handling for overlapping compaction triggers (skip or queue)
- Whether to keep FastEmbed provider alongside new ones or deprecate
- Old vector handling during promotion (overwrite vs backup)
- ExternalAPIProvider file organization (same file vs split)
- ONNX quantization config defaults
- LanceDB lock behavior during compaction — research and handle appropriately

### Deferred Ideas (OUT OF SCOPE)
- Bulk/batch embedding API support (OpenAI Batch API with 24h SLA)
- Additional external provider protocols beyond OpenAI-compatible
- Dynamic rate limiting that adapts to 429 responses

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sentence-transformers | >=2.2.0 | PyTorch-based embedding generation | Industry standard for loading HuggingFace models, mature API, automatic caching, built-in dimension detection |
| lancedb | >=0.5.0 | Vector database with compaction | Already in use, provides ACID-compliant schema evolution, automatic versioning for migration safety |
| pyarrow | (via lancedb) | Schema operations for column manipulation | Required by LanceDB, provides efficient table operations |
| structlog | >=24.1.0 | Structured logging | Already in use, excellent for background task logging |
| openai | >=1.0.0 | OpenAI-compatible API client | Already in use, supports multiple endpoints via base_url |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| optimum[onnxruntime] | >=1.16.0 | ONNX model export and inference | Optional: For users wanting faster CPU inference (~5-10x speedup) |
| huggingface_hub | (via sentence-transformers) | Model download with progress tracking | Auto-included, handles HuggingFace authentication |
| fastembed | >=0.2.0 | Lightweight embedding library | Keep for backward compatibility, deprecate in future phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sentence-transformers | transformers + manual pooling | More control but much more boilerplate, no automatic caching |
| ONNX via Optimum | fastembed ONNX backend | Fastembed doesn't support bge-m3, limited model selection |
| threading.Thread | asyncio.Task + to_thread() | More idiomatic for FastAPI but adds complexity, threading is simpler for blocking I/O |
| Manual write counter | APScheduler | Overkill for simple periodic task, adds dependency |

**Installation:**
```bash
# Core dependencies (already have lancedb, openai, structlog)
pip install sentence-transformers>=2.2.0

# Optional ONNX support
pip install optimum[onnxruntime]>=1.16.0

# Already in pyproject.toml:
# lancedb>=0.5.0
# openai>=1.0.0
# structlog>=24.1.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/services/providers/
├── __init__.py
├── base.py                          # EmbeddingProvider ABC (existing)
├── fastembed_provider.py            # Keep for backward compatibility
├── sentence_transformer_provider.py # New: PyTorch backend
├── onnx_provider.py                 # New: ONNX Runtime backend
└── external_api_provider.py         # New: Base for OpenAI-compatible APIs
    ├── ExternalAPIProvider (ABC)
    └── OpenAICompatibleProvider

src/app/db/
├── client.py                        # Add compaction management
├── migration.py                     # Extend with auto-promotion
└── compaction.py                    # New: Background compaction manager
```

### Pattern 1: Provider Factory with Auto-Download
**What:** Factory function that instantiates providers and triggers model download on first use
**When to use:** On application startup when EmbeddingService initializes
**Example:**
```python
# Source: sentence-transformers documentation + existing pattern
from sentence_transformers import SentenceTransformer

class SentenceTransformerProvider(EmbeddingProvider):
    def __init__(self, model_name: str = "BAAI/bge-m3"):
        self._model_name = model_name
        # Auto-downloads from HuggingFace Hub with caching
        # Progress shown via logging if not already cached
        self._model = SentenceTransformer(model_name)

        # Probe dimensions by encoding test string
        test_embedding = self._model.encode("test", show_progress_bar=False)
        self._dimensions = len(test_embedding)

    def embed(self, texts: list[str]) -> list[list[float]]:
        # Returns numpy arrays, convert to lists
        embeddings = self._model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()

    def get_dimensions(self) -> int:
        return self._dimensions

    def get_model_name(self) -> str:
        return self._model_name
```

### Pattern 2: Thread-Safe Background Compaction
**What:** Background thread with lock-based concurrency control for periodic compaction
**When to use:** Start on FastAPI lifespan startup, shutdown gracefully on app termination
**Example:**
```python
# Source: Gemini research on FastAPI + threading patterns
import threading
import structlog
from contextlib import asynccontextmanager

logger = structlog.get_logger()

class CompactionManager:
    def __init__(self, table, write_threshold: int = 100):
        self.table = table
        self.write_threshold = write_threshold
        self.write_counter = 0
        self._counter_lock = threading.Lock()
        self._compaction_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = None

    def record_write(self, count: int = 1):
        """Thread-safe write counter increment"""
        with self._counter_lock:
            self.write_counter += count

    def _should_compact(self) -> bool:
        with self._counter_lock:
            if self.write_counter >= self.write_threshold:
                self.write_counter = 0
                return True
            return False

    def _compact(self):
        """Attempt compaction with non-blocking lock"""
        if not self._compaction_lock.acquire(blocking=False):
            logger.info("compaction_skipped", reason="already_running")
            return

        try:
            logger.info("compaction_started")
            fragment_count_before = len(self.table.list_fragments())

            # Blocking operation - runs in dedicated thread
            self.table.compact_files()

            fragment_count_after = len(self.table.list_fragments())
            merged = fragment_count_before - fragment_count_after
            logger.info("compaction_complete", fragments_merged=merged)
        except Exception as e:
            logger.error("compaction_failed", error=str(e))
        finally:
            self._compaction_lock.release()

    def run(self):
        """Main loop for background thread"""
        # Compact on startup
        self._compact()

        while not self._stop_event.is_set():
            # Check every 10 seconds
            if self._stop_event.wait(10):
                break

            if self._should_compact():
                self._compact()

    def start(self):
        self._thread = threading.Thread(target=self.run, daemon=True, name="CompactionThread")
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)

# FastAPI integration
@asynccontextmanager
async def lifespan(app: FastAPI):
    compaction_mgr.start()
    yield
    compaction_mgr.stop()
```

### Pattern 3: Migration Promotion with Versioning Safety
**What:** Automatic v2→v1 column promotion after migration completes, using LanceDB versioning as rollback
**When to use:** After `reembed_batch()` detects no remaining NULL vector_v2 rows
**Example:**
```python
# Source: LanceDB documentation + Gemini research
import pyarrow as pa

def promote_migration(table) -> None:
    """
    Promote vector_v2 to vector_v1 (primary column).
    LanceDB automatic versioning provides rollback capability.
    """
    logger.info("migration_promotion_starting")

    # LanceDB versioning: this operation creates a new version
    # Old version with separate columns is still accessible via checkout()

    # Step 1: Read current table schema
    schema = table.schema

    # Step 2: Read table to PyArrow
    arrow_table = table.to_arrow()

    # Step 3: Replace vector column with vector_v2 data
    v2_data = arrow_table['vector_v2']
    updated_table = arrow_table.drop(['vector'])
    updated_table = updated_table.add_column(0, 'vector', v2_data)

    # Step 4: Drop vector_v2 and embedding_model_v2 columns
    updated_table = updated_table.drop(['vector_v2', 'embedding_model_v2'])

    # Step 5: Overwrite table (atomic operation, creates new version)
    table._conn.create_table(
        table.name,
        updated_table,
        mode="overwrite"
    )

    logger.info("migration_promotion_complete")
```

### Pattern 4: ONNX Export (Optional)
**What:** Export sentence-transformers model to ONNX format for faster inference
**When to use:** One-time setup for users who want optimized CPU performance
**Example:**
```python
# Source: Optimum documentation
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

# One-time export
model_id = "BAAI/bge-m3"
onnx_path = "./models/bge-m3-onnx"

# Export to ONNX with optimization
ort_model = ORTModelForFeatureExtraction.from_pretrained(
    model_id,
    export=True
)
tokenizer = AutoTokenizer.from_pretrained(model_id)

ort_model.save_pretrained(onnx_path)
tokenizer.save_pretrained(onnx_path)

# Then in ONNXProvider:
from optimum.onnxruntime import ORTModelForFeatureExtraction
import torch

class ONNXProvider(EmbeddingProvider):
    def __init__(self, model_path: str):
        self._model = ORTModelForFeatureExtraction.from_pretrained(model_path)
        self._tokenizer = AutoTokenizer.from_pretrained(model_path)
        # Probe dimensions
        test = self._tokenizer("test", return_tensors="pt")
        output = self._model(**test)
        self._dimensions = output.last_hidden_state.shape[-1]
```

### Anti-Patterns to Avoid
- **Running compaction in asyncio event loop:** LanceDB compact_files() is blocking I/O, would freeze FastAPI server
- **Storing migration state in config file:** Increases complexity, LanceDB versioning + NULL checks are sufficient
- **Creating v3/v4/v5 columns:** Breaks reusability, always reuse v2 column name after promotion
- **Using BackgroundTasks for persistent processes:** FastAPI BackgroundTasks are for post-request cleanup, not long-running services
- **Downloading models synchronously on first request:** Causes timeout, download should happen at startup

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model download with caching | Custom download + cache management | sentence-transformers built-in caching | Handles HuggingFace auth, progress bars, concurrent downloads, cache invalidation |
| Embedding pooling strategies | Manual mean/CLS token pooling | SentenceTransformer.encode() | Handles model-specific pooling (some use CLS, some mean), normalization, padding |
| Thread-safe counters | Manual mutex + counter | threading.Lock + with context manager | Easy to get wrong, with statement guarantees lock release even on exception |
| Rate limiting with backoff | Custom sleep + retry logic | Existing `--delay` flag + time.sleep() | Simple and sufficient for single-user tool, exponential backoff overkill |
| ONNX quantization | Manual quantization via PyTorch | Optimum ORTQuantizer | Handles operator support detection, quantization config validation, fallback strategies |

**Key insight:** Embedding models have complex preprocessing (tokenization, special tokens, attention masks) and postprocessing (pooling, normalization). sentence-transformers encapsulates 5+ years of research on best practices. Don't rebuild this.

## Common Pitfalls

### Pitfall 1: Dimension Mismatch in Migration
**What goes wrong:** Existing vector column is 384d, new model produces 1024d, schema conflict
**Why it happens:** LanceDB vector columns have fixed dimensions defined in PyArrow schema
**How to avoid:** Always use vector_v2 column with new dimensions, never reuse vector column during migration
**Warning signs:** `pyarrow.lib.ArrowInvalid: Fixed size list child array should have length N`

### Pitfall 2: Compaction During Active Writes
**What goes wrong:** LanceDB compact_files() blocks, but active writes queue up or fail
**Why it happens:** LanceDB compaction requires table-level lock, blocking operation
**How to avoid:** Use non-blocking lock acquisition (`acquire(blocking=False)`), skip compaction if already running
**Warning signs:** API timeouts, "table locked" errors in logs

### Pitfall 3: Model Download Timeout on First Run
**What goes wrong:** First request times out while downloading 560MB bge-m3 model
**Why it happens:** SentenceTransformer lazy-loads on first encode() call
**How to avoid:** Instantiate model in service __init__, which runs at startup, not on first request
**Warning signs:** HTTPTimeoutError on first API request, subsequent requests work fine

### Pitfall 4: Forgetting to Drop v2 Column After Promotion
**What goes wrong:** Database doubles in size, vector_v2 column persists forever
**Why it happens:** Promotion logic copies but doesn't clean up
**How to avoid:** Promotion function must drop v2 column as final step, log confirmation
**Warning signs:** Disk usage remains high after migration, schema shows both vector and vector_v2

### Pitfall 5: ONNX Model Path Confusion
**What goes wrong:** ONNXProvider tries to load from HuggingFace, but ONNX models require local export first
**Why it happens:** ONNX format is not the default on HuggingFace Hub for most models
**How to avoid:** Document that ONNX requires one-time export, provide CLI command, clear error message
**Warning signs:** `OSError: [Errno 2] No such file or directory: 'model.onnx'`

## Code Examples

Verified patterns from official sources:

### Sentence-Transformers Model Loading with Progress
```python
# Source: sentence-transformers documentation
from sentence_transformers import SentenceTransformer
import logging

# Enable progress bars for download
logging.basicConfig(level=logging.INFO)

# Auto-downloads if not cached, shows progress
# Default cache: ~/.cache/huggingface/hub/
model = SentenceTransformer("BAAI/bge-m3")

# Batch encoding (efficient for multiple texts)
texts = ["query text", "document text"]
embeddings = model.encode(texts, show_progress_bar=False)

print(f"Dimensions: {len(embeddings[0])}")  # 1024 for bge-m3
print(f"Shape: {embeddings.shape}")  # (2, 1024)
```

### LanceDB Add Column with PyArrow Schema
```python
# Source: LanceDB Python documentation
import lancedb
import pyarrow as pa

db = lancedb.connect("data/wims.lance")
table = db.open_table("messages")

# Define new vector column with specific dimensions
vector_field = pa.field("vector_v2", pa.list_(pa.float32(), 1024))
model_field = pa.field("embedding_model_v2", pa.utf8())

# Add columns (idempotent, safe to call multiple times)
table.add_columns([vector_field, model_field])

print(f"Schema: {table.schema}")
```

### Thread-Safe Write Counter
```python
# Source: Python threading documentation + Gemini research
import threading

class ThreadSafeCounter:
    def __init__(self):
        self._value = 0
        self._lock = threading.Lock()

    def increment(self, amount: int = 1):
        with self._lock:
            self._value += amount

    def get_and_reset(self) -> int:
        with self._lock:
            value = self._value
            self._value = 0
            return value

# Usage in CompactionManager
counter = ThreadSafeCounter()

# From API endpoint
@app.post("/messages")
async def create_message(msg: Message):
    # ... insert message ...
    compaction_mgr.counter.increment()
```

### External API Provider with Timeout
```python
# Source: OpenAI Python client documentation
from openai import OpenAI
import structlog

logger = structlog.get_logger()

class OpenAICompatibleProvider(EmbeddingProvider):
    def __init__(
        self,
        model: str,
        base_url: str,
        api_key: str | None = None,
        timeout: int = 30,
        batch_size: int = 100
    ):
        self._model = model
        self._batch_size = batch_size
        self._client = OpenAI(
            base_url=base_url,
            api_key=api_key or "dummy-key",  # Some servers don't require auth
            timeout=timeout
        )

        # Probe dimensions
        self._dimensions = self._probe_dimensions()

    def _probe_dimensions(self) -> int:
        response = self._client.embeddings.create(
            model=self._model,
            input="test"
        )
        return len(response.data[0].embedding)

    def embed(self, texts: list[str]) -> list[list[float]]:
        # Respect batch size for rate limiting
        all_embeddings = []
        for i in range(0, len(texts), self._batch_size):
            batch = texts[i:i + self._batch_size]

            response = self._client.embeddings.create(
                model=self._model,
                input=batch
            )

            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

        return all_embeddings
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual model loading | sentence-transformers.SentenceTransformer() | 2019+ | Standardized API, automatic caching, built-in pooling strategies |
| v3/v4/v5 migration columns | Reusable v2 column promotion | Phase 19 | Reduces schema bloat, makes future migrations simpler |
| Fastembed as default | sentence-transformers + optional ONNX | Phase 19 | More model choice, better ecosystem, similar performance |
| OllamaProvider name | OpenAICompatibleProvider | Phase 19 | Clearer intent, supports any OpenAI-compatible endpoint |
| Manual compaction triggers | Background thread with write counter | Phase 19 | Automatic maintenance, no user intervention needed |

**Deprecated/outdated:**
- **fastembed as primary choice:** Limited model selection (no bge-m3), less flexible than sentence-transformers. Keep for backward compatibility but recommend migration.
- **Synchronous compaction:** Blocks API, bad UX. Background thread is standard pattern for DB maintenance.
- **Config-based migration state:** Adds complexity, LanceDB's NULL checks + versioning are sufficient.

## Open Questions

1. **FastEmbed vs sentence-transformers performance comparison**
   - What we know: Both use ONNX backend when available, fastembed is lighter weight
   - What's unclear: Actual inference speed difference for bge-m3 (not supported in fastembed)
   - Recommendation: Keep fastembed for users who don't need bge-m3, document migration path

2. **Optimal compaction write threshold**
   - What we know: LanceDB performance degrades with 100+ fragments, compaction is ~5-10s for small DBs
   - What's unclear: Exact threshold for single-user tool (10-1000 range)
   - Recommendation: Start with 100 writes, make configurable, document tuning guidance

3. **ONNX quantization defaults**
   - What we know: INT8 quantization is safe for most models, ARM64 has specific configs
   - What's unclear: Whether bge-m3 benefits from quantization (already optimized), quality impact
   - Recommendation: Ship unquantized by default, document quantization as advanced optimization

4. **Migration rollback UX**
   - What we know: LanceDB versioning allows rollback, but no CLI command exists
   - What's unclear: Whether we need explicit rollback command or LanceDB version checkout is sufficient
   - Recommendation: Document `table.checkout(version)` pattern, add rollback command in future phase if requested

5. **External API rate limit handling**
   - What we know: SiliconFlow offers 2000 RPM, static `--delay` flag exists
   - What's unclear: Whether we need retry logic for 429 responses or static delay is sufficient
   - Recommendation: Static delay sufficient for initial release (deferred: adaptive rate limiting)

## Sources

### Primary (HIGH confidence)
- sentence-transformers documentation: https://www.sbert.net/docs/usage/usage.html
- LanceDB Python API: /lancedb/lancedb (Context7)
- Optimum ONNX export: /huggingface/optimum (Context7)
- Python threading documentation: https://docs.python.org/3/library/threading.html
- Gemini research: LanceDB compaction behavior, FastAPI background tasks

### Secondary (MEDIUM confidence)
- bge-m3 model card: https://huggingface.co/BAAI/bge-m3 (attempted, domain blocked)
- FastAPI lifespan events: https://fastapi.tiangolo.com/advanced/events/
- PyArrow table operations: https://arrow.apache.org/docs/python/generated/pyarrow.Table.html

### Tertiary (LOW confidence)
- ONNX Runtime performance claims (5-10x speedup): Common benchmarks, but model-specific
- SiliconFlow bge-m3 availability: From phase context, not verified directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sentence-transformers is industry standard, well-documented
- Architecture: MEDIUM-HIGH - Threading patterns are proven, but LanceDB compaction concurrency needs testing
- Pitfalls: MEDIUM - Based on common patterns and documentation, but some are predictive

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - stable ecosystem)

**Key validations needed during planning:**
- Test LanceDB compaction behavior under concurrent reads (verify blocking vs queueing)
- Verify bge-m3 model size and first-download time (~560MB, estimated 2-5min on typical connection)
- Confirm sentence-transformers auto-download logging can be captured by structlog
