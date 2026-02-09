# Phase 6: Security Core - Research

## 1. Architecture Overview

The security layer will sit in front of the core API, intercepting requests to enforce authentication and access control. We will verify identity using **JWT (JSON Web Tokens)** signed with a locally generated secret.

### Components

1.  **Auth Database (`auth.db`)**: A dedicated SQLite database to store credentials. This separates security concerns from the main content vector database (`wims.lance`).
2.  **Auth Service**: Handles password hashing, verification, token generation, and validation.
3.  **Middleware**:
    -   **AuthMiddleware**: Intercepts requests, validates Bearer tokens.
    -   **CORSMiddleware**: configured strictly.
4.  **CLI Tools**: For initial setup and password recovery.

## 2. dependencies

We need to add the following Python packages to `requirements.txt`:

-   `pyjwt`: For generating and verifying JSON Web Tokens.
-   `passlib[argon2]`: For robust password hashing (Argon2 is the modern standard, superior to bcrypt).

## 3. Implementation Details

### A. Authentication Database (`data/auth.db`)

We will use Python's built-in `sqlite3` library. No complex ORM is needed for this single-table requirement.

**Schema:** `system_auth`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Always 1 (single user system) |
| `password_hash` | TEXT | Argon2 hash of the current password |
| `token_valid_after` | REAL | Timestamp (Unix epoch). Tokens issued before this are invalid. |

**Rationale:**
-   **Single User:** simpler than a full user table.
-   **Revocation:** When password is changed, update `token_valid_after`. Middleware checks `iat` (issued at) claim > `token_valid_after`.

### B. Configuration & Secrets

We need to extend `src/app/core/config.py`:
-   `JWT_SECRET_KEY`: Auto-generated on first run if not present? Or stored in `auth.db`?
    -   *Decision:* Store `jwt_secret` in `auth.db` or generate one-time on startup if stateless?
    -   *Better approach:* Generate a strong random `JWT_SECRET` and store it in `.env` or `auth.db`. Given we already use `auth.db`, we can store it there or just rely on the password hash as part of the secret (though that's less standard).
    -   *Selected approach:* Store a persistent random `secret_key` in the `system_auth` table. This ensures tokens survive server restarts.

### C. Authentication Flow

1.  **First Run / Setup**:
    -   App startup checks for `data/auth.db`.
    -   If missing:
        1.  Initialize DB.
        2.  Generate `secret_key`.
        3.  Generate random password (e.g., `secrets.token_urlsafe(16)`).
        4.  Hash password and store with `token_valid_after = now`.
        5.  **PRINT PASSWORD TO STDOUT** with clear instructions.

2.  **Login (`POST /api/v1/auth/login`)**:
    -   Input: `{"password": "..."}`
    -   Action: Verify hash.
    -   Output: `{"access_token": "...", "token_type": "bearer", "expires_in": 2592000}` (30 days).
    -   **Rate Limiting:** Use a simple in-memory counter or `time.sleep` with exponential backoff on failure (1s, 2s, 4s) to deter brute-force.

3.  **Request Verification**:
    -   Check `Authorization: Bearer <token>` header.
    -   Decode JWT using stored secret.
    -   Verify `exp` (expiration).
    -   Verify `iat` > `token_valid_after` (from DB).

### D. Network Security

1.  **Bind Address**:
    -   Modify `src/app/main.py` or the run script to default to `127.0.0.1`.
    -   Add CLI arg/Env var `WIMS_HOST` to override (e.g., set to `0.0.0.0` for LAN).

2.  **CORS**:
    -   Strict whitelist.
    -   `127.0.0.1`, `localhost`.
    -   Chrome Extension ID (needs to be configurable or fixed if published).
    -   *Action:* Add `ALLOWED_ORIGINS` to `config.py`.

### E. CLI Recovery

Create a script `src/cli.py` (or integrated into `main.py` entry point) to handle:
-   `reset-password`: Prompts for new password (or auto-generates), updates hash and `token_valid_after` in `auth.db`.
-   This requires local shell access, serving as "proof of ownership".

## 4. Work Plan

1.  **Dependencies**: Add `pyjwt`, `passlib[argon2]`.
2.  **Auth Module**: Create `src/app/core/auth.py` for hashing/JWT logic.
3.  **Database**: Create `src/app/db/auth.py` for SQLite interactions.
4.  **API**: Add `src/app/api/v1/endpoints/auth.py` (Login).
5.  **Middleware**: Implement JWT check in `src/app/core/security.py` or directly in `main.py` via dependency injection (`get_current_user`).
    -   *Note:* FastAPI dependency injection (`Depends(get_current_user)`) is preferred over raw middleware for route-specific protection (e.g., keeping `/health` open).
6.  **Hardening**: Configure CORS and bind address.
7.  **Extension**: Update extension to store token and handle 401s (UI work).

## 5. Risks & Mitigations

-   **Token Leakage**: Tokens are long-lived (30 days).
    -   *Mitigation:* "Reset Password" feature immediately invalidates all tokens via `token_valid_after` timestamp check.
-   **Lockout**: User loses password.
    -   *Mitigation:* CLI reset tool.
-   **LAN Exposure**: User accidentally exposes API.
    -   *Mitigation:* Default bind to loopback (`127.0.0.1`).
