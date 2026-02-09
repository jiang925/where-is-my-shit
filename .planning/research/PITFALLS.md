# Pitfalls Research: Security & CI/CD Retrofit

**Domain:** Local-first Application (Python + React)
**Researched:** 2026-02-07
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: The "Cloud Auth" Complexity Trap

**What goes wrong:**
Implementing complex OAuth2/OIDC flows (Auth0, Cognito, Google Sign-in) for a local-first application intended for single-user or self-hosted use.

**Why it happens:**
Developers reach for "industry standard" libraries designed for SaaS platforms, assuming they are necessary for any security.

**How to avoid:**
Use **API Token/Key** or **Basic Auth** strategies for local apps. If a login UI is needed, implement a simple session-based auth using a locally stored hashed password (bcrypt) and a secure session cookie.

**Warning signs:**
- You are registering applications in Google Cloud Console or Auth0 dashboard.
- You are wrestling with callback URLs and redirect URIs for `localhost`.
- You need internet access just to log in to your local app.

**Phase to address:**
Phase 5 (Security Hardening)

---

### Pitfall 2: CI "Works on My Machine" Syndrome

**What goes wrong:**
CI pipelines fail consistently because they lack the specific local environment context (DB files, environment variables, specific tool versions) that exists on the developer's machine.

**Why it happens:**
Retrofitting CI to an existing codebase often reveals hidden dependencies on local state (e.g., an existing `db.sqlite3` file, absolute paths, or unlisted `pip`/`npm` dependencies).

**How to avoid:**
- **Containerize the test environment:** Ensure tests run in a clean environment (Docker or fresh virtualenv) locally before pushing.
- **Fixture factories:** Create all required data within the test setup; never rely on pre-existing DB state.
- **Explicit Dependency Locking:** Use `poetry.lock` or `package-lock.json` strictly.

**Warning signs:**
- Tests pass locally but fail in GitHub Actions.
- Error messages about missing files or directories in CI logs.
- "It works if I run `setup_db.sh` first" comments.

**Phase to address:**
Phase 5 (CI/CD Setup)

---

### Pitfall 3: The "Forever Local" Network Exposure

**What goes wrong:**
The application binds to `0.0.0.0` (all interfaces) by default to make "testing on mobile" easy, inadvertently exposing the unsecured local app to the entire public Wi-Fi or local network.

**Why it happens:**
Convenience during development (checking UI on phone) becomes the default configuration.

**How to avoid:**
- Bind to `127.0.0.1` (localhost only) by default.
- Require an explicit flag (e.g., `--host 0.0.0.0`) to expose it to the network.
- Print a clear warning to the console when exposed to the network.

**Warning signs:**
- Default configuration in `main.py` or `.env` uses `0.0.0.0`.
- No console warning when starting the server.

**Phase to address:**
Phase 5 (Security Hardening)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| **Hardcoded API Keys in Tests** | Fast setup for testing auth endpoints | Leaked secrets if repo becomes public; difficult rotation | NEVER (Use `.env.test` or mocks) |
| **Skipping Frontend Tests in CI** | Faster CI builds, less setup | UI breaks silently; requires manual regression testing | MVP / Prototype only |
| **Using `requests` instead of `TestClient`** | Familiar syntax | Slower tests; requires running server | Prototyping (Switch to Starlette `TestClient` ASAP) |
| **Single "Test DB" for all tests** | Easier setup | Race conditions; tests affect each other | NEVER (Use transaction rollbacks or in-memory DBs) |

## Integration Gotchas

Common mistakes when connecting frontend/backend in a local setup.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **CORS** | Enabling `Allow-All (*)` in production because dev failed | specific origin reflection or hosting from same origin (proxy) |
| **CSRF** | Ignoring CSRF because "it's an API" | Use SameSite=Strict cookies for browser-based API consumption |
| **Secrets** | Committing `.env` to Git | Add `.env` to `.gitignore` immediately; use `.env.example` |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Test Database Re-creation** | Test suite takes minutes to start | Use transaction rollbacks or in-memory SQLite for logic tests | > 50 tests |
| **Synchronous Password Hashing** | Login blocks the event loop | Run `bcrypt`/`argon2` in a threadpool (FastAPI default, but check custom implementation) | Concurrent logins |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **JWT in LocalStorage** | XSS attacks can steal the token | Use `HttpOnly; SameSite=Strict` Cookies for session tokens |
| **Missing Rate Limiting** | Brute force attacks on local login | Implement basic rate limiting on `/login` endpoints |
| **Verbose Error Messages** | Leaking stack traces to frontend | Global exception handler that sanitizes 500 errors in prod |

## "Looks Done But Isn't" Checklist

- [ ] **Auth Persistence:** User stays logged in after refresh (token refresh/storage works).
- [ ] **Logout:** Actually invalidates the session/token (server-side blacklist if JWT, or cookie clearing).
- [ ] **CI Speed:** CI runs in < 5 minutes (caching enabled for pip/npm).
- [ ] **Secret Hygiene:** No secrets in `git history` (use `git-secrets` or `trufflehog` to verify).
- [ ] **Error Handling:** 401/403 errors are handled gracefully by UI (redirect to login), not just blank screens.

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **"Cloud Auth" Complexity** | Phase 5 (Auth Design) | Review Auth Architecture: Is it self-contained? |
| **Hardcoded Secrets** | Phase 5 (Repo Setup) | Run `git grep` for keys; check `.gitignore` |
| **Network Exposure** | Phase 5 (Server Config) | Verify `127.0.0.1` default bind in config |
| **"Works on My Machine"** | Phase 5 (CI Setup) | CI Green on fresh pull request |
| **Flaky Tests** | Phase 5 (Testing) | Run tests 10x in a row locally |

## Sources

- [OWASP Top 10: Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [FastAPI Security Best Practices](https://fastapi.tiangolo.com/tutorial/security/)
- [Twelve-Factor App: Config](https://12factor.net/config)
- [GitHub Actions: Caching Dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
