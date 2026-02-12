# Phase 12: Debug UI/API Connection - Research

**Researched:** 2026-02-12
**Domain:** FastAPI CORS Configuration + React Axios API Integration
**Confidence:** HIGH

## Summary

This phase focuses on resolving CORS and authentication barriers between the React UI and FastAPI backend. The current setup has a sophisticated implementation:
- FastAPI already configures CORSMiddleware with `allow_origins=["*"]`, `allow_credentials=False`, and proper headers
- React UI uses axios with X-API-Key authentication stored in localStorage
- The UI is built with Vite and outputs to `src/static/` for FastAPI to serve

The primary research finding is that the infrastructure is already correctly configured for the stated use case: a local development tool that needs to work across network devices with API key authentication. The issue is likely operational (missing test data, incorrect API key entry) rather than configuration.

**Primary recommendation:** Focus verification on:
1. Browser console for CORS errors (should be none given current config)
2. Network tab for request/response headers
3. API key entry and localStorage persistence
4. Test data availability in LanceDB

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **CORS verification**: Browser console check - absence of CORS errors indicates proper configuration
- **Testing strategy**: Add automated tests to verify CORS and authentication (prevents regressions)
- **Definition of done**: "I just need the basics. The search UI works." - pragmatic, outcome-focused criterion

### Claude's Discretion
- API key authentication verification method (header inspection, functional testing, or both)
- Specific test framework and test structure
- Level of test coverage and test scenarios
- Documentation and debugging tools

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.109.0+ | Python web framework | Built-in CORSMiddleware, async support, automatic OpenAPI |
| React | 19.2.0 | Frontend UI | Modern React with hooks for state management |
| Axios | 1.13.4 | HTTP client | Interceptor support for auth headers, request/response handling |
| Vite | 7.2.4 | Build tool | Dev server proxy support, fast HMR, production optimization |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.90.20 | Data fetching | For complex caching, infinite scroll, stale-time management |
| pytest | 8.0.0+ | Python testing | Async test support, fixtures, parametrization |
| httpx | 0.26.0+ | Async HTTP client | FastAPI TestClient uses it under the hood for async testing |
| secrets | stdlib | Secure comparison | Constant-time comparison for API keys (prevents timing attacks) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Axios | Fetch API | Axios has better interceptor support for auth headers and error handling |
| CORSMiddleware | Starlette middleware | CORSMiddleware is the documented FastAPI way with battle-tested defaults |
| TestClient | Playwright/Requests | TestClient is synchronous with async support, perfect for unit testing API endpoints |

**Installation:**
```bash
# Python (FastAPI side)
# Already installed in pyproject.toml:
# fastapi>=0.109.0
# uvicorn[standard]>=0.27.0
# pytest>=8.0.0
# httpx>=0.26.0
# pyjwt>=2.8.0

# Frontend (React side)
# Already installed in ui/package.json:
# axios>=1.13.4
# vite>=7.2.4
# @tanstack/react-query>=5.90.20
```

## Architecture Patterns

### Current Implementation Analysis

**FastAPI CORS Configuration** (`src/app/main.py:58-68`):
```python
# Current state: CORRECTLY configured for API key auth
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Required: allows any origin since allow_credentials=False
    allow_credentials=False,         # Required: false when allow_origins=["*"]
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],           # Required: allows X-API-Key header
)
```

**Why This Configuration is Correct:**
- `allow_origins=["*"]` with `allow_credentials=False` is valid and secure for API key auth
- The X-API-Key header is sent without cookies, so credentials aren't needed
- This enables access from any device on local network (laptops, phones, etc.)

**React API Client** (`ui/src/lib/api.ts:38-64`):
```typescript
// Axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

// Request interceptor: adds X-API-Key header
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('wims_api_key');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Response interceptor: handles auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('wims_api_key');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);
```

### Pattern 1: CORS Verification with Browser DevTools

**What:** Use browser developer tools to verify CORS headers and diagnose connection issues.

**When to use:** During debugging when UI cannot reach API endpoints.

**Verification Steps:**
1. Open browser DevTools (F12 or Cmd+Opt+I)
2. Go to Network tab
3. Filter by "XHR" or "Fetch"
4. Make a search request from UI
5. Click on the failed request
6. Check Response Headers for:
   - `access-control-allow-origin: *`
   - `access-control-allow-methods: GET, POST, OPTIONS`
   - `access-control-allow-headers: *`

