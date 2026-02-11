---
id: 11-01-extension-update
name: Extension API Key Integration
goal: Update Browser Extension to use API Key authentication
owner: logic
dependencies: []
must_haves:
  - Extension Options page allows saving an API Key
  - Extension sends X-API-Key header in requests
  - All JWT/Password logic is removed from extension
---

<task type="auto" id="EXT-01">
  <files>
    <file>extension/src/lib/storage.ts</file>
  </files>
  <action>
    Update the Settings interface to include `apiKey` and remove `authToken`. Ensure default settings include an empty `apiKey`.
  </action>
  <verify>
    Build the extension and verify no type errors in storage.ts.
  </verify>
  <done>
    Settings interface has apiKey, authToken is removed.
  </done>
</task>

<task type="auto" id="EXT-02">
  <files>
    <file>extension/src/options/options.html</file>
    <file>extension/src/options/options.ts</file>
  </files>
  <action>
    1. Update options.html to add a password input field for "API Key".
    2. Update options.ts to save/load the apiKey to/from storage.
    3. Remove any legacy login/password UI elements if present.
  </action>
  <verify>
    Open the options page in a browser (or mock it) and verify the API Key can be saved and persists.
  </verify>
  <done>
    Options page saves API key to storage.
  </done>
</task>

<task type="auto" id="EXT-03">
  <files>
    <file>extension/src/lib/api.ts</file>
  </files>
  <action>
    Refactor `getHeaders()` to:
    1. Retrieve `apiKey` from storage.
    2. Set `X-API-Key` header.
    3. Remove `Authorization: Bearer` header logic.
    4. Throw an error if apiKey is missing when making requests.
  </action>
  <verify>
    Inspect code to ensure X-API-Key is used.
  </verify>
  <done>
    API requests include X-API-Key header.
  </done>
</task>

<task type="auto" id="EXT-04">
  <files>
    <file>extension/src/background/service-worker.ts</file>
  </files>
  <action>
    Update `handleAuthError` (or equivalent):
    1. On 401/403, set the extension badge to "KEY" or "CFG" instead of "LOGIN".
    2. Remove logic that opens a login popup or handles login messages.
  </action>
  <verify>
    Verify code handles 401s by indicating configuration is needed.
  </verify>
  <done>
    Service worker handles auth errors without login prompts.
  </done>
</task>
