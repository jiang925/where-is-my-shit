---
phase: 10
plan: 10-02
subsystem: deployment
tags:
  - scripts
  - uv
  - dx
dependency_graph:
  requires:
    - 10-01 (pyproject.toml)
  provides:
    - setup.sh
    - start.sh
  affects:
    - developer-workflow
tech_stack:
  added:
    - uv (script-based management)
  patterns:
    - one-command-setup
    - pre-download-models
key_files:
  created:
    - setup.sh
    - start.sh
  modified: []
decisions:
  - "Use `uv run` in start.sh to guarantee environment consistency without manual activation"
  - "Pre-download embedding models in setup.sh to prevent first-request latency/timeout"
metrics:
  duration: "5 minutes"
  completed_date: "2026-02-09"
---

# Phase 10 Plan 10-02: Deployment Scripts Summary

Standardized the developer and deployment experience with consistent shell scripts powered by `uv`.

## 1. One-Command Setup (`setup.sh`)
- **Auto-installation**: Detects if `uv` is missing and installs it automatically.
- **Dependency Sync**: Runs `uv sync` to ensure the environment matches `uv.lock`.
- **Model Pre-warming**: Downloads `BAAI/bge-small-en-v1.5` during setup, preventing the 30s+ delay that would otherwise occur on the first search request.

## 2. Standardized Execution (`start.sh`)
- Wraps `uvicorn` invocation.
- Uses `uv run` to ensure the correct virtual environment is used, regardless of the user's current shell state.
- Enables hot-reloading by default for better DX.

## Deviations from Plan
None - plan executed exactly as written.

## Self-Check: PASSED
- [x] `setup.sh` exists and is executable
- [x] `start.sh` exists and is executable
- [x] Scripts use `uv` as planned
