---
phase: 09-api-key-auth
plan: 02
type: execute
wave: 2
depends_on: [09-01]
files_modified: [src/app/core/auth.py, src/app/api/deps.py, src/app/api/auth.py, src/app/main.py]
autonomous: true
must_haves:
  truths:
    - "API requests with correct X-API-Key return 200"
    - "API requests with missing/wrong key return 403"
    - "JWT endpoints (login/refresh) are gone"
  artifacts:
    - path: "src/app/core/auth.py"
      provides: "API Key validation"
  key_links:
    - from: "src/app/api/deps.py"
      to: "src/app/core/config.py"
      via: "get_settings().api_key"
---

<objective>
Replace JWT authentication with stateless API Key validation.
Purpose: Simplify client integration and support persistent background watchers.
Output: Secured API endpoints using X-API-Key header.
</objective>

<context>
@src/app/core/config.py
@src/app/api/deps.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement API Key Security Scheme</name>
  <files>src/app/core/auth.py</files>
  <action>
    Define `APIKeyHeader` scheme (name="X-API-Key").
    Create `verify_api_key` function:
    - Depends on `get_settings` from config.
    - Compares header value with `settings.api_key` using `secrets.compare_digest`.
    - Raises HTTPException(403) if invalid.
  </action>
  <verify>
    Unit test `verify_api_key` with valid and invalid keys.
  </verify>
  <done>
    Security scheme defined and functional.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update API Dependencies</name>
  <files>src/app/api/deps.py</files>
  <action>
    Replace existing `get_current_user` (JWT) logic with `verify_api_key`.
    Ensure all protected endpoints now require the API key.
    Remove `OAuth2PasswordBearer` usage.
  </action>
  <verify>
    `grep "OAuth2PasswordBearer" src/app/api/deps.py` returns nothing.
  </verify>
  <done>
    Dependency injection updated to enforce API keys.
  </done>
</task>

<task type="auto">
  <name>Task 3: Remove JWT Routes and Cleanup</name>
  <files>src/app/api/api_v1/endpoints/login.py, src/app/api/auth.py, src/app/main.py</files>
  <action>
    Delete JWT-related endpoints (login, refresh).
    Remove `passlib` and `pyjwt` imports/usage.
    Remove `src/app/core/security.py` (password hashing utils) if it exists.
    Update `src/app/main.py` router inclusions if necessary.
  </action>
  <verify>
    Attempting to access /login returns 404.
  </verify>
  <done>
    Legacy auth code completely removed.
  </done>
</task>

</tasks>