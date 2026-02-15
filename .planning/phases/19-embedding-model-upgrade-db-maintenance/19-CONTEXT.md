# Phase 19: Embedding Model Upgrade & DB Maintenance - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the embedding pipeline to support bge-m3 via multiple backends (sentence-transformers, ONNX, OpenAI-compatible API), add periodic LanceDB compaction with concurrency guards, and improve the migration system so model transitions are reusable (v2->v1 promotion, not v3/v4/v5 increments). Restructure external API provider as abstract base with OpenAI-compatible implementation.

</domain>

<decisions>
## Implementation Decisions

### Compaction behavior
- Trigger on **both startup and write counter threshold** (compact on server start, then again after every N writes)
- Concurrency: Claude's discretion on skip-silently vs queue (simplest safe approach)
- **Non-blocking**: compaction runs in background thread, API continues serving. Must ensure UX is not affected — if LanceDB has table-level locks during compaction, handle gracefully (e.g., short retry or queue reads)
- **Log lines only** for feedback: structlog messages for "compaction started" and "compaction complete (X fragments merged)"

### Provider config UX
- **Same flat config structure** with new provider name values: `provider: "sentence-transformers"`, `provider: "onnx"`, `provider: "openai"`
- **Auto-download on startup**: if model not cached locally, download from HuggingFace automatically with log progress
- FastEmbed fate: Claude's discretion on whether to keep or deprecate (evaluate what fastembed uniquely offers vs the new providers)
- External API config fields: `base_url`, `model`, `api_key` (optional), `timeout`, `batch_size`

### Migration promotion flow
- **Auto-promote**: when all rows have vector_v2 populated, automatically promote (copy v2->v1, drop v2 column). No separate promote command needed.
- Old vectors: Claude's discretion (overwrite vs temporary backup — pragmatic approach)
- **Resumable**: use existing `vector_v2 IS NULL` check to find unprocessed rows. No extra state tracking needed.
- **Auto-resume on server startup**: if server detects incomplete migration (some rows have v2, some don't), spawn background re-embedding at low priority. Single-user tool, resource contention is minimal.
- Reusable pattern: after promotion, v2 column is dropped. Next model change creates a fresh v2 column — same mechanism every time, never v3/v4/v5.

### OllamaProvider rename
- **No backward compatibility needed** — no external users have deployed this tool yet, and current setup uses local model
- Config provider name: `"openai"` — short, recognizable, represents the OpenAI embedding API format
- Internal class: `OpenAICompatibleProvider` implementing `ExternalAPIProvider` base class
- File structure: Claude's discretion (same file vs separate based on size/conventions)

### Claude's Discretion
- Compaction write counter threshold value (e.g., 50, 100, 200 writes)
- Concurrency handling for overlapping compaction triggers (skip or queue)
- Whether to keep FastEmbed provider alongside new ones or deprecate
- Old vector handling during promotion (overwrite vs backup)
- ExternalAPIProvider file organization (single file vs split)
- ONNX quantization config defaults
- LanceDB lock behavior during compaction — research and handle appropriately

</decisions>

<specifics>
## Specific Ideas

- bge-m3 (BAAI/bge-m3) is the target model: 1024 dimensions, multilingual, 568M params
- Current model: BAAI/bge-small-en-v1.5 (384d, English-only) — this is what gets migrated FROM
- SiliconFlow offers bge-m3 for FREE (2000 RPM, 500K TPM) as an external API option
- sentence-transformers provides PyTorch backend (~50-150ms/query on CPU)
- ONNX provides optimized runtime (~10-20ms/query on CPU) — both produce compatible embeddings for the same model
- Existing provider abstraction: `EmbeddingProvider` ABC with `embed()`, `get_dimensions()`, `get_model_name()`
- Existing `OllamaProvider` already uses OpenAI client internally — rename + restructure, not rewrite
- `reembed` CLI command already exists with `--batch-size`, `--delay`, `--status` flags
- The `--delay` flag handles rate limiting for remote API providers

</specifics>

<deferred>
## Deferred Ideas

- Bulk/batch embedding API support (OpenAI Batch API with 24h SLA) — useful for very large databases with cloud providers, but adds significant async complexity (job tracking, polling, result matching). Sequential with `--delay` is sufficient for now.
- Additional external provider protocols beyond OpenAI-compatible (e.g., native SiliconFlow, Cohere, custom gRPC) — phase 19 abstracts ExternalAPIProvider base to make this easy later.
- Dynamic rate limiting that adapts to 429 responses — current static `--delay` is sufficient for free-tier usage.

</deferred>

---

*Phase: 19-embedding-model-upgrade-db-maintenance*
*Context gathered: 2026-02-14*
