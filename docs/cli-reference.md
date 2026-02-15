# CLI Reference

The WIMS CLI provides commands to manage the server and maintain the embedding database.

## Usage

```bash
uv run python -m src.cli [command] [options]
```

**Global flag:**
- `--config PATH` — Specify configuration file path (default: `~/.wims/server.json`)

## Commands

### `start` — Start the WIMS server

Start the local WIMS server to enable search and API access.

**Usage:**
```bash
uv run python -m src.cli start [options]
```

**Options:**
- `--host HOST` — Bind host address (overrides config file)
- `--port PORT` — Bind port number (overrides config file, default: 8000)
- `--reload` — Enable auto-reload for development (watches for code changes)

**Examples:**

```bash
# Start with defaults from config
uv run python -m src.cli start

# Start on custom port
uv run python -m src.cli start --port 9000

# Development mode with auto-reload
uv run python -m src.cli start --reload

# Use a specific config file
uv run python -m src.cli --config /path/to/config.json start
```

**Notes:**
- Server prints the API key and documentation URL on startup
- Default binding is `127.0.0.1:8000` (localhost only)
- Config file is created automatically on first run if it doesn't exist

---

### `reembed` — Re-embed documents with a new embedding model

Re-embed all documents when changing the embedding model. Creates new vectors alongside existing ones for zero-downtime migration.

**Usage:**
```bash
uv run python -m src.cli reembed [options]
```

**Options:**
- `--status` — Show migration status without running (total documents, migrated count, remaining, progress %)
- `--promote` — Force promote v2 vectors to v1 without re-embedding (recovery tool)
- `--batch-size N` — Number of documents to process per batch (default: 100)
- `--delay SECONDS` — Seconds to wait between batches (default: 0.5, increase for API providers to avoid rate limits)

**Migration Workflow:**

1. **Update your config** — Edit `~/.wims/server.json` to change the embedding provider or model:
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

3. **Run migration** — Generate new embeddings for all documents:
   ```bash
   uv run python -m src.cli reembed
   ```

4. **Migration process:**
   - Creates `vector_v2` column in the database
   - Processes documents in batches
   - Auto-promotes v2 vectors to v1 when complete
   - Drops temporary v2 column after promotion

5. **Resume if interrupted** — Migration is idempotent; safely re-run the same command to continue

**Examples:**

```bash
# Check current migration status
uv run python -m src.cli reembed --status

# Run with default settings (100 docs/batch, 0.5s delay)
uv run python -m src.cli reembed

# Slow batch for API providers (avoid rate limits)
uv run python -m src.cli reembed --batch-size 50 --delay 2.0

# Force promote vectors (recovery scenario)
uv run python -m src.cli reembed --promote
```

**Notes:**
- Migration is safe to interrupt — progress is saved incrementally
- Search continues to work during migration (uses v1 vectors)
- After promotion, all queries use the new embeddings
- Background auto-resume happens on server startup if migration is incomplete

---

## Convenience Scripts

The repository includes helper scripts for common tasks:

### `./setup.sh`
Install `uv`, sync dependencies, and download default embedding models.

```bash
./setup.sh
```

### `./start.sh`
Build the frontend (if needed) and start the server with auto-reload enabled.

```bash
./start.sh
```

### `wims-watcher/install.sh`
Install the filesystem watcher as a systemd service (Linux only). Watches directories for file changes and automatically indexes new content.

```bash
cd wims-watcher
./install.sh
```
