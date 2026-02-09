## Phase 09 Plan 02: Auth Switchover Summary

### One-Liner
Replaced complex JWT authentication with a stateless, persistent API Key system backed by config file storage.

### Key Changes
- **New Auth Scheme**: Implemented `X-API-Key` header validation using constant-time comparison.
- **Dependency Cleanup**: Removed `pyjwt` and `passlib` dependencies, reducing attack surface.
- **Code Removal**: Deleted ~200 lines of legacy auth code (login endpoints, password hashing, JWT issuance, SQLite auth DB).
- **Simplified Main**: Streamlined `src/app/main.py` lifespan and router inclusion.

### Verification Results
- **Unit Tests**: `tests/core/test_auth.py` confirms `verify_api_key` handles valid/invalid/missing keys correctly.
- **Static Analysis**: Grep checks confirmed `OAuth2PasswordBearer` and old auth modules are completely gone.
- **Self-Check**:
  - `src/app/core/auth.py` exists and provides API Key validation.
  - protected endpoints (`ingest`, `search`) now depend on `verify_api_key`.
  - `/login` route is removed.

### Deviations
None. Plan executed exactly as written.

### Next Steps
- Proceed to Plan 03: CLI Startup & Server Management to finalize the user experience.
