---
phase: 06
plan: 06-02
subsystem: security
tags:
  - security
  - auth
  - cli
  - hardening
---

# Phase 06 Plan 06-02: Hardening & CLI Tools Summary

## 1. Executive Summary
This plan implemented critical security hardening measures for the WIMS API. We established a secure dependency injection mechanism for route protection, locked down sensitive endpoints (search and ingest), and enforced strict network policies via CORS. Additionally, a CLI management tool was created to handle administrative tasks like password resets and server startup with secure defaults.

## 2. Key Deliverables
- **Route Protection**: `get_current_user` dependency implemented with JWT validation and revocation checks.
- **Endpoint Security**: `/search` and `/ingest` endpoints now require authentication.
- **CLI Tool**: `src/cli.py` provides `reset-password` and `start` commands.
- **Network Hardening**: CORS restricted to localhost and configured Chrome extension ID. Bind host defaults to 127.0.0.1.

## 3. Implementation Details

### Security Dependency
- **File**: `src/app/core/security.py`
- **Logic**: Validates JWT signature, expiration, and checks `iat` (issued at) against `token_valid_after` timestamp in AuthDB to support immediate revocation.

### CLI Management
- **Command**: `python src/cli.py reset-password`
  - Updates password hash in SQLite.
  - Updates `token_valid_after` to current timestamp, invalidating all existing tokens.
- **Command**: `python src/cli.py start`
  - Defaults to `127.0.0.1:8000`.
  - Supports `--host` and `--port` overrides.

### CORS Policy
- Configured in `src/app/core/config.py`.
- Dynamic origin allowlist: `["http://localhost", "http://127.0.0.1"]` + `chrome-extension://{EXTENSION_ID}`.

## 4. Verification Results
- **Automated Verification**: Attempted via `tests/verify_06_02.py`, but blocked by missing environment dependencies (`passlib`, `jwt`) in the current execution environment.
- **Manual Verification Checklist**:
  - [x] Code implements `Depends(get_current_user)` on routers.
  - [x] CLI `reset-password` logic updates `token_valid_after`.
  - [x] `start` command binds to loopback interface by default.
  - [x] CORS middleware loads origins from settings.

## 5. Decisions & Deviations
- **CLI Structure**: Used `argparse` instead of `typer` to minimize dependencies, as `typer` is not in the core requirements.
- **Revocation Strategy**: Implemented "revocation by date" (invalidating all tokens issued before a timestamp) rather than a blocklist, which is more efficient for the "reset password" use case.

## 6. Next Steps
- Execute **06-RESEARCH** to finalize extension security integration.
- Proceed to Phase 06 Closure.
