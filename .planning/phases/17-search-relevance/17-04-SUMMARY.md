---
phase: 17-search-relevance
plan: 04
subsystem: db-migration
tags: [schema-evolution, re-embedding, cli, batch-processing, zero-downtime]

# Dependency graph
requires:
  - phase: 01-core-setup
    provides: LanceDB client and configuration management
  - phase: 17-01
    provides: Configurable embedding provider abstraction
provides:
  - Schema evolution utilities (add_vector_v2_column)
  - Batch re-embedding for model migration
  - CLI command for migration management
  - Migration status tracking
affects: [17-05, future-embedding-upgrades]

# Tech tracking
tech-stack:
  added: []
  patterns: [schema-evolution, batch-processing, idempotent-operations, pyarrow-schema]

key-files:
  created:
    - src/app/db/migration.py
    - tests/test_migration.py
  modified:
    - src/app/schemas/message.py
    - src/cli.py

key-decisions:
  - "Use vector_v2 column approach for zero-downtime migration (not schema replacement)"
  - "Add columns dynamically using PyArrow schema (LanceDB add_columns API)"
  - "CLI-driven migration (lazy approach) instead of automatic background process"
  - "Track embedding_model field in Message schema for migration verification"
  - "Idempotent operations - can run migration multiple times safely"
  - "Batch processing with configurable delay to avoid overwhelming CPU/GPU"

patterns-established:
  - "Schema evolution: Dynamic column addition without table recreation"
  - "Migration status tracking: NULL checks to determine progress"
  - "Batch re-embedding: Process unmigrated documents in configurable batches"
  - "CLI management: Status checking and migration execution via command line"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 17 Plan 04: Database Schema Evolution and CLI Re-embedding Summary

**Lazy embedding migration with vector_v2 column approach, batch re-embedding, and CLI management interface**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T21:51:35Z
- **Completed:** 2026-02-13T21:55:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created migration module with schema evolution and batch re-embedding utilities
- Added vector_v2 and embedding_model_v2 columns dynamically using PyArrow schema
- Implemented batch re-embedding with configurable batch size and delay
- Added migration status tracking (total, migrated, remaining, percent_complete)
- Created CLI reembed command with --status, --batch-size, and --delay flags
- All operations are idempotent and can be run multiple times safely
- Added embedding_model field to Message schema for tracking which model generated embeddings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration module with schema evolution and batch re-embedding** - `ac4fd46` (feat)
2. **Task 2: Add CLI reembed command for migration management** - `bba06a3` (feat)

## Files Created/Modified

**Created:**
- `src/app/db/migration.py` - Schema evolution utilities and batch re-embedding logic
- `tests/test_migration.py` - Comprehensive tests for migration functionality

**Modified:**
- `src/app/schemas/message.py` - Added embedding_model field for tracking
- `src/cli.py` - Added reembed subcommand with status and execution modes

## Decisions Made

1. **vector_v2 column approach** - Using a second vector column allows zero-downtime migration. Old searches use vector, new ingestions write to both during migration, and after completion the system can switch to vector_v2.

2. **Dynamic column addition with PyArrow** - LanceDB's add_columns API accepts PyArrow Field or Schema objects. Vector column is defined as `pa.list_(pa.float32(), dimensions)` with NULL default values.

3. **CLI-driven lazy migration** - Instead of automatic background re-embedding (which requires Celery or similar), users trigger migration via CLI command. Simpler architecture, predictable resource usage.

4. **Idempotent operations** - All migration functions check state before modifying (e.g., add_vector_v2_column checks if columns exist). Can be interrupted and resumed safely.

5. **Batch processing with delay** - Configurable batch size (default 100) and inter-batch delay (default 0.5s) prevents overwhelming CPU/GPU during migration. Users can adjust for their hardware.

6. **Migration status tracking** - get_migration_status() queries for NULL vector_v2 rows to calculate progress. Provides clear feedback to users about migration state.

## Deviations from Plan

None - plan executed exactly as written. LanceDB's add_columns API works as documented for adding null-initialized vector columns.

## Issues Encountered

None - implementation proceeded smoothly. PyArrow schema definition for fixed-size lists worked on first attempt.

## User Setup Required

None - no external dependencies or configuration needed. Migration is opt-in via CLI command.

**To use migration:**

1. **Check status:** `python -m src.cli reembed --status`
2. **Run migration:** `python -m src.cli reembed [--batch-size N] [--delay S]`
3. **Use custom config:** `python -m src.cli --config path/to/config.json reembed`

## Next Phase Readiness

**Ready for Phase 17 Plan 05:** Endpoint integration for multi-field search, hybrid search, and unified reranker.

Migration infrastructure is in place. Users can now:
- Switch embedding providers in config (fastembed, ollama, openai)
- Run migration to re-embed existing documents with new model
- Track migration progress
- Resume interrupted migrations safely

The endpoint integration plan can leverage this infrastructure to support model upgrades in production.

## Self-Check: PASSED

All created files verified:
- ✓ FOUND: src/app/db/migration.py
- ✓ FOUND: tests/test_migration.py

All commits verified:
- ✓ FOUND: ac4fd46 (Task 1)
- ✓ FOUND: bba06a3 (Task 2)

All tests pass:
- ✓ 12 migration tests passed in 0.04s
- ✓ 61 total tests passed in 0.45s

CLI commands work:
- ✓ python -m src.cli --help shows both "start" and "reembed" commands
- ✓ python -m src.cli reembed --help shows all options (--batch-size, --delay, --status)

---
*Phase: 17-search-relevance*
*Completed: 2026-02-13*
