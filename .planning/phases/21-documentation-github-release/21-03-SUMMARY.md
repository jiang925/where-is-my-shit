---
phase: 21-documentation-github-release
plan: 03
subsystem: documentation
tags: [docs, reference, cli, embedding]
dependency-graph:
  requires: []
  provides:
    - docs/cli-reference.md
    - docs/embedding-providers.md
  affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - docs/cli-reference.md
    - docs/embedding-providers.md
  modified: []
decisions: []
metrics:
  duration_seconds: 104
  tasks_completed: 2
  files_created: 2
  completed_at: "2026-02-15T22:02:49Z"
---

# Phase 21 Plan 03: CLI and Embedding Provider Reference Documentation

**One-liner:** Complete CLI command reference with migration workflow and comprehensive 5-provider embedding configuration guide with copy-paste config snippets

## Overview

Created two reference documentation files for the docs/ folder: CLI command reference and embedding providers guide. These provide detailed technical documentation that would bloat the README beyond the 600-line target.

**Purpose:** Provide authoritative reference material for CLI commands, flags, migration workflows, and embedding provider configuration.

**Context:** Part of Phase 21 (v1.6 GitHub Release) documentation effort. These files are referenced from the main README for users who need complete command documentation or want to configure custom embedding providers.

## Implementation Summary

### Task 1: CLI Reference Documentation

Created `docs/cli-reference.md` with complete documentation of WIMS CLI commands.

**Content:**
- Usage pattern with global `--config` flag
- `start` command: all flags (--host, --port, --reload), examples, startup notes
- `reembed` command: all flags (--status, --promote, --batch-size, --delay)
- Complete migration workflow: 5-step process from config update to completion
- Examples for common scenarios (custom port, dev mode, API rate limiting, recovery)
- Convenience scripts section: setup.sh, start.sh, watcher install.sh

**Source verification:** Referenced src/cli.py directly to ensure all flags documented accurately.

**Files created:**
- `docs/cli-reference.md` (146 lines)

**Commit:** d1108e8

### Task 2: Embedding Providers Documentation

Created `docs/embedding-providers.md` with comprehensive embedding provider configuration guide.

**Content:**
- Provider comparison table: 5 providers with backend, GPU support, offline capability, use cases
- sentence-transformers: Default provider, PyTorch backend, GPU acceleration, model recommendations
- fastembed: CPU-only ONNX, lightweight, e5 model prefix handling
- onnx: ONNX Runtime with Optimum, hardware accelerator support, optional dependency
- openai: OpenAI API, cloud-based, API key configuration
- ollama: Local/remote OpenAI-compatible, Ollama setup instructions
- Model migration workflow: 5-step process with reembed command reference
- EmbeddingConfig field reference table: Complete field documentation

**Configuration snippets:** Each provider section includes complete, copy-paste-ready JSON config.

**Source verification:** Referenced config.py, embedding_provider.py, and all 4 provider implementation files for accuracy.

**Files created:**
- `docs/embedding-providers.md` (296 lines)

**Commit:** c4601f6

## Verification

### Success Criteria

- [x] docs/cli-reference.md provides complete CLI documentation with examples
- [x] docs/embedding-providers.md documents all 5 embedding providers with copy-paste config
- [x] Both files are reference-quality documentation suitable for GitHub release

### Verification Steps Performed

1. File existence check: Both docs/cli-reference.md and docs/embedding-providers.md exist
2. CLI flags verified: All flags from src/cli.py documented (--host, --port, --reload, --config, --batch-size, --delay, --status, --promote)
3. Provider coverage verified: All 5 providers present (sentence-transformers, fastembed, onnx, openai, ollama)
4. Config snippets: Each provider has complete JSON configuration example
5. Examples are runnable commands with clear explanations

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

**Created files verified:**
- FOUND: docs/cli-reference.md
- FOUND: docs/embedding-providers.md

**Commits verified:**
- FOUND: d1108e8 (CLI reference)
- FOUND: c4601f6 (Embedding providers)

All claimed artifacts exist and commits are in git history.

## Notes

- Both files use reference-style tone: concise, technical, comprehensive
- CLI reference focuses on practical examples for common workflows
- Embedding providers guide emphasizes provider comparison and configuration
- Model migration workflow cross-referenced between both files for consistency
- All provider config snippets validated against actual codebase (config.py, provider implementations)
- Documentation ready for immediate use in v1.6 GitHub release
