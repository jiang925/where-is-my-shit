# Phase 12 Verification Guide: UI/API Connection

This guide helps verify that the UI can communicate with the API correctly, including CORS and authentication.

## Quick Verification (Browser Based)

1. **Start the backend server:**
   ```bash
   ./start.sh
   ```

2. **Get the API key:**
   Look for a line like this in the server logs:
   ```
   API Key: <your-api-key-here>
   ```
   Or read from config:
   ```bash
   cat ~/.wims/server.json
   ```

3. **Open the UI:**
   Navigate to http://localhost:8000 in your browser.

4. **Enter the API key:**
   Paste the API key when prompted.

5. **Open DevTools:**
   Press F12 (or Ctrl+Shift+I) to open browser DevTools, then go to the Console tab.

6. **Perform a search:**
   Type a query in the search box and submit.

7. **Verify no CORS errors:**
   The Console tab should NOT show any CORS errors like:
   - `Access to XMLHttpRequest has been blocked by CORS policy`
   - `No 'Access-Control-Allow-Origin' header is present`

## Network Tab Verification

1. In DevTools, go to the Network tab.
2. Filter by "Fetch/XHR".
3. Click on the `/api/v1/search` request.
4. **Check Request Headers:**
   - Should include `X-API-Key: <your-api-key>`
5. **Check Response Headers:**
   - Should include `access-control-allow-origin: *`

## Automated Test Verification

Run the CORS and authentication regression tests:
```bash
uv run pytest tests/test_cors_auth.py -v
```

All 5 tests should pass:
- `test_cors_headers_on_search_request`
- `test_preflight_options_request`
- `test_api_key_required`
- `test_api_key_invalid`
- `test_health_endpoint_no_auth`

## Development Mode (Vite Proxy)

If you're running the UI with Vite dev server:
```bash
cd ui
npm run dev
```

The proxy configuration in `vite.config.ts` will automatically route `/api` requests to `http://localhost:8000`, preventing CORS issues during development.

## Troubleshooting

### CORS Errors Appear

**Symptom:** Browser shows CORS errors related to `Access-Control-Allow-Origin`

**Solutions:**
- Check that the backend server is running on port 8000: `http://localhost:8000`
- Verify the browser is not blocking requests (check extensions)
- Try clearing browser cache and disabling content blockers

### 403 Errors

**Symptom:** Requests return 403 status with "Missing API Key" or "Invalid API Key"

**Solutions:**
- Check that you entered the API key correctly from server logs
- Verify the API key matches what's shown on server startup
- Try re-entering the API key in the UI
- Check that localStorage `wims_api_key` contains the correct key (in DevTools Application tab)

### Empty Search Results

**Symptom:** API returns successfully but no results appear

**Solutions:**
- Database may be empty - run the data ingestion scripts first
- Check the query syntax - try simpler terms
- View the Network tab response to see what data structure is returned

### Server Not Reachable

**Symptom:** Cannot connect to http://localhost:8000

**Solutions:**
- Verify server is running: `ps aux | grep python` or check if port 8000 is open
- Check server logs for startup errors
- Try `./start.sh` again from the project root

## Success Criteria

Verification is successful when:
- [ ] No CORS errors appear in browser Console tab
- [ ] `/api/v1/search` requests return with status 200
- [ ] Request headers include `X-API-Key`
- [ ] Response headers include `access-control-allow-origin: *`
- [ ] All 5 automated tests pass
- [ ] You can search through the UI without errors
