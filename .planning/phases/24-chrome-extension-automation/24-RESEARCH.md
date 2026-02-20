# Phase 24: Chrome Extension Automation - Research

**Researched:** 2026-02-20
**Domain:** Chrome Web Store API, GitHub Actions automation, Extension publishing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Initial Web Store Submission:** Manual first submission via Chrome Web Store Developer Dashboard
- **Category:** Developer Tools
- **Initial visibility:** Unlisted (safer for initial release, can make public later)
- **Privacy Policy:** GitHub Pages hosting (jiang925.github.io/wims/privacy or similar)
- **Policy Content:** Simple and clear - what data we collect (none), plain English
- **Policy Language:** English only (Web Store standard)
- **Contact:** GitHub Issues link for privacy questions
- **Publish frequency:** Every CalVer tag triggers extension publish (unified versioning)
- **Beta channel:** No beta testing channel for v1.7 (keep simple)
- **Review process:** Standard Chrome Web Store review (~24 hours for updates)
- **Credentials:** GitHub Secrets for Chrome Web Store API tokens
- **Build validation:** Build extension zip and validate manifest.json schema before publishing

### Claude's Discretion
- Rollback strategy (manual via Web Store is acceptable)
- GitHub Pages site structure
- Extension zip build script details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXT-01 | Users can install WIMS extension directly from Chrome Web Store | Manual first submission establishes store listing |
| EXT-02 | Extension version in manifest.json matches git tag automatically | Already handled by Phase 22's version-sync job |
| EXT-03 | GitHub Actions publishes new versions to Web Store on extension-v* tags | Chrome Web Store API with GitHub Actions integration |
| EXT-04 | Privacy policy page is accessible and compliant with Web Store requirements | GitHub Pages static site with simple HTML page |
</phase_requirements>

## Summary

Phase 24 implements automated Chrome extension publishing to Chrome Web Store using the Chrome Web Store API. The solution integrates with Phase 22's version synchronization workflow, which already updates manifest.json on git tags.

The publishing workflow consists of:
1. Manual first submission to establish Web Store listing and obtain credentials
2. Privacy policy page hosted on GitHub Pages (required by Web Store policy)
3. Automated zip building and publishing via GitHub Actions on CalVer tags
4. Validation of manifest.json schema and completeness before upload

