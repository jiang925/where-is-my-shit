<div align="center">

![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Docker](https://img.shields.io/badge/docker-ghcr.io-blue.svg)
![CI](https://github.com/jiang925/where-is-my-shit/actions/workflows/ci.yml/badge.svg)

**Ever lost an AI conversation? WIMS captures and indexes all your AI chats so you can find them instantly.**

English | [中文](README_CN.md)

</div>

---

## Features

- **Multi-Platform Capture** — 13 web platforms via Chrome extension (ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek, Grok, Doubao, Kimi, Qwen, Poe, HuggingChat, Le Chat)
- **Dev Session Indexing** — 9 dev tools via file watcher (Claude Code, Cursor, Gemini CLI, Continue.dev, Cline, Aider, Jan.ai, Antigravity, Open WebUI)
- **Bulk History Import** — One-click "Import All Chats" in extension for ChatGPT/Claude with resumable progress tracking
- **Semantic Search** — Vector similarity + full-text hybrid search with relevance ranking
- **Search Operators** — `platform:chatgpt`, `before:2026-03-01`, `after:`, `has:code` for precise filtering
- **Source Filtering** — Filter by platform, quick presets (Web Chats, Dev Sessions, All)
- **Timeline Browse** — Chronological browsing with date range filters (Today, This Week, etc.)
- **Keyboard Navigation** — Arrow keys to navigate results, `/` to focus search, Enter to open
- **Dark Mode** — System/light/dark theme toggle with persistence
- **In-Thread Search** — Find specific messages within conversations with highlighting
- **Markdown Rendering** — AI responses render with proper code blocks, lists, and headers
- **Export & Import** — Single/bulk export as markdown/zip/HTML, import from ChatGPT/Claude data exports
- **Bookmarks & Organization** — Star, pin, and annotate conversations; edit titles; search history
- **Compact View** — Toggle between card and compact single-line result layout
- **MCP Server** — Use WIMS as context for AI tools via Model Context Protocol
- **Multi-Device Sync** — Sync conversation data between WIMS instances
- **Deep Links** — Click to jump back to the original conversation, Open in Terminal for dev sessions
- **Local-First** — All data stays on your machine, no cloud dependency
- **Multiple Embedding Backends** — sentence-transformers (default), fastembed, ONNX, OpenAI-compatible API

---

## How It Works

WIMS consists of three components working together:

**Server (FastAPI + LanceDB):** The core backend that embeds text into vectors, stores conversations in a LanceDB vector database, and serves a React-based search/browse UI. The server runs locally and handles all indexing and retrieval operations.

**Chrome Extension (content scripts):** Scrapes AI conversations from 13 web platforms (ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek, Grok, and more) and sends them to the server for indexing. Also supports one-click bulk import of entire chat histories from ChatGPT and Claude. Runs automatically when you visit supported sites.

**File Watcher (watchdog):** Monitors local AI tool log directories (Claude Code, Cursor, Gemini CLI, Continue.dev, Cline, Aider, Jan.ai, Antigravity, Open WebUI) and captures dev session conversations. Runs as a background service and automatically ingests new conversations.

When you search, the server performs hybrid search combining vector similarity and full-text matching, then reranks results using a unified scoring system that considers semantic relevance, text overlap, content quality, and exact match signals. Results are partitioned into primary (high confidence) and secondary (good matches) tiers.

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Pull and run (full variant with pre-downloaded models)
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest

# Or use slim variant (downloads models on first run)
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest-slim
```

**What happens:**
- Container starts server on http://localhost:8000
- On first run, API key auto-generated (check logs: `docker logs wims`)
- Configuration and data stored in `~/.wims/` (persisted via volume mount)

**View API key:**
```bash
docker logs wims 2>&1 | grep "API Key"
# Or check config:
cat ~/.wims/server.json
```

### Option 2: From Source

```bash
git clone https://github.com/jiang925/where-is-my-shit.git
cd where-is-my-shit
./setup.sh
./start.sh
```

**What happens:**
- `setup.sh` installs `uv` (if not already installed), syncs Python dependencies, pre-downloads the default embedding model (BAAI/bge-m3)
- `start.sh` builds the frontend (if needed) and starts the server on http://localhost:8000
- On first run, an API key is auto-generated and printed to the console. You'll need this for the extension and watcher.
- Configuration is stored at `~/.wims/server.json`

Open http://localhost:8000 in your browser to access the search interface.

---

## Prerequisites

**Option 1: Docker (Simplest)**
- **Docker** or **Docker Desktop**
- **~2GB disk space** for embedding models (full variant) or ~200MB (slim variant)

**Option 2: From Source**
- **Python 3.11+**
- **Node.js 20+** (for frontend build and extension)
- **macOS or Linux** (Windows: WSL recommended)
- **~2GB disk space** for embedding models

---

## Server Setup

### Starting the Server

```bash
# Using the wrapper script (recommended)
./start.sh

# Or using the CLI directly
uv run python -m src.cli start

# With custom settings
uv run python -m src.cli start --host 0.0.0.0 --port 8080 --reload
```

### Server Options

- `--host` — Bind address (default: `127.0.0.1`, use `0.0.0.0` for network access)
- `--port` — Port number (default: `8000`)
- `--reload` — Enable auto-reload for development
- `--config` — Path to custom configuration file

### On Startup

The server will print:

```
Starting WIMS server on 127.0.0.1:8000
Using config: /Users/you/.wims/server.json

API Key: sk-wims-xxxxxxxxxxxxxxxxxxxxxxxx
```

Save this API key for the extension and watcher configuration.

### API Documentation

Interactive API docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Docker Setup

Docker provides the easiest way to run WIMS with two image variants available.

### Image Variants

**Full variant (recommended):**
- Size: ~800MB
- Models pre-downloaded (bge-m3, ~2GB)
- Instant startup, no waiting for model download
- Tags: `latest`, `VERSION`, `VERSION-full`

**Slim variant:**
- Size: ~200MB
- Models download on first run (~2GB, one-time)
- Smaller footprint, slower first startup
- Tags: `latest-slim`, `VERSION-slim`

### Running with Docker

**Full variant (instant startup):**
```bash
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest
```

**Slim variant (smaller image):**
```bash
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest-slim
```

**Get your API key:**
```bash
# From container logs
docker logs wims 2>&1 | grep "API Key"

# Or from config file
cat ~/.wims/server.json | jq -r '.api_key'
```

### Using docker-compose

Create `docker-compose.yml`:

```yaml
services:
  wims:
    image: ghcr.io/jiang925/wims:latest
    ports:
      - "8000:8000"
    volumes:
      - ~/.wims:/root/.wims
    restart: unless-stopped
```

Start with:
```bash
docker compose up -d
```

### Docker Management

```bash
# View logs
docker logs -f wims

# Stop server
docker stop wims

# Start server
docker start wims

# Restart server
docker restart wims

# Remove container (data persists in ~/.wims)
docker rm -f wims

# Update to latest version
docker pull ghcr.io/jiang925/wims:latest
docker rm -f wims
# Then run the docker run command again
```

---

## Extension Setup

The Chrome extension captures conversations from web-based AI platforms.

### Building the Extension

```bash
cd extension
npm install
npm run build
```

This creates the extension bundle in `extension/dist/`.

### Installing in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `extension/dist` directory

### Configuring the Extension

1. Click the WIMS extension icon in your Chrome toolbar
2. Click "Options"
3. Enter your server URL (e.g., `http://localhost:8000`)
4. Enter the API key from server startup
5. Click "Save"

### Supported Sites

The extension automatically captures conversations from:
- **ChatGPT** (chatgpt.com)
- **Claude** (claude.ai)
- **Gemini** (gemini.google.com)
- **Perplexity** (perplexity.ai)
- **Microsoft Copilot** (copilot.microsoft.com)
- **DeepSeek** (chat.deepseek.com)
- **Grok** (grok.com)
- **Doubao** (doubao.com)
- **Kimi** (kimi.moonshot.cn)
- **Qwen Chat** (chat.qwen.ai)
- **Poe** (poe.com)
- **HuggingChat** (huggingface.co/chat)
- **Le Chat / Mistral** (chat.mistral.ai)

Just browse these sites normally — conversations are captured automatically.

### Bulk History Import

For ChatGPT and Claude, the extension can import your **entire chat history** with one click:

1. Navigate to chatgpt.com or claude.ai
2. Click the WIMS extension icon
3. Click "Import All ChatGPT Chats" (or Claude equivalent)
4. Progress is shown in real time — the import is **resumable** if interrupted
5. On subsequent runs, only new conversations are imported (previously imported chats are skipped)

---

## Watcher Setup

The file watcher monitors local AI tool logs and indexes dev session conversations automatically.

### One-Liner Installation

Install the watcher daemon as a user service (no sudo required):

```bash
curl -sSL https://raw.githubusercontent.com/jiang925/wims/main/install-watcher.sh | bash
```

**What happens:**

- Prompts to install `uv` if not already installed (used for dependency management)
- Downloads the latest watcher release from GitHub
- Installs to `~/.local/bin/wims-watcher`
- Sets up systemd (Linux) or launchd (macOS) user service
- Starts the service automatically

The watcher reads config from `~/.wims/server.json` (auto-created by the server on first run).

### Update

The watcher checks for updates on startup and logs notifications to `~/.wims/watcher.log`. Update manually:

```bash
wims-watcher update
```

### Uninstall

```bash
bash ~/.local/bin/wims-watcher/uninstall.sh
```

Removes the service and daemon files. Prompts before removing config and database.

### Manual Installation (for development)

If you prefer to run from source:

```bash
# Install dependencies
pip install -r wims-watcher/requirements.txt

# Run in foreground
python -m wims-watcher.src.main

# Or install as systemd service (Linux only)
cd wims-watcher
./install.sh
```

### Supported Tools

The watcher monitors conversations from:
- **Claude Code** — `~/.claude/history.jsonl`
- **Cursor** — `~/.config/Cursor/User/workspaceStorage/*/state.vscdb`
- **Gemini CLI** — `~/.gemini/tmp/*/chats/` sessions
- **Continue.dev** — `~/.continue/sessions/` sessions
- **Cline** — VS Code globalStorage tasks
- **Aider** — `.aider.chat.history.md` files
- **Jan.ai** — `~/jan/threads/` JSONL sessions
- **Antigravity** — `~/.antigravity/logs/*.log`
- **Open WebUI** — API-based polling of `/api/v1/chats` (for Ollama/self-hosted setups)

Log directories are auto-detected. The watcher starts monitoring when files are created.

### Logs

View watcher logs:

```bash
tail -f ~/.wims/watcher.log
```

Check service status:

```bash
# Linux
systemctl --user status wims-watcher.service

# macOS
launchctl print gui/$(id -u)/com.wims.watcher
```

---

## Configuration

Server configuration is stored at `~/.wims/server.json` and auto-created on first run.

### Complete Configuration Example

```json
{
  "api_key": "sk-wims-xxxxxxxxxxxxxxxxxxxx",
  "port": 8000,
  "host": "127.0.0.1",
  "LOG_LEVEL": "INFO",
  "DB_PATH": "data/wims.lance",
  "AUTH_DB_PATH": "data/auth.db",
  "CORS_ORIGINS": ["http://localhost", "http://127.0.0.1"],
  "EXTENSION_ID": "",
  "embedding": {
    "provider": "sentence-transformers",
    "model": "BAAI/bge-m3",
    "base_url": "http://localhost:11434/v1",
    "dimensions": null,
    "api_key": null,
    "timeout": 30,
    "batch_size": 100
  }
}
```

### Configuration Fields

**Server Settings:**

- `api_key` — Authentication key (auto-generated, used by extension and watcher)
- `port` — Server port (default: 8000)
- `host` — Bind address (default: 127.0.0.1, use 0.0.0.0 for network access)
- `LOG_LEVEL` — Logging verbosity (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `DB_PATH` — LanceDB storage path (default: data/wims.lance)
- `AUTH_DB_PATH` — Auth database path (default: data/auth.db)
- `CORS_ORIGINS` — Allowed CORS origins (array of URLs)
- `EXTENSION_ID` — Chrome extension ID (optional, for tighter CORS control)

**Embedding Configuration:**

- `provider` — Embedding backend: `sentence-transformers`, `fastembed`, `onnx`, or `openai`
- `model` — Model name (HuggingFace model ID or API model name)
- `base_url` — API endpoint (only for `openai` provider, supports Ollama and OpenAI-compatible servers)
- `dimensions` — Vector dimensions (auto-detected if null, override if needed)
- `api_key` — API key for external providers (null for local models)
- `timeout` — Request timeout in seconds (default: 30)
- `batch_size` — Batch size for API providers (default: 100)

### Hot Reloading

Configuration changes take effect immediately without restarting the server. Just edit `~/.wims/server.json` and save.

### Embedding Providers

WIMS supports multiple embedding backends. See [docs/embedding-providers.md](docs/embedding-providers.md) for detailed provider setup, model recommendations, and performance comparisons.

**Quick comparison:**

- `sentence-transformers` (default) — Best quality, GPU-accelerated if available, ~1024 dimensions
- `fastembed` — Fast CPU inference, good for resource-constrained environments
- `onnx` — Optimized runtime, fastest CPU performance (requires `optimum[onnxruntime]`)
- `openai` — Use external APIs (Ollama, OpenAI, remote GPU servers)

---

## CLI Commands

### Starting the Server

```bash
uv run python -m src.cli start
```

Start the WIMS server with default settings.

### Checking Migration Status

```bash
uv run python -m src.cli reembed --status
```

Check the status of embedding migration (shows total, migrated, and remaining documents).

### Re-embedding Documents

```bash
uv run python -m src.cli reembed
```

Re-embed all documents using the current embedding model configured in `server.json`. Useful when switching models or upgrading to a better embedding backend.

**Options:**

- `--batch-size N` — Documents per batch (default: 100)
- `--delay N` — Seconds between batches (default: 0.5)
- `--status` — Show migration status only, don't re-embed
- `--promote` — Force promote v2 vectors to v1 without re-embedding

### Background Auto-Resume

Re-embedding automatically resumes on server startup if an incomplete migration is detected. You can monitor progress with `--status`.

### Promoting Migrated Vectors

```bash
uv run python -m src.cli reembed --promote
```

Manually promote v2 vectors to v1 and clean up migration columns. Normally happens automatically when migration completes, but this flag allows manual control for recovery scenarios.

### Complete CLI Reference

For detailed examples, advanced usage, and troubleshooting, see [docs/cli-reference.md](docs/cli-reference.md).

---

## Usage Examples

### Basic Search Workflow

1. **Install and start the server:**
   ```bash
   ./setup.sh && ./start.sh
   ```

2. **Install the Chrome extension** (see Extension Setup above)

3. **Have conversations** on ChatGPT, Claude, Gemini, or Perplexity

4. **Search your conversations:**
   - Open http://localhost:8000
   - Type your query (e.g., "python asyncio debugging")
   - Results appear with relevance scores and source badges
   - Click "View Original" to jump back to the conversation

### Filtering by Source

**Quick Presets:**
- "Web Chats" — ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek, and more
- "Dev Sessions" — Claude Code, Cursor, Gemini CLI, Continue.dev, Cline, Aider, Jan.ai
- "All Sources" — Everything

**Search Operators:**
- `platform:chatgpt` — Filter by platform name
- `before:2026-03-01` / `after:2026-01-01` — Date range filters
- `has:code` — Only results containing code blocks

**Custom Filtering:**
- Click the platform badges to toggle individual sources
- URL updates automatically for shareable links

### Timeline Browsing

Browse conversations chronologically:

1. Click "Browse" in the navigation
2. Select a date range (Today, This Week, This Month, All Time)
3. Results grouped by timeline buckets (Today, Yesterday, This Week, etc.)
4. Filter by source while browsing

### Switching Embedding Models

To upgrade to a better embedding model:

1. **Edit configuration:**
   ```bash
   nano ~/.wims/server.json
   ```

2. **Update the embedding section:**
   ```json
   "embedding": {
     "provider": "sentence-transformers",
     "model": "BAAI/bge-m3"
   }
   ```

3. **Re-embed your documents:**
   ```bash
   uv run python -m src.cli reembed
   ```

4. **Monitor progress:**
   ```bash
   uv run python -m src.cli reembed --status
   ```

The migration runs in the background using a dual-column approach (v1 and v2 vectors). When complete, v2 automatically promotes to v1.

### Using External Embedding APIs

For GPU-accelerated embeddings via Ollama or OpenAI-compatible endpoints:

1. **Start your embedding server** (e.g., Ollama):
   ```bash
   ollama serve
   ollama pull nomic-embed-text
   ```

2. **Update configuration:**
   ```json
   "embedding": {
     "provider": "openai",
     "model": "nomic-embed-text",
     "base_url": "http://localhost:11434/v1",
     "dimensions": 768
   }
   ```

3. **Restart the server** — configuration changes take effect immediately

---

## Database Management

### Storage Location

By default, data is stored in the project directory:
- LanceDB: `data/wims.lance/`
- Auth database: `data/auth.db`

To use a custom location, edit `DB_PATH` in `~/.wims/server.json`.

### Backup and Restore

**Backup:**
```bash
# Stop the server first
tar -czf wims-backup-$(date +%Y%m%d).tar.gz data/
```

**Restore:**
```bash
# Stop the server first
tar -xzf wims-backup-20260215.tar.gz
./start.sh
```

### Database Maintenance

LanceDB automatically compacts on every 100 writes (configurable). No manual maintenance required.

**Check database size:**
```bash
du -sh data/wims.lance/
```

**View database statistics:**

Visit http://localhost:8000/stats or use the `/api/v1/stats` API endpoint.

---

## Troubleshooting

### Server won't start

**Port already in use:**
```
Error: Port 8000 on 127.0.0.1 is already in use.
```

Solution: Stop the existing server or use a different port:
```bash
uv run python -m src.cli start --port 8001
```

**Missing dependencies:**
```
ImportError: No module named 'fastapi'
```

Solution: Run setup again:
```bash
./setup.sh
```

### Extension not capturing conversations

**Check extension permissions:**
1. Open `chrome://extensions`
2. Find WIMS
3. Ensure it has permission for the AI platform sites

**Check server connectivity:**
1. Open extension options
2. Verify server URL is correct (e.g., `http://localhost:8000`)
3. Test the connection using the built-in test button

**Check API key:**

Ensure the API key in extension options matches the one in `~/.wims/server.json`.

### Search returns no results

**Check if database has data:**
```bash
# Verify ingestion is working by checking server logs
grep "Ingested" logs/wims.log
```

**Re-download embedding model:**
```bash
./setup.sh
```

**Verify API keys match** between extension/watcher and `~/.wims/server.json`.

### Watcher not indexing dev sessions

**Check watcher logs:**
```bash
journalctl -u wims-watcher -f    # systemd service
python -m wims-watcher.src.main   # foreground mode
```

The watcher auto-discovers Claude Code and Cursor logs at standard locations. If logs are elsewhere, configure custom paths in the watcher config.

### Poor search quality

**Try a better embedding model:**

The default `BAAI/bge-m3` is multilingual and high-quality. For English-only content, consider:
- `sentence-transformers/all-mpnet-base-v2` (768d, very good quality)
- `sentence-transformers/all-MiniLM-L12-v2` (384d, faster, still good)

See [docs/embedding-providers.md](docs/embedding-providers.md) for recommendations.

**Re-embed after configuration changes:**
```bash
uv run python -m src.cli reembed
```

### Migration stuck or failed

**Check migration status:**
```bash
uv run python -m src.cli reembed --status
```

**Force promotion to recover:**
```bash
uv run python -m src.cli reembed --promote
```

This promotes any completed v2 vectors to v1 and cleans up the migration state.

**Start fresh migration:**
```bash
# If migration is corrupted, just restart it
uv run python -m src.cli reembed
```

The migration system is idempotent — it's safe to re-run.

---

## Architecture

WIMS uses a hybrid search architecture combining vector similarity and full-text search:

**Backend:** FastAPI + LanceDB (vector database) + sentence-transformers (embeddings)

**Frontend:** React + TanStack Query + Vite

**Data flow:** Extension/Watcher → Ingest API → Embedding → LanceDB → Search/Browse API → UI

---

## Development

### Running Tests

```bash
# Backend (194 tests)
uv run pytest

# Frontend (82 tests)
cd ui && npx vitest run

# Extension (56 tests)
cd extension && npx vitest run

# E2E (96 tests, auto-launches server)
npx playwright test

# Lint
uv run ruff check src/ tests/
```

---

## Contributing

This is currently a personal project. If you find bugs or have feature ideas, feel free to open an issue on GitHub.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Built for developers who lose track of AI conversations.**

WIMS is a local-first, privacy-focused tool designed to eliminate the frustration of losing context across AI platforms. No cloud dependencies, no subscriptions — just a simple tool that does one thing well.