**Success Indicators:**
- No CORS errors in Console tab
- Request reaches server (see in Network tab)
- Response has 200 OK status (or 403 for invalid API key, which is expected)

**Common CORS Error Patterns:**
```
# Missing origin header
"Access to XMLHttpRequest at 'http://localhost:8000/api/v1/search' has been blocked
by CORS policy: No 'Access-Control-Allow-Origin' header is present"

# Preflight failure (OPTIONS request)
"Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Headers' header"
```

### Pattern 2: FastAPI TestClient for CORS Testing

**What:** Use FastAPI's TestClient to verify CORS headers and authentication in unit tests.

**When to use:** For automated regression testing of CORS and auth configuration.

**Example:**
```python
from fastapi.testclient import TestClient
from src.app.main import app
import pytest

client = TestClient(app)

def test_cors_headers_on_search_request():
    """Verify CORS headers are present on search endpoint"""
    response = client.post(
        "/api/v1/search",
        json={"query": "test"},
        headers={"X-API-Key": "test-key"}
    )

    # Check CORS headers are present
    assert response.status_code in [200, 403]  # 200 if auth succeeds, 403 if key invalid
    assert "access-control-allow-origin" in response.headers

def test_preflight_options_request():
    """Verify OPTIONS preflight is handled correctly"""
    response = client.options(
        "/api/v1/search",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, x-api-key"
        }
    )

    # Preflight should succeed
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
    assert "POST" in response.headers.get("access-control-allow-methods", "")

def test_api_key_required():
    """Verify API key authentication is enforced"""
    # No API key header
    response = client.post("/api/v1/search", json={"query": "test"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Missing API Key"

    # Invalid API key
    response = client.post(
        "/api/v1/search",
        json={"query": "test"},
        headers={"X-API-Key": "invalid-key"}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid API Key"
```

### Pattern 3: Vite Dev Server Proxy for Development

**What:** Configure Vite proxy during development to avoid CORS issues between dev server (port 5173) and API (port 8000).

**When to use:** When developing UI locally with `npm run dev` while API runs on separate port.

**Example** (`ui/vite.config.ts`):
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: '../src/static',
    emptyOutDir: true,
  },
  base: '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,  // Important: sets Host header to target
        // No rewrite needed since we keep /api prefix
      }
    }
  }
})
```

**Why `changeOrigin: true` matters:**
- Vite dev server runs on localhost:5173
- API expects requests from localhost:8000
- `changeOrigin` sets the Host header to match target, avoiding CORS
- During production (when UI served by FastAPI), this proxy is not used

### Anti-Patterns to Avoid

- **`allow_credentials=True` with `allow_origins=["*"]`:** Browsers reject this combination. If credentials needed, use specific origins instead of wildcard.
- **Hardcoding API URLs:** Use environment variables (`VITE_API_URL`) for flexibility between dev/prod.
- **Bypassing CORS with browser flags:** Never recommend `--disable-web-security` to users; it's a security risk.
- **Testing only with same-origin:** Must test cross-origin (different ports or IPs) to verify CORS works.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS middleware | Custom CORS middleware | FastAPI CORSMiddleware | Handles preflight, credentials, headers correctly with browser-tested defaults |
| Secure comparison | Simple string equality | `secrets.compare_digest()` | Prevents timing attacks on API key validation |
| HTTP client | Fetch wrappers | Axios interceptors | Built-in auth header injection, error handling, request/response transformation |
| API testing | Manual curl/postman | FastAPI TestClient | Integrated with pytest, async support, fixtures for setup/teardown |

**Key insight:** CORS is a browser security feature. Custom implementations often miss edge cases like preflight requests, credential handling, and header whitelisting. The FastAPI CORSMiddleware is tested against real browsers, so use it instead of building your own.

## Common Pitfalls

### Pitfall 1: CORS Configuration in Wrong Order
**What goes wrong:** CORS middleware added after routes are registered, causing routes to be inaccessible.

**Why it happens:** FastAPI applies middleware in LIFO (last-in-first-out) order based on `app.add_middleware()` call sequence.

**How to avoid:** Always add CORS middleware immediately after creating the FastAPI app, before including routers.

**Warning signs:** Browser shows 404 on routes that should exist, or OPTIONS requests fail.

**Current code status:** ✅ Correctly ordered in `src/app/main.py:52-70` - middleware added before router inclusion.

### Pitfall 2: Testing CORS Without Preflight
**What goes wrong:** Unit tests only make GET/POST requests, missing OPTIONS preflight failures.

**Why it happens:** Non-simple requests (POST with JSON body, custom headers like X-API-Key) trigger preflight OPTIONS requests first.

**How to avoid:** Always test OPTIONS requests in CORS tests.

**Warning signs:** POST/GET work in Postman but fail in browser.

**Example test to add:**
```python
def test_preflight_options_with_custom_headers():
    """Test that preflight works with X-API-Key in requested headers"""
    response = client.options(
        "/api/v1/search",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, x-api-key"
        }
    )
    assert response.status_code == 200
