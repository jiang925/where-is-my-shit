# Phase 7: Integration Hardening - Research

**Date:** 2026-02-07
**Status:** Completed

## 1. Extension Authentication (HARD-01)

The Chrome extension needs to transition from open access to authenticated access.

### 1.1 Components to Modify
- **`extension/src/lib/storage.ts`**: Add `authToken` to `LocalStorage` interface.
- **`extension/src/lib/api.ts`**:
  - Update `sendMessage` and `checkHealth` to read `authToken` and append `Authorization: Bearer <token>` header.
  - Implement 401 interception. On 401, return specific error or emit event.
- **`extension/src/background/service-worker.ts`**:
  - Listen for auth failures.
  - Set extension badge to indicate "Auth Required".
  - Pause queue processing until re-authenticated.
- **`extension/src/popup/popup.html` & `popup.ts`**:
  - Add "Login" view (swappable with current "Status" view).
  - Implement login form submission to `<server>/api/v1/auth/login`.
  - On success, save token and switch view.

### 1.2 Auth Flow
1. **Request:** Service worker attempts to send payload.
2. **Failure:** Server returns 401.
3. **Handling:** `ApiClient` catches 401 -> `ServiceWorker` handles error -> Sets state `authRequired: true` -> Updates Badge "!" -> Notifies user (Notification API).
4. **Resolution:** User clicks extension -> Popup shows Login Form -> User enters password -> Extension authenticates -> Saves Token -> Clears `authRequired` -> Resumes Queue.

## 2. Watcher Authentication (HARD-02)

The Python watcher needs to manage long-lived authentication sessions without user interactivity.

### 2.1 Configuration
- **Location:** `~/.wims/config.json` (Standardize on this path).
- **Structure:**
  ```json
  {
    "api_url": "http://localhost:8000",
    "password": "user-set-password"
  }
  ```

### 2.2 Token Persistence
- **Cache File:** `~/.wims/token` (Plain text JWT).
- **Logic:**
  1. **Startup:** Load config. Check `~/.wims/token`.
  2. **Verify:** If token exists, try a lightweight request (e.g., `HEAD /api/v1/health` with auth if endpoint supports it, or just use it).
  3. **Refresh:** If token missing or 401 received:
     - Use `password` from config to POST `/api/v1/auth/login`.
     - Save new token to `~/.wims/token`.
     - Retry original request.
  4. **Failure:** If login fails (wrong password), log fatal error and exit (Fail Fast).

### 2.3 Code Changes
- **`wims-watcher/src/client.py`**:
  - Refactor `WimsClient` to accept `config_path`.
  - Add `login()` method.
  - Add `_get_headers()` helper.
  - Update `ingest()` to wrap request with 401 retry logic.

## 3. Integration Testing (TEST-02)

### 3.1 Strategy
Since the extension is hard to integration test in a headless CI environment without complex Selenium setup, we will focus `TEST-02` on the **Watcher <-> Server** flow, which proves the API auth mechanism works.

### 3.2 Test Plan
- **File:** `tests/integration/test_api_auth.py`
- **Steps:**
  1. **Setup:** Spin up `uvicorn` server in background thread/process with a known password configured.
  2. **Scenario A (Happy Path):** Configure `WimsClient` with correct password. verify `ingest` succeeds.
  3. **Scenario B (Bad Password):** Configure `WimsClient` with wrong password. Verify `login` fails.
  4. **Scenario C (Expired Token):** Manually expire token (or mock), verify client auto-refreshes.

## 4. Risks & Mitigations
- **Risk:** Infinite loops if 401 handling is buggy (401 -> Login -> 401 -> Login...).
  - **Mitigation:** Implement `max_retries=1` for auth refresh logic.
- **Risk:** User password changes, watchers break silently.
  - **Mitigation:** Watchers should log clearly to stderr/syslog on auth failure.

## 5. Security Considerations
- **Token Storage:** Storing JWT on disk is standard for CLI tools (like `gh`, `aws`). File permissions should be `600`.
- **Config Security:** `config.json` contains the plaintext password. This is acceptable for a local-first tool (similar to `.pgpass` or `.npmrc`), but we should warn the user to set permissions.
