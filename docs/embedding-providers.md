# Embedding Providers

WIMS supports multiple embedding backends for converting text to vectors. Choose the provider that best fits your hardware, performance, and quality requirements.

## Overview

Embedding providers convert text into dense vector representations for semantic search. Configure your provider in `~/.wims/server.json` under the `"embedding"` key.

**Default configuration:**
- Provider: `sentence-transformers`
- Model: `BAAI/bge-m3` (1024 dimensions, multilingual)

## Provider Comparison

| Provider | Backend | GPU Support | Offline | Best For |
|----------|---------|-------------|---------|----------|
| sentence-transformers | PyTorch | Yes | Yes | Best quality, default choice |
| fastembed | ONNX (lite) | No | Yes | CPU-only, lightweight |
| onnx | ONNX Runtime | Optional | Yes | Optimized inference, hardware accelerators |
| openai | OpenAI API | N/A | No | OpenAI embeddings, cloud-based |
| ollama | Ollama/API | N/A | Depends | Local GPU server, OpenAI-compatible APIs |

---

## sentence-transformers (Default)

PyTorch-based embedding provider using HuggingFace models. Supports GPU acceleration for best performance.

**Requirements:**
- PyTorch (installed automatically via dependencies)

**Configuration:**

```json
{
  "embedding": {
    "provider": "sentence-transformers",
    "model": "BAAI/bge-m3"
  }
}
```

**Required fields:**
- `provider` — Set to `"sentence-transformers"`
- `model` — HuggingFace model identifier

**Optional fields:**
- `dimensions` — Override dimension count (auto-detected by default)

**Notes:**
- Downloads model from HuggingFace on first run (~2GB for bge-m3)
- Models are cached locally in `~/.cache/huggingface/`
- Supports any HuggingFace sentence-transformers model
- GPU acceleration automatic if CUDA/MPS available
- Best quality embeddings for most use cases

**Recommended models:**
- `BAAI/bge-m3` — Multilingual, 1024 dimensions (default)
- `BAAI/bge-large-en-v1.5` — English-only, 1024 dimensions, high quality
- `sentence-transformers/all-MiniLM-L6-v2` — Lightweight, 384 dimensions

---

## fastembed

Lightweight CPU-only ONNX backend. Good for machines without GPU or when minimal dependencies are preferred.

**Requirements:**
- `fastembed` package (included in dependencies)

**Configuration:**

```json
{
  "embedding": {
    "provider": "fastembed",
    "model": "BAAI/bge-small-en-v1.5"
  }
}
```

**Required fields:**
- `provider` — Set to `"fastembed"`
- `model` — FastEmbed model identifier

**Optional fields:**
- `dimensions` — Override dimension count (auto-detected by default)

**Notes:**
- Optimized for CPU inference
- Smaller memory footprint than PyTorch
- Auto-prefixes e5 models: queries get `"query: "` prefix, documents get `"passage: "` prefix
- No GPU support

**Recommended models:**
- `BAAI/bge-small-en-v1.5` — English, 384 dimensions, good balance
- `BAAI/bge-base-en-v1.5` — English, 768 dimensions, better quality

---

## onnx

ONNX Runtime provider with Optimum integration. Offers better CPU performance than PyTorch for some models and supports hardware accelerators.

**Requirements:**
- Install with: `uv sync --extra onnx` or `pip install optimum[onnxruntime]`

**Configuration:**

```json
{
  "embedding": {
    "provider": "onnx",
    "model": "BAAI/bge-m3"
  }
}
```

**Required fields:**
- `provider` — Set to `"onnx"`
- `model` — HuggingFace model identifier

**Optional fields:**
- `dimensions` — Override dimension count (auto-detected by default)

**Notes:**
- Automatically exports PyTorch models to ONNX format on first use
- Better CPU inference performance than raw PyTorch for many models
- Supports hardware accelerators (DirectML on Windows, TensorRT on Linux)
- Models cached locally after export
- Optional dependency — must be installed explicitly

---

## openai (OpenAI API)

OpenAI's embedding API. Requires internet connection and API key. No local compute needed.

**Requirements:**
- `openai` package (included in dependencies)
- OpenAI API key

**Configuration:**