```

### Pitfall 3: API Key Missing in localStorage
**What goes wrong:** UI shows authentication prompt, but entering key doesn't persist or isn't being sent.

**Why it happens:** localStorage writes can fail in certain browser contexts (private browsing, disabled storage), or key isn't being read by axios interceptor.

**How to avoid:**
1. Verify localStorage has the key: `localStorage.getItem('wims_api_key')` in console
2. Check Network tab for X-API-Key header in request
3. Add error handling for localStorage operations

**Warning signs:** Console shows 403 errors immediately after entering key, or key prompt keeps reappearing.

**Current code status:** ✅ UI correctly saves to localStorage (line 24 in App.tsx) and axios interceptor reads it (line 47 in api.ts).

### Pitfall 4: Vite Proxy Not Configured for Dev Mode
**What goes wrong:** CORS errors when running `npm run dev` in UI while API runs on port 8000.

**Why it happens:** Vite dev server runs on port 5173, making requests to localhost:8000 without proxy triggers CORS.

**How to avoid:** Add `server.proxy` config to `vite.config.ts` for development only.

**Warning signs:** CORS errors only in dev mode, not in production (when UI served by FastAPI).

**Current code status:** ❌ Vite proxy not configured in `ui/vite.config.ts` - this is a likely issue during development.

### Pitfall 5: Production vs Development URL Confusion
**What goes wrong:** UI works when served by FastAPI but fails when running Vite dev server.

**Why it happens:** `VITE_API_URL` not set for dev mode, defaulting to `/api/v1` which doesn't exist when Vite serves UI directly.

**How to avoid:**
- Dev mode: Set `VITE_API_URL` or use Vite proxy
- Production: Use `/api/v1` (relative URL works when served by FastAPI)

**Warning signs:** Fetching from localhost:5173 when expecting localhost:8000.

**Current code status:** ⚠️ `baseURL: import.meta.env.VITE_API_URL || '/api/v1'` defaults to relative path, which works for production but needs proxy or env var for dev.

## Code Examples

Verified patterns from official sources:

### CORS Configuration Check
```python
# Source: FastAPI CORSMiddleware documentation
# https://fastapi.tiangolo.com/tutorial/cors/

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Valid with allow_credentials=False
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### API Key Verification
```python
# Source: src/app/core/auth.py (current implementation)
import secrets
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(
    api_key_header_value: str | None = Security(api_key_header),
) -> str:
    if not api_key_header_value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing API Key",
        )

    settings = get_settings()

    # Constant-time comparison prevents timing attacks
    if not secrets.compare_digest(api_key_header_value, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API Key",
        )

    return api_key_header_value
```

### Frontend API Key Handling
```typescript
// Source: ui/src/lib/api.ts (current implementation)
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

// Interceptor: inject API key from localStorage
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('wims_api_key');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Interceptor: handle auth failures (clear key and reload)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('wims_api_key');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);
```