**Primary recommendation:** Use chrome-webstore-upload-cli for straightforward API interaction. The Chrome Web Store API requires OAuth 2.0 credentials (client ID, client secret, refresh token) obtained via Google Cloud Console.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chrome-webstore-upload-cli | Latest (^3.x) | Command-line tool for Chrome Web Store API | Official community standard, simpler than raw API, handles token refresh |
| Chrome Web Store API | v1.1 | Google's publishing API | Only official method for automated extension publishing |
| GitHub Pages | Built-in | Privacy policy hosting | Zero-config static hosting for public GitHub repos |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jq | 1.6+ | JSON validation and manipulation | Validate manifest.json structure in CI |
| zip | System | Extension packaging | Bundle extension/dist/* into uploadable .zip |
| actions/checkout | v4 | Checkout repository in GitHub Actions | Standard for all GitHub Actions workflows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chrome-webstore-upload-cli | webstore-upload (Node.js library) | CLI simpler for GitHub Actions, library requires Node.js script |
| GitHub Pages | Netlify/Vercel for privacy policy | GitHub Pages zero-config, already using GitHub |
| Manual publishing | No automation | Automation saves time, reduces human error, ensures version consistency |

**Installation:**
```bash
npm install -g chrome-webstore-upload-cli
# or use npx in GitHub Actions without global install
```

## Architecture Patterns

### Recommended Project Structure
```
.
├── extension/
│   ├── dist/                     # Webpack build output (what gets zipped)
│   │   ├── manifest.json
│   │   ├── icons/
│   │   ├── background/
│   │   ├── content/
│   │   ├── popup/
│   │   └── options/
│   └── package.json
├── docs/
│   └── privacy.html              # Privacy policy for GitHub Pages
└── .github/workflows/
    └── release.yml               # Extended with publish-extension job
```

### Pattern 1: Zip Only Dist Directory
**What:** Package only extension/dist/* (build output) into extension.zip, exclude source files and node_modules
**When to use:** Always - Web Store only needs compiled extension files
**Example:**
```bash
cd extension/dist
zip -r ../../extension.zip .
```
**Why:** Reduces upload size, prevents accidental inclusion of sensitive files, matches Web Store requirements

### Pattern 2: OAuth Credentials via GitHub Secrets
**What:** Store Chrome Web Store API credentials as encrypted GitHub Secrets
**When to use:** Always for automated publishing
**Required secrets:**
- `CHROME_EXTENSION_ID` - Extension ID from first manual submission
- `CHROME_CLIENT_ID` - OAuth client ID from Google Cloud Console
- `CHROME_CLIENT_SECRET` - OAuth client secret
- `CHROME_REFRESH_TOKEN` - Long-lived refresh token for automated access

**Security:** GitHub Secrets are encrypted at rest and only exposed to workflow runs. Never log or echo these values.

### Pattern 3: Validation Before Upload
**What:** Validate manifest.json completeness and schema before attempting upload
**When to use:** Always - fail fast if manifest is invalid
**Checks:**
- Version format matches CalVer (YYYY.MM.DD or YYYY.MM.DD.N)
- Required fields present: name, version, manifest_version, description, icons
- Permissions array valid
- File references exist (popup.html, service-worker.js, etc.)

**Example:**
```bash
# Validate version format
jq -e '.version | test("^[0-9]{4}\\.[0-9]{2}\\.[0-9]{2}(\\.[0-9]+)?$")' extension/dist/manifest.json

# Validate required fields
jq -e '.name and .version and .manifest_version and .description and .icons' extension/dist/manifest.json
```

### Pattern 4: Privacy Policy Structure
**What:** Simple, clear privacy policy meeting Web Store requirements
**Required sections:**
- What data the extension accesses (AI chat conversations on supported sites)
- What data is collected/transmitted (none - all local)
- Data retention (stored locally only, user controls deletion)
- Third-party services (none)
- Contact information (GitHub Issues link)

**Template structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>WIMS Privacy Policy</title>
  <meta charset="utf-8">
</head>
<body>
  <h1>WIMS Privacy Policy</h1>
  <p><strong>Last updated:</strong> 2026-02-20</p>

  <h2>Data Collection</h2>
  <p>WIMS does not collect, transmit, or share any personal data...</p>

  <h2>Data Storage</h2>
  <p>All data remains on your local machine...</p>

  <h2>Contact</h2>
  <p>Questions: <a href="https://github.com/jiang925/wims/issues">GitHub Issues</a></p>
</body>
</html>
```

## API Documentation

### Chrome Web Store API Setup

**Step 1: Google Cloud Console Setup**
1. Go to Google Cloud Console (https://console.cloud.google.com)
2. Create or select a project
3. Enable Chrome Web Store API
4. Create OAuth 2.0 credentials (Desktop application type)
5. Note client ID and client secret

**Step 2: Obtain Refresh Token**
```bash
# One-time manual process to get refresh token
npx chrome-webstore-upload-cli init
# Follow interactive prompts with client ID/secret
# Copy the refresh token for GitHub Secrets
```

**Step 3: First Manual Submission**
1. Build extension: `cd extension && npm run build`
2. Zip dist folder: `cd dist && zip -r extension.zip .`
3. Upload to Chrome Web Store Developer Dashboard
4. Fill in store listing (name, description, screenshots, category)
5. Set visibility to "Unlisted"
6. Copy Extension ID from dashboard URL (32-character string)

**Step 4: Configure GitHub Secrets**
In repository Settings > Secrets > Actions, add:
- `CHROME_EXTENSION_ID`: Extension ID from step 3
- `CHROME_CLIENT_ID`: From step 1
- `CHROME_CLIENT_SECRET`: From step 1
- `CHROME_REFRESH_TOKEN`: From step 2

### Publishing Workflow

**chrome-webstore-upload-cli usage:**
```bash
# Upload and publish new version
npx chrome-webstore-upload-cli upload \
  --extension-id $EXTENSION_ID \
  --client-id $CLIENT_ID \
  --client-secret $CLIENT_SECRET \
  --refresh-token $REFRESH_TOKEN \
  --source extension.zip \
  --auto-publish
```

**Options:**
- `--auto-publish`: Automatically submit for review after upload (recommended)
- `--trusted-testers`: Publish to trusted testers group (beta channel, not using for v1.7)

**Response handling:**
- Success: Exit code 0, extension enters review queue
- Failure: Exit code 1, error message printed to stderr (manifest invalid, zip corrupt, API error)
- Review time: ~24 hours for automated reviews, may take longer for manual review

### GitHub Pages Setup

**Enable GitHub Pages:**
1. Repository Settings > Pages
2. Source: Deploy from a branch
3. Branch: main (or gh-pages if preferred)
4. Folder: /docs (recommended) or / (root)

**URL format:**
- User page: https://username.github.io/repository-name/privacy.html
- Organization page: https://org.github.io/repository-name/privacy.html

**DNS:**
- No custom domain needed (optional)
- HTTPS enforced by default
- Deploys automatically on git push to configured branch

## Implementation Recommendations

### Recommendation 1: Extend Phase 22's release.yml Workflow
**Rationale:** Version synchronization already handled by Phase 22's version-sync job. Add new publish-extension job that runs after version-sync.

**Benefits:**
- Reuse existing tag trigger and version extraction logic
- Ensure manifest.json version updated before publishing
- Single workflow for complete release process

**Structure:**
```yaml
jobs:
  validate-tests:
    # ... existing ...

  version-sync:
    needs: validate-tests
    # ... existing ...

  publish-extension:
    needs: version-sync
    runs-on: ubuntu-latest
    if: github.ref_type == 'tag'
    # ... new job ...
```

### Recommendation 2: Build Extension in CI
**Rationale:** Ensure reproducible builds, don't rely on pre-built dist/ artifacts in git

**Steps:**
1. Install Node.js and dependencies
2. Run `npm run build` in extension directory
3. Validate manifest.json
4. Zip extension/dist/*
5. Upload to Web Store

**Why:** Prevents stale builds, ensures version sync applied, matches CI/CD best practices

### Recommendation 3: Fail Fast on Validation Errors
**Rationale:** Don't waste time uploading invalid extensions, get immediate feedback

**Validation order:**
1. Tag format (already validated in version-sync job)
2. Build completes successfully
3. manifest.json exists and valid JSON
4. manifest.json version matches tag
5. Required manifest fields present
6. Referenced files exist (icons, scripts)
7. Zip created successfully
8. Upload to Web Store

**Implementation:** Use `set -e` in bash scripts to exit on first error, check exit codes after each step

### Recommendation 4: Privacy Policy in docs/ Folder
**Rationale:** Keep privacy policy in docs/ for clean GitHub Pages deployment, separate from code

**Structure:**
```
docs/
├── privacy.html         # Primary privacy policy
└── index.html          # Optional: Redirect to GitHub repo or privacy page
```

**GitHub Pages config:**
- Branch: main
- Folder: /docs
- URL: https://jiang925.github.io/wims/privacy.html

### Recommendation 5: Manual Rollback Strategy
**Rationale:** Chrome Web Store doesn't support automated rollback, manual process acceptable for v1.7

**Process:**
1. If bad version published, immediately unpublish via Developer Dashboard
2. Push rollback tag (e.g., 2026.02.20.1 if 2026.02.20.0 was bad)
3. Automated workflow publishes rollback version
4. Web Store review ~24 hours

**Alternative (faster):** Keep previous version .zip file, manually upload via dashboard (bypasses CI)

### Recommendation 6: No Beta Channel for v1.7
**Rationale:** Keep automation simple, beta channel adds complexity without clear benefit for initial release

**Future consideration:** If high publish frequency or need faster feedback, can add:
- `--trusted-testers` flag for beta releases
- Separate workflow for beta tags (e.g., 2026.02.20-beta.1)
- Opt-in trusted testers group in Web Store

## Security Considerations

### Secret Management
- **Never log secrets:** Use GitHub Actions secret masking (secrets automatically masked in logs)
- **Minimal scope:** Refresh token only has Chrome Web Store API access, no broader Google account access
- **Rotation:** Refresh token doesn't expire, but can be revoked and regenerated if compromised
- **Access control:** Only repository maintainers can view/edit GitHub Secrets

### Extension Review Process
- **All uploads reviewed:** Chrome Web Store reviews all submissions, automated or manual
- **Review criteria:** Permissions match functionality, no malicious code, privacy policy compliant
- **Suspension risk:** Violations can result in extension suspension or developer account ban
- **Monitoring:** Check Web Store Developer Dashboard regularly for review status and violations

### Privacy Compliance
- **Minimal permissions:** Only request necessary permissions (storage, alarms, localhost host_permissions)
- **No external data transmission:** All data stays local, clearly stated in privacy policy
- **User control:** Users can delete data by uninstalling extension or clearing browser storage
- **Transparency:** Open source code available on GitHub, matches published extension

## Testing Strategy

### Pre-Publishing Tests
1. **Local build test:** Build extension locally, load unpacked in Chrome, verify functionality
2. **Manifest validation:** Run jq checks on manifest.json structure and content
3. **Zip verification:** Unzip generated extension.zip, verify contents match dist/
4. **Version consistency:** Compare manifest.json version against expected tag version

### Post-Publishing Verification
1. **Web Store listing:** Check extension appears in Web Store with correct version
2. **Install test:** Install from Web Store, verify functionality matches local build
3. **Update test:** Install old version, verify auto-update to new version works
4. **Rollback test:** Verify manual rollback process works (if needed)

### Continuous Monitoring
- **Review status:** Check Developer Dashboard for review completion
- **Error reports:** Monitor Web Store reviews and GitHub Issues for bug reports
- **Usage metrics:** (Optional) Check install counts and ratings in Developer Dashboard

## Edge Cases and Limitations

### Known Limitations
1. **Review delays:** Web Store reviews can take longer than 24 hours during high volume periods
2. **Manual first submission:** First submission must be manual, cannot automate initial listing creation
3. **No instant rollback:** Rollbacks require re-submission and re-review, ~24 hour delay
4. **API rate limits:** Chrome Web Store API has rate limits, but unlikely to hit with one publish per tag

### Edge Cases to Handle
1. **Version collision:** If tag pushed, deleted, and re-pushed with different code, Web Store rejects duplicate version
   - **Solution:** Use YYYY.MM.DD.N format for hotfix versions (e.g., 2026.02.20.1)
2. **Build failure:** Webpack build fails in CI
   - **Solution:** Fail workflow immediately, don't attempt zip/upload
3. **Manifest invalid:** manifest.json fails schema validation
   - **Solution:** Fail workflow before upload, provide clear error message
4. **API credential expiry:** Refresh token revoked or credentials invalid
   - **Solution:** Workflow fails with auth error, regenerate credentials and update GitHub Secrets
5. **Review rejection:** Web Store rejects submission due to policy violation
   - **Solution:** Manual intervention required, fix issue, delete tag, re-tag after fix

### Mitigation Strategies
- **Pre-upload validation:** Catch issues before upload (manifest schema, file existence)
- **Idempotent operations:** Uploading same version multiple times is safe (Web Store rejects as duplicate)
- **Clear error messages:** Log validation failures with actionable error messages
- **Monitoring:** Alert on workflow failures via GitHub notifications

---

*Phase: 24-chrome-extension-automation*
*Research completed: 2026-02-20*
