---
phase: 12-debug-ui-api-connection
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [tests/test_cors_auth.py, ui/vite.config.ts]
autonomous: true

must_haves:
  truths:
    - "Developer can run pytest tests and see CORS verification tests pass"
    - "Developer can run npm run dev without CORS errors when testing UI"
    - "Developer can verify CORS headers are present in browser network tab"
  artifacts:
    - path: "tests/test_cors_auth.py"
      provides: "CORS and API key authentication regression tests"
      min_lines: 50
      exports: ["test_cors_headers_present", "test_preflight_options", "test_api_key_auth"]
    - path: "ui/vite.config.ts"
      provides: "Vite dev server proxy configuration"
      contains: "server: { proxy: {"
  key_links:
    - from: "tests/test_cors_auth.py"
      to: "src/app/main.py"
      via: "TestClient middleware verification"
      pattern: "CORSMiddleware|access-control-allow"
    - from: "ui/vite.config.ts"
      to: "http://localhost:8000"
      via: "proxy configuration for dev mode"
      pattern: "proxy.*target.*localhost"
---

<objective>
Add CORS regression tests and Vite proxy configuration to ensure UI/API connection works in both production and development environments. The CORS middleware is correctly configured; this plan adds tests to prevent regressions and configures dev mode proxy for smoother development.

Purpose: Verify CORS and authentication are properly configured and provide dev mode setup
Output: Regression tests for CORS/auth + Vite proxy configuration
</objective>

<execution_context>
@/home/pter/.claude/get-shit-done/workflows/execute-plan.md
@/home/pter/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/12-debug-ui-api-connection/12-CONTEXT.md
@.planning/phases/12-debug-ui-api-connection/12-debug-ui-api-connection-RESEARCH.md

# Current Implementation Reference
@src/app/main.py          # CORS middleware configuration (lines 58-68)
@src/app/core/auth.py       # API key verification (verify_api_key function)
@ui/src/lib/api.ts         # Axios interceptor (X-API-Key header injection)
@tests/core/test_auth.py     # Existing auth tests (reference pattern)
@tests/conftest.py          # Test fixtures (reference pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create CORS and Auth Regression Tests</name>
  <files>tests/test_cors_auth.py</files>
  <action>
Create `tests/test_cors_auth.py` with the following tests:

1. **test_cors_headers_on_search_request**:
   - Use TestClient to POST to /api/v1/search with valid X-API-Key header
   - Assert response includes access-control-allow-origin header
   - Mock the API key using monkeypatch to match a test key
   - Assert status is either 200 or 403 (either means CORS worked, just auth differs)

2. **test_preflight_options_request**:
   - Send OPTIONS request to /api/v1/search with preflight headers
   - Include Origin: http://localhost:5173
   - Include Access-Control-Request-Method: POST
   - Include Access-Control-Request-Headers: content-type, x-api-key
   - Assert status is 200
   - Assert access-control-allow-origin is "*"
   - Assert POST is in access-control-allow-methods

3. **test_api_key_required**:
   - POST to /api/v1/search WITHOUT X-API-Key header
   - Assert status is 403
   - Assert detail is "Missing API Key"

4. **test_api_key_invalid**:
   - POST to /api/v1/search with invalid X-API-Key header
   - Assert status is 403
   - Assert detail is "Invalid API Key"

5. **test_health_endpoint_no_auth**:
   - GET to /api/v1/health without X-API-Key header
   - Assert status is 200 (health endpoint should be public)
   - Assert response contains status: "healthy"

Use the existing test pattern from `tests/core/test_auth.py` for mocking settings with monkeypatch.
</action>
  <verify>
Run `uv run pytest tests/test_cors_auth.py -v` and verify all 5 tests pass.
</verify>
  <done>
All 5 CORS/auth tests pass, confirming CORS headers are present and API key authentication is enforced correctly.
</done>
</task>

<task type="auto">
  <name>Task 2: Configure Vite Dev Server Proxy</name>
  <files>ui/vite.config.ts</files>
  <action>
Modify `ui/vite.config.ts` to add a proxy configuration for development mode:

1. Add `server` configuration object with a `proxy` section:
   - Route `/api` requests to `http://localhost:8000`
   - Set `changeOrigin: true` to avoid CORS issues during dev
   - This proxy is ONLY used during `npm run dev`, not in production builds

2. The configuration should look like:
```typescript
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
        changeOrigin: true,
      }
    }
  }
})
```

DO NOT modify the baseURL in api.ts - keep it as `import.meta.env.VITE_API_URL || '/api/v1'` to work with both proxy (dev) and relative paths (production).
</action>
  <verify>
Run `cat ui/vite.config.ts` and verify it contains `server: { proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } } }`.
</verify>
  <done>
Vite config includes proxy configuration that routes /api requests to localhost:8000 during dev mode, preventing CORS issues.
</done>
</task>

<task type="auto">
  <name>Task 3: Create Verification Guide</name>
  <files>docs/PHASE12_VERIFICATION.md</files>
  <action>
Create `docs/PHASE12_VERIFICATION.md` with step-by-step instructions for verifying UI/API connection:

Include these sections:

1. **Quick Verification** (browser-based):
   - Start server: `./start.sh`
   - Open browser to http://localhost:8000
   - Enter API key from server startup logs (or `cat ~/.wims/server.json`)
   - Open DevTools (F12) and go to Console tab
   - Perform a search query
   - Verify NO CORS errors appear

2. **Network Tab Verification**:
   - Open Network tab in DevTools
   - Filter by "Fetch/XHR"
   - Click on the /api/v1/search request
   - Check Request Headers: should include `X-API-Key`
   - Check Response Headers: should include `access-control-allow-origin: *`

3. **Automated Test Verification**:
   - Run CORS tests: `uv run pytest tests/test_cors_auth.py -v`
   - All 5 tests should pass

4. **Troubleshooting**:
   - If CORS errors appear: Check server is running on port 8000
   - If 403 errors: Verify API key matches server startup logs
   - If empty results: Database may be empty - run ingestion first

Keep guide concise and actionable.
</action>
  <verify>
Run `cat docs/PHASE12_VERIFICATION.md` and verify it contains sections for Quick Verification, Network Tab Verification, Automated Test Verification, and Troubleshooting.
</verify>
  <done>
Verification guide exists with clear steps for manual browser-based verification and troubleshooting common issues.
</done>
</task>

</tasks>

<verification>
1. Run `uv run pytest tests/test_cors_auth.py -v` - all 5 tests pass
2. Run `cat ui/vite.config.ts | grep -A 4 proxy` - shows proxy configuration
3. Run `cat docs/PHASE12_VERIFICATION.md` - verification guide exists
4. Manual verification: Start server, open UI, enter API key, search, check browser console for no CORS errors
</verification>

<success_criteria>
1. Developer can run `uv run pytest tests/test_cors_auth.py -v` and see all tests pass
2. Developer can run `npm run dev` without CORS errors when API is running
3. Developer can load UI in browser, enter API key, and perform searches without CORS errors in console
4. Developer can view Network tab and confirm X-API-Key and CORS headers are present
</success_criteria>

<output>
After completion, create `.planning/phases/12-debug-ui-api-connection/12-debug-ui-api-connection-01-SUMMARY.md` with:
- Files created/modified
- Test results
- Any issues encountered
- Verification confirmation
</output>