### TestClient CORS Test
```python
# Source: FastAPI testing documentation
# https://fastapi.tiangolo.com/tutorial/testing/

from fastapi.testclient import TestClient
from src.app.main import app

client = TestClient(app)

def test_cors_allow_all_origins():
    """Verify wildcard CORS is configured"""
    response = client.options(
        "/api/v1/search",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, x-api-key"
        }
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"

def test_search_with_api_key():
    """Test search endpoint with valid API key"""
    # Note: This requires mocking or actual API key from config
    response = client.post(
        "/api/v1/search",
        json={"query": "test"},
        headers={"X-API-Key": "sk-wims-test-key"}
    )

    # Accept 200 (success) or 403 (invalid key, but CORS worked)
    assert response.status_code in [200, 403]
    assert "access-control-allow-origin" in response.headers
```

### Vite Proxy Configuration (Recommended Addition)
```typescript
// Source: Vite server proxy documentation
// https://vitejs.dev/config/server-options.html#server-proxy

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
  // ... rest of config
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CORS handling | CORSMiddleware | FastAPI 0.x (from release) | Automatic preflight handling, browser-tested defaults |
| String comparison for secrets | `secrets.compare_digest()` | Python 3.6+ (security best practice) | Prevents timing attacks on sensitive data |
| Fetch API with manual headers | Axios interceptors | 2020s ecosystem standard | Centralized auth handling, automatic token injection, error retry |
| Production-only builds | Dev/prod split configuration | Vite 2.x+ | Dev server proxy, HMR, source maps for debugging |

**Deprecated/outdated:**
- **`uvicorn --reload` for production:** Use gunicorn/uwsgi for production, uvicorn reload only for dev
- **Allowing all origins with credentials:** Browsers reject this, must use specific origins if credentials needed
- **Testing CORS with Postman/curl:** Postman doesn't enforce CORS; must test with real browser

## Open Questions

1. **Current operational state unknown**
   - What we know: Code is correctly configured for CORS and API key auth
   - What's unclear: Is the issue CORS-related, auth-related, or data-related (empty database)?
   - Recommendation: Start with browser console inspection to identify actual failure point

2. **Test data availability**
   - What we know: Database at `data/wims.lance` should contain messages from ingestion
   - What's unclear: Has any data been ingested? Empty results are indistinguishable from broken API
   - Recommendation: Verify database has data first using CLI or direct inspection

3. **API key generation workflow**
   - What we know: API key auto-generated on first run, stored in `~/.wims/server.json`
   - What's unclear: Has user successfully obtained and entered the API key in UI?
   - Recommendation: Check server logs at startup for API key display, verify localStorage has key

## Sources

### Primary (HIGH confidence)
- **FastAPI Official Documentation** - CORSMiddleware configuration, testing with TestClient
  - https://fastapi.tiangolo.com/tutorial/cors/
  - https://fastapi.tiangolo.com/tutorial/testing/
- **FastAPI CORSMiddleware Source Code** - Implementation details for header handling
  - https://github.com/tiangolo/fastapi/blob/master/fastapi/middleware/cors.py
- **Python secrets module** - Constant-time comparison for secure API key validation
  - https://docs.python.org/3/library/secrets.html#secrets.compare_digest
- **Current codebase analysis** - Verified existing CORS and auth implementation
  - `/home/pter/code/where-is-my-shit/src/app/main.py`
  - `/home/pter/code/where-is-my-shit/src/app/core/auth.py`
  - `/home/pter/code/where-is-my-shit/ui/src/lib/api.ts`

### Secondary (MEDIUM confidence)
- **Vite Server Proxy Documentation** - Development proxy configuration for CORS
  - https://vitejs.dev/config/server-options.html#server-proxy
- **Vite Proxy Configuration Guide** - Comprehensive examples and common patterns
  - https://www.joshwcomeau.com/blog/vite-proxy-configuration-guide/
- **MDN Web Docs - CORS** - Browser behavior, error messages, debugging techniques
  - https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Axios Interceptors Documentation** - Request/response interception for auth headers
  - https://axios-http.com/docs/interceptors

### Tertiary (LOW confidence)
- **WebSearch findings** - Cross-verified with official sources where possible
  - CORS debugging in browser console
  - Vite proxy setup examples
  - TestClient CORS testing patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-documented, official sources available, and verified in current codebase
- Architecture: HIGH - CORS and auth patterns are battle-tested, current implementation follows FastAPI best practices
- Pitfalls: HIGH - Common CORS mistakes well-documented, verified against official FastAPI docs
- State of the art: MEDIUM - Some deprecation timelines estimated from ecosystem knowledge

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days for stable stack)
