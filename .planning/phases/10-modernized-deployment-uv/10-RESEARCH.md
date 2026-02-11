# Phase 10: Modernized Deployment (uv) Research

## Current State Analysis

### Dependency Management
- **Dual Source of Truth**: The project currently contains both `pyproject.toml` and `requirements.txt`.
- **Inconsistency**:
  - `requirements.txt` contains security packages (`pyjwt`, `passlib[argon2]`) that are missing from `pyproject.toml`.
  - `uv.lock` exists, suggesting `uv` has been experimented with, but `requirements.txt` is likely what is used in Docker.
- **Build System**: `pyproject.toml` uses `hatchling` as the build backend.

### Existing Files
- `pyproject.toml`: Configured but missing some dependencies.
- `requirements.txt`: Appears to be the comprehensive list (used by Dockerfile).
- `Dockerfile`: Uses `pip` and `requirements.txt`.
- `uv.lock`: Exists.

## Implementation Plan

### 1. Dependency Consolidation (DEPL-03)
We must migrate all dependencies to `pyproject.toml` to make it the Single Source of Truth (SSOT).

**Missing Dependencies to Add to `pyproject.toml`:**
- `pyjwt` (>=2.8.0)
- `passlib[argon2]` (>=1.7.4)

**Action**:
1. Add missing dependencies to `pyproject.toml`.
2. Regenerate `uv.lock` via `uv sync`.
3. Delete `requirements.txt`.

### 2. Setup Script (`setup.sh`) (DEPL-01)
The script needs to handle bootstrapping `uv` if it's missing, ensuring a frictionless developer experience.

**Proposed Logic:**
```bash
#!/bin/bash
set -e

# 1. Check/Install uv
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env 2>/dev/null || source $HOME/.local/bin/env 2>/dev/null || true
fi

# 2. Sync dependencies
echo "Syncing dependencies..."
uv sync

# 3. Model Pre-download (Optional but good for 'setup')
# Ensures the app doesn't hang on first request
echo "Pre-downloading embedding models..."
uv run python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"
```

### 3. Start Script (`start.sh`) (DEPL-02)
Standardizes the launch command using `uv run`.

**Proposed Logic:**
```bash
#!/bin/bash
set -e

# Run with uv to ensure environment is active
exec uv run uvicorn src.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Docker Modernization (Optional/Recommendation)
While not strictly DEPL-01/02/03, the `Dockerfile` should ideally be updated to use `uv` for consistency, but we can defer this if out of scope. However, if we delete `requirements.txt`, the current Dockerfile **will break**.

**Critical Dependency**: The Dockerfile MUST be updated to use `uv` or `requirements.txt` must be generated from `uv` during build if we delete the source file.
**Recommendation**: Update Dockerfile to use `uv` for installation:
```dockerfile
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
```

## Risks & Considerations
1.  **Path Issues**: `uv` installation path might not be immediately available in the shell spawning the script. The script needs to handle `PATH` updates explicitly or use full paths.
2.  **FastEmbed Caching**: The current Dockerfile caches the model. `setup.sh` should likely mirror this behavior for local dev so users don't face timeouts on first run.