```json
{
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-your-openai-api-key",
    "timeout": 30,
    "batch_size": 100
  }
}
```

**Required fields:**
- `provider` — Set to `"openai"`
- `model` — OpenAI model name
- `base_url` — API endpoint URL
- `api_key` — Your OpenAI API key

**Optional fields:**
- `timeout` — Request timeout in seconds (default: 30)
- `batch_size` — Documents per API request (default: 100)
- `dimensions` — Override dimension count (auto-detected by default)

**Notes:**
- Requires internet connection
- Dimensions auto-detected by probing the API
- Batching helps with large document sets
- API costs apply per token embedded

**Recommended models:**
- `text-embedding-3-small` — 1536 dimensions, cost-effective
- `text-embedding-3-large` — 3072 dimensions, highest quality
- `text-embedding-ada-002` — Legacy model, 1536 dimensions

---

## ollama (Local or Remote OpenAI-Compatible API)

Connect to Ollama or any OpenAI-compatible embedding endpoint. Supports local GPU servers and remote inference.

**Requirements:**
- Running Ollama instance (or compatible API)
- `openai` package (included in dependencies)

**Configuration:**

```json
{
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "base_url": "http://localhost:11434/v1",
    "timeout": 30,
    "batch_size": 100
  }
}
```

**Required fields:**
- `provider` — Set to `"ollama"`
- `model` — Model name (as recognized by your endpoint)
- `base_url` — API endpoint URL

**Optional fields:**
- `api_key` — API key if your endpoint requires authentication
- `timeout` — Request timeout in seconds (default: 30)
- `batch_size` — Documents per API request (default: 100)
- `dimensions` — Override dimension count (auto-detected by default)

**Notes:**
- Works with local Ollama (`http://localhost:11434/v1`)
- Works with remote GPU servers (e.g., `http://192.168.50.202:11434/v1`)
- Works with any OpenAI-compatible embedding API
- Dimensions auto-detected by probing the endpoint
- No API key needed for local Ollama

**Ollama setup:**
```bash
# Install Ollama (see https://ollama.ai)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull an embedding model
ollama pull nomic-embed-text
```

**Recommended models:**
- `nomic-embed-text` — 768 dimensions, optimized for speed
- `mxbai-embed-large` — 1024 dimensions, high quality

---

## Changing Embedding Models

When you change the embedding model, existing vectors become incompatible. WIMS provides a zero-downtime migration system.

**Migration steps:**

1. **Update configuration** — Edit `~/.wims/server.json`:
   ```json
   {
     "embedding": {
       "provider": "sentence-transformers",
       "model": "BAAI/bge-m3"
     }
   }
   ```

2. **Check status** — See how many documents need re-embedding:
   ```bash
   uv run python -m src.cli reembed --status
   ```

3. **Run migration** — Re-embed all documents:
   ```bash
   uv run python -m src.cli reembed
   ```

4. **How it works:**
   - Creates `vector_v2` column in database
   - Processes documents in batches (configurable)
   - Search continues to work during migration (uses v1 vectors)
   - Auto-promotes v2 to v1 when complete
   - Drops temporary v2 column after promotion

5. **Resume if interrupted:**
   - Migration is idempotent and safe to interrupt
   - Re-run the same command to continue from where it stopped

**For more details:**
See [docs/cli-reference.md](./cli-reference.md) for full `reembed` command documentation.

---

## EmbeddingConfig Reference

Complete field reference for the `embedding` section in `~/.wims/server.json`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `"sentence-transformers"` | Provider backend (see table above) |
| `model` | string | `"BAAI/bge-m3"` | Model name/identifier |
| `base_url` | string | `"http://localhost:11434/v1"` | API endpoint (openai/ollama only) |
| `dimensions` | int \| null | `null` | Override dimensions (auto-detected) |
| `api_key` | string \| null | `null` | API key (openai/ollama only) |
| `timeout` | int | `30` | API timeout in seconds (external providers) |
| `batch_size` | int | `100` | Batch size for API calls (external providers) |

**Auto-detection:**
- `dimensions` is probed automatically for all providers by embedding a test string
- `api_key` defaults to `"dummy-key"` for local Ollama (no auth needed)
- Not all fields apply to all providers (e.g., local providers ignore `base_url`)
