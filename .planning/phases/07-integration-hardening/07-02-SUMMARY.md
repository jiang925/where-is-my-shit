---
phase: 07
plan: 02
subsystem: watcher
tags:
  - python
  - auth
  - jwt
  - cli
requires:
  - 06-02
provides:
  - Authenticated watcher CLI
affects:
  - wims-watcher
tech-stack:
  added: []
  patterns:
    - JWT Bearer Auth
    - Config-based Credentials
key-files:
  created:
    - wims-watcher/src/config.py
  modified:
    - wims-watcher/src/client.py
    - wims-watcher/src/main.py
    - wims-watcher/src/sources/base.py
decisions:
  - Used `~/.wims/config.json` for credentials storage to allow easy user configuration.
  - Implemented token persistence in `~/.wims/token` to minimize login requests on restart.
  - Added automatic 401 retry logic in the client to handle expired tokens transparently.
metrics:
  duration: "10m"
  completed: "2026-02-07"
---

# Phase 07 Plan 02: Watcher Authentication Summary

## Overview
Successfully updated the Python Watcher CLI to support the secure JWT authentication mechanism introduced in Phase 6. The watcher now reads credentials from a configuration file, authenticates with the Core Engine, and handles token management automatically.

## Tasks Completed
1. **Config Loading**: Implemented `load_config` in `src/config.py` to read `api_url` and `password` from `~/.wims/config.json`.
2. **Client Authentication**: Enhanced `WimsClient` to support login, token storage, and automatic token refresh on 401 errors.
3. **Watcher Integration**: Updated the main entry point and all source watchers to use the authenticated client instance.

## Deviations from Plan
None. Executed exactly as planned.

## Authentication Gates
The watcher now requires a valid configuration file at `~/.wims/config.json` with a password to operate. It will fail fast if this is missing, guiding the user to create it.

## Self-Check
- [x] `wims-watcher/src/config.py` created
- [x] Client handles JWT headers
- [x] Watchers accept client instance
