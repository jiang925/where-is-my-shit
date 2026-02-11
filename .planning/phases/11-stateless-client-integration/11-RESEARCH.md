# Phase 11 Research: Stateless Client Integration

## Goal
Update the Browser Extension and File Watchers to utilize the new simplified authentication flow (API Key) instead of the previous JWT-based login flow.

## Current State Analysis

### 1. Browser Extension
- **Settings Storage (`src/lib/storage.ts`)**: Currently stores `authToken` (JWT) and `serverUrl`.
- **API Client (`src/lib/api.ts`)**:
  - Constructs `Authorization: Bearer <token>` header.
  - Handles 401/403 errors by throwing `AuthError`.
- **Service Worker (`src/background/service-worker.ts`)**:
  - Triggers "LOGIN" badge on `AuthError`.
  - Monitors storage changes to clear auth errors when a new token appears.
- **Options Page (`src/options/*`)**: Only allows setting `serverUrl`.

### 2. Python Watcher (`wims-watcher/`)
- **Config (`src/config.py`)**:
  - Reads `~/.wims/config.json`.
  - Expects `password` and `api_url`.
- **Client (`src/client.py`)**:
  - Implements `login()` method using password.
  - Manages session state and token file (`~/.wims/token`).
  - Auto-retries login on 401.
- **Main (`src/main.py`)**:
  - Performs initial login check at startup.

### 3. Server Config (`src/app/core/config.py`)
- The server now uses `~/.wims/server.json` as the source of truth.
- Contains `api_key` (generated on first run if missing).

## Implementation Plan

### Extension Updates (EXT-01, EXT-02)

1.  **Update Storage Schema**
    -   Modify `Settings` interface in `extension/src/lib/storage.ts`.
    -   Replace `authToken` with `apiKey`.

2.  **Modify Options UI**
    -   Update `extension/src/options/options.html` to add a password input field for "API Key".
    -   Update `extension/src/options/options.ts` to save/load the API Key.

3.  **Refactor API Client**
    -   In `extension/src/lib/api.ts`, change `getHeaders()` to use `X-API-Key: <apiKey>`.
    -   Remove `Authorization` header logic.

4.  **Simplify Service Worker**
    -   In `extension/src/background/service-worker.ts`, update `handleAuthError`.
    -   Instead of "LOGIN" badge (which implied a login flow), set badge to "CFG" or "KEY" to indicate missing/invalid configuration.
    -   Remove logic related to "detecting login from popup" since there is no login popup anymore.

### Watcher Updates (WATCH-01, WATCH-02)

1.  **Update Config Loading**
    -   In `wims-watcher/src/config.py`, change target file from `config.json` to `server.json`.
    -   Update validation to look for `api_key` instead of `password`.

2.  **Simplify Client**
    -   In `wims-watcher/src/client.py`:
        -   Remove `login()`, `_load_token()`, `_save_token()`.
        -   Remove `token_file` logic.
        -   Update `__init__` to accept `api_key`.
        -   Update `_get_headers()` to send `X-API-Key`.
        -   Remove retry logic for 401 (fail fast if key is wrong).

3.  **Update Main Entry**
    -   In `wims-watcher/src/main.py`:
        -   Initialize client with API Key from config.
        -   Remove initial login check.

## API Key Discovery
The server generates the API key in `~/.wims/server.json`.
- **Extension**: User must manually copy this key from the server logs (or the file) and paste it into the extension options.
- **Watcher**: Since the watcher runs locally, it can auto-discover the key by reading `~/.wims/server.json` directly, making it zero-conf for the user if they run it on the same machine.

## Files to Modify
- `extension/src/lib/storage.ts`
- `extension/src/lib/api.ts`
- `extension/src/options/options.html`
- `extension/src/options/options.ts`
- `extension/src/background/service-worker.ts`
- `wims-watcher/src/config.py`
- `wims-watcher/src/client.py`
- `wims-watcher/src/main.py`
