# Pitfalls Research

**Domain:** Distribution/Packaging for Python+TypeScript project
**Researched:** 2026-02-18
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Version Sync Chaos Across Components

**What goes wrong:**
Docker image tagged `v1.2.0`, Chrome extension has `0.1.0` in manifest, pyproject.toml shows `0.1.0`, git tag is `v1.2.0`. Users report bugs but you can't reproduce because version numbers don't match components. Extension auto-updates but Docker image doesn't, causing API incompatibilities.

**Why it happens:**
Each distribution channel has its own version file: `pyproject.toml`, `extension/manifest.json`, `Dockerfile` labels, git tags, Docker image tags. Easy to update one but forget others. No single source of truth enforced at build time.

**How to avoid:**
1. **Single source:** Extract version from `pyproject.toml` at build time for ALL artifacts
2. **Build script validation:** Fail CI if versions don't match before publishing
3. **Version injection:** Use build-time templating to inject version into manifest.json and Dockerfile labels
4. **Tag enforcement:** Git tag should trigger release, not manual version bumps

```bash
# Example: Extract version in CI
VERSION=$(python -c "import tomllib; print(tomllib.load(open('pyproject.toml', 'rb'))['project']['version'])")
# Inject into extension build
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" extension/manifest.json
# Tag Docker image
docker tag app:latest app:$VERSION
```

**Warning signs:**
- Manual version updates in multiple files
- No CI check that versions match
- "Works in Docker but not extension" bug reports
- Release checklist includes "update version in 3 places"

**Phase to address:**
Phase 1 (Docker Publishing) - establish version sync patterns before adding more distribution channels

---

### Pitfall 2: Docker Image Secrets Leakage

**What goes wrong:**
GitHub token or API key embedded in Docker image during build. Image pushed to public registry. Credentials now publicly accessible via `docker history` or layer inspection. Security breach, immediate key rotation required, trust damaged.

**Why it happens:**
Secrets needed during build (to download private dependencies or authenticate). Developers use `ENV` or `ARG` in Dockerfile, or copy `.env` files. These persist in image layers even if deleted in later layers.

**How to avoid:**
1. **Build-time only secrets:** Use Docker BuildKit `--secret` flag, never `ENV`/`ARG` for secrets
2. **No `.env` in image:** Add `.dockerignore` with `.env*`, verify it's respected
3. **Public dependency strategy:** WIMS currently has no private dependencies - keep it that way or use buildkit secrets
4. **Layer inspection check:** CI job runs `docker history` and fails if sensitive patterns detected
5. **Runtime secrets:** Pass via environment variables at runtime, not build time

```dockerfile
# BAD - persists in layer
ARG GITHUB_TOKEN
RUN pip install from-private-repo --token $GITHUB_TOKEN

# GOOD - mount secret, doesn't persist
RUN --mount=type=secret,id=github_token \
    pip install from-private-repo --token=$(cat /run/secrets/github_token)
```

**Warning signs:**
- Dockerfile contains `ARG` for tokens
- `.env` files not in `.dockerignore`
- `COPY . .` before explicit exclusions
- No automated secret scanning in CI

**Phase to address:**
Phase 1 (Docker Publishing) - critical security issue, must be correct from day one

---

### Pitfall 3: Multi-Architecture Publishing Hell

**What goes wrong:**
Docker image builds on M1 Mac (ARM64), pushed to registry. Linux user on AMD64 pulls image, crashes with "exec format error" or runs under emulation at 10x slower speed. GitHub Actions builds AMD64 by default, but M1 developer can't test locally.

**Why it happens:**
Forgot to build for multiple platforms. GitHub Actions defaults to AMD64, local Mac is ARM64. Binary dependencies in Python (fastembed, lancedb) have architecture-specific builds. Easy to test on one architecture and forget others.

**How to avoid:**
1. **Explicit platform builds:** Use `docker buildx build --platform linux/amd64,linux/arm64`
2. **CI builds both:** GitHub Actions should build multi-arch, not just AMD64
3. **Matrix testing:** Test on both architectures in CI before publishing
4. **Local emulation:** Developers test `--platform linux/amd64` locally on ARM machines
5. **Manifest verification:** Check Docker manifest shows both architectures after push

```yaml
# GitHub Actions
- name: Build multi-platform image
  uses: docker/build-push-action@v5
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: user/wims:${{ github.sha }}
```

**Warning signs:**
- Dockerfile builds without explicit `--platform` flag
- No multi-arch testing in CI
- Binary dependencies (fastembed) without platform consideration
- "Works on my Mac" but Linux users report issues

**Phase to address:**
Phase 1 (Docker Publishing) - prevents immediate user complaints on release

---

### Pitfall 4: Chrome Extension Permission Creep Rejection

**What goes wrong:**
Extension update adds `<all_urls>` or `tabs` permission for "future feature." Automated review flags it. Human review rejects: "Overly broad permissions not justified by functionality." Extension delisted from store or update blocked. Existing users see scary "new permissions required" prompt, uninstall spike.

**Why it happens:**
Developers add permissions preemptively "just in case." Chrome Web Store has strict minimum-permission policy. Reviewers actually check if permissions are used. Users panic at permission expansion.

**How to avoid:**
1. **Minimum viable permissions:** Only request what's actively used in shipped code
2. **Host permissions audit:** WIMS needs `http://localhost/*` (daemon communication) - this is justified
3. **Content script scope:** Current manifest correctly scopes to specific sites (chatgpt.com, gemini.google.com) - never use `<all_urls>`
4. **Permission justification doc:** In submission notes, explain why each permission is necessary
5. **Staged permission requests:** Use optional permissions for future features, request at runtime when needed

**Current WIMS permissions:**
```json
"permissions": ["storage", "alarms"],  // ✅ Justified
"host_permissions": ["http://localhost/*"],  // ✅ Daemon communication
"matches": ["https://chatgpt.com/*", ...]  // ✅ Specific sites only
```

**Warning signs:**
- Permissions list grows "just in case"
- No comment explaining why each permission is needed
- `<all_urls>` or `*://*/*` patterns
- Permissions added before feature implementation

**Phase to address:**
Phase 2 (Chrome Extension) - critical for store approval, review before first submission

---

### Pitfall 5: Extension Manifest Version Field vs Package Version

**What goes wrong:**
`manifest.json` has `"version": "0.1.0"`, `package.json` has `"version": "0.2.0"`, git tag is `v0.3.0`. Chrome Web Store requires monotonically increasing `manifest.json` version for updates. Upload fails because new manifest version isn't higher than published version. Manual manifest edit, reupload, but zip filename doesn't match.

**Why it happens:**
Chrome extensions MUST have version in `manifest.json` - this is the only version that matters to Chrome Web Store. But developers also maintain `package.json` version out of habit. Two sources of truth diverge.

**How to avoid:**
1. **Manifest is source of truth:** For extension, `manifest.json` version is canonical
2. **Sync at build time:** Build script copies version from `pyproject.toml` to `manifest.json`
3. **Semver enforcement:** CI validates version is higher than last published version
4. **Auto-increment:** Consider auto-incrementing patch version in CI for each commit
5. **Version check before publish:** Script queries Chrome Web Store API for current version, validates new > current

```bash
# Build script
VERSION=$(python -c "import tomllib; print(tomllib.load(open('pyproject.toml', 'rb'))['project']['version'])")
jq ".version = \"$VERSION\"" extension/manifest.json > tmp.json && mv tmp.json extension/manifest.json
```

**Warning signs:**
- Manual version updates in `manifest.json`
- No validation that manifest.version > published version
- "Upload failed: version must be higher" errors
- Forgetting to bump version before submission

**Phase to address:**
Phase 2 (Chrome Extension) - prevents publish failures, establish pattern early

---

### Pitfall 6: Extension Content Security Policy Too Restrictive

**What goes wrong:**
Extension loads fine in local testing. Published to Chrome Web Store. Users report: "popup is blank" or "options page doesn't work." Console shows CSP violations. Inline scripts blocked. Webpack bundle uses `eval()` for source maps. Store review rejects for CSP violations.

**Why it happens:**
Chrome extensions have strict CSP by default in Manifest V3. Inline scripts and `eval()` forbidden. Webpack default dev config uses `eval-source-map` which violates CSP. Works locally with relaxed CSP, breaks in production.

**How to avoid:**
1. **Production webpack config:** Use `source-map` or `hidden-source-map`, never `eval` variants
2. **No inline scripts:** All JS in separate files, no `onclick="..."` in HTML
3. **CSP testing:** Test built extension in production mode before submission
4. **Manifest V3 compliance:** WIMS already uses MV3 - ensure webpack config matches restrictions
5. **Remove CSP overrides:** Don't add `content_security_policy` to manifest unless absolutely necessary

```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  devtool: 'source-map',  // NOT 'eval-source-map'
  // ...
}
```

**Warning signs:**
- Webpack config has `devtool: 'eval'` or `eval-source-map`
- Inline event handlers in HTML
- `content_security_policy` in manifest with relaxed rules
- "Works in dev, blank in production" reports

**Phase to address:**
Phase 2 (Chrome Extension) - critical for store approval and user experience

---

### Pitfall 7: Standalone Installer Breaks Existing Git Clone Workflow

**What goes wrong:**
Create standalone installer that installs daemon to `/opt/wims/` with its own Python environment. Git clone users suddenly can't run `./setup.sh` because system Python conflicts with installed daemon. Or installer overwrites symlinks used by git clone users. Two installation methods fight for the same config paths. Developer experience ruined.

**Why it happens:**
Installer assumes clean system. Git clone assumes user controls everything. Both want to own config files, systemd services, database paths. No consideration for coexistence.

**How to avoid:**
1. **Different install prefixes:** Installer uses `/opt/wims/`, git clone uses `$PWD`
2. **Config path detection:** Daemon checks `$WIMS_HOME` or falls back to standard paths
3. **Service name isolation:** Installer creates `wims-daemon.service`, git clone uses `wims-dev.service`
4. **No system-wide overrides:** Installer doesn't modify global Python or system paths
5. **Detection and warning:** Setup script detects installer presence, warns user about potential conflicts
6. **Documentation:** Clear explanation of two installation modes and when to use each

```bash
# setup.sh addition
if systemctl --user is-enabled wims-daemon.service 2>/dev/null; then
    echo "WARNING: Installer-based daemon detected."
    echo "Stop it with: systemctl --user stop wims-daemon.service"
    echo "Or continue for development setup (different service name)"
fi
```

**Warning signs:**
- Installer and setup.sh both modify same systemd service
- Both write to `~/.config/wims/` without coordination
- No environment variable to distinguish modes
- "Installer worked, now git clone broken" reports

**Phase to address:**
Phase 3 (Standalone Installer) - before first installer release, prevent developer friction

---

### Pitfall 8: Platform-Specific Dependency Hell in Installer

**What goes wrong:**
Installer bundles Python environment with dependencies. Works on Ubuntu 24.04. User on Debian 12 gets "GLIBC version not found." macOS user gets "dylib not loaded." Rocky Linux user gets segfault in lancedb. Each platform needs separate binary builds, but CI only tests Ubuntu.

**Why it happens:**
Python wheels often contain compiled binaries linked against specific libc versions. WIMS uses fastembed, lancedb, sentence-transformers - all have native dependencies. Binary compiled on Ubuntu 24.04 links against glibc 2.39, older systems have glibc 2.31. PyInstaller/similar tools bundle dependencies but don't handle cross-platform compatibility.

**How to avoid:**
1. **Build on oldest supported platform:** Use Ubuntu 20.04 to build Linux binaries (older glibc)
2. **manylinux wheels:** Verify dependencies provide manylinux wheels, not platform-specific
3. **Static linking where possible:** Bundle dependencies instead of assuming system libs
4. **Platform matrix testing:** CI tests installer on Ubuntu 20.04, 22.04, 24.04, Debian, Rocky
5. **Dependency audit:** Check each dependency's platform support before committing
6. **macOS separate build:** ARM64 and x86_64 need separate builds and codesigning

```yaml
# CI matrix
strategy:
  matrix:
    os: [ubuntu-20.04, ubuntu-22.04, ubuntu-24.04, macos-13, macos-14]
    include:
      - os: ubuntu-20.04
        artifact: linux-amd64
      - os: macos-14
        artifact: macos-arm64
```

**Warning signs:**
- Building on latest Ubuntu only
- No platform matrix in CI
- Dependencies with compiled extensions not checked for manylinux
- "Works on my machine" testing only
- No testing on actual target platforms

**Phase to address:**
Phase 3 (Standalone Installer) - prevents platform fragmentation disasters

---

### Pitfall 9: Docker Image Size Bloat Killing Download Experience

**What goes wrong:**
Initial Docker image is 200MB. Add dev dependencies by accident, now 500MB. Include build tools, now 800MB. Include model cache without optimization, now 2.5GB. Users on slow connections take 15 minutes to download. `docker pull` times out. Poor first impression, abandoned trials.

**Why it happens:**
Not using multi-stage builds. Including dev dependencies. Including build tools in runtime image. Caching large files without considering image size. Current Dockerfile has good practices but easy to regress.

**How to avoid:**
1. **Multi-stage builds:** Current Dockerfile is single-stage - refactor to build stage + runtime stage
2. **Prod dependencies only:** Use `uv sync --no-dev` (already done ✅)
3. **Remove build tools:** Don't need gcc/python3-dev in runtime
4. **Optimize layer caching:** Current Dockerfile correctly separates dependency install from code copy ✅
5. **Model caching strategy:** Pre-download embedding model (already done ✅) but consider lazy loading for Docker
6. **Base image choice:** `python:3.12-slim` is good ✅, but could use `alpine` for smaller size
7. **Size monitoring:** CI fails if image > 300MB threshold

```dockerfile
# Multi-stage optimization
FROM python:3.12-slim AS builder
RUN apt-get update && apt-get install -y gcc python3-dev
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim
COPY --from=builder /app/.venv /app/.venv
# No build tools in runtime image
```

**Warning signs:**
- Image size grows with each commit
- No size tracking in CI
- Dev dependencies in production image
- Build tools (gcc, make) in final image
- `apt-get` without `--no-install-recommends` or cleanup

**Phase to address:**
Phase 1 (Docker Publishing) - before first public release, establish size baseline

---

### Pitfall 10: Automated Publishing Without Smoke Tests

**What goes wrong:**
GitHub Actions workflow: commit → build → publish Docker image → publish Chrome extension → create installer. All automated. Image published with import error. Extension published with API incompatibility. Installer published with broken systemd service. Users immediately hit issues. Emergency rollback required. Trust damaged.

**Why it happens:**
Optimizing for deployment speed. "Automated is better" mindset without validation gates. Tests pass but integration breaks. Smoke tests not comprehensive enough.

**How to avoid:**
1. **Staging environment:** Deploy to staging before production
2. **Integration smoke tests:** Start Docker container, run basic API calls, verify responses
3. **Extension smoke test:** Install unpacked extension, trigger capture, verify daemon communication
4. **Installer smoke test:** Run installer in fresh VM, verify service starts, verify API responds
5. **Manual approval gate:** Require maintainer approval before publishing to public registries
6. **Canary releases:** Publish to test users before full rollout
7. **Rollback automation:** One-click rollback if smoke tests fail post-deploy

```yaml
# GitHub Actions
- name: Smoke test Docker image
  run: |
    docker run -d -p 8000:8000 wims:test
    sleep 5
    curl http://localhost:8000/health || exit 1

- name: Publish to registry
  if: success()  # Only if smoke test passed
  run: docker push wims:$VERSION
```

**Warning signs:**
- Publish happens immediately after build
- No integration tests in CI
- No manual approval gate
- "Just pushed, now broken" incidents
- No rollback plan documented

**Phase to address:**
All phases - establish pattern in Phase 1, replicate for each distribution channel

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip multi-arch Docker builds | Faster initial setup | AMD64-only users frustrated, manual backport required | MVP only, must fix before public announcement |
| Manual version bumps | No build script complexity | Version sync chaos, human error | Never - automate from day one |
| Bundle dev dependencies in Docker | No separate build config | 3x larger images, slower pulls | Local testing only, never production |
| Skip extension CSP testing | Faster iteration | Store rejection, emergency fix | Development only, gate production |
| Single platform installer testing | CI runs faster | Platform bugs discovered by users | Early prototyping, require matrix before release |
| Hardcode localhost URLs in extension | Simple configuration | Can't test against remote daemon | MVP, add config UI before wide release |
| No smoke tests in publish workflow | Faster deployments | Broken releases reach users | Never - automation without validation is worse than manual |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Docker → Daemon API | Assuming localhost works from container | Use host.docker.internal or explicit network bridge |
| Extension → Daemon | HTTP to localhost blocked by mixed content | Extension manifest must allow http://localhost/* explicitly |
| Installer → systemd | Installing to system level requires root | Use user-level systemd (systemctl --user) |
| GitHub Actions → Docker Registry | Using docker/login credentials directly | Use GitHub Container Registry with GITHUB_TOKEN |
| Extension → Chrome Web Store | Manual ZIP upload | Use Chrome Web Store API for automated publishing |
| PyInstaller → Native deps | Bundling everything bloats size | Assume system libs for libc, bundle Python-specific only |
| uv → Docker | Lock file mismatch between platforms | Use uv sync --frozen to respect lock exactly |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Embedding model download on first request | First API call takes 60s, timeout | Pre-download in Docker build, cache in installer | First user after install |
| Docker layer cache invalidation | Every build takes 10 minutes | Order Dockerfile: deps → config → code | Every code change |
| Extension content script on every page | Browser slowdown, battery drain | Use specific URL patterns, not `<all_urls>` | User has 100+ tabs |
| Systemd service without restart policy | Daemon crash = permanent outage | Add Restart=on-failure to service file | Any crash |
| Uncompressed extension bundle | 10MB download, slow install | Use webpack production mode with compression | Extension has many assets |
| Docker logs filling disk | Container crashes after days | Use log rotation: --log-opt max-size=10m | Weeks of runtime |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Secrets in Dockerfile | Public leak via docker history | Use BuildKit secrets, never ENV/ARG |
| Extension communicates with HTTP API | Man-in-the-middle attacks | Use HTTPS for production daemon, localhost exception for dev |
| Installer runs as root | Privilege escalation, system compromise | User-level install only, document system-wide as optional |
| Hardcoded daemon URL in extension | Can't change without extension update | Make configurable via options page |
| No signature verification on installer | User downloads tampered installer | Code sign macOS, GPG sign Linux packages |
| Chrome extension remote code execution | Store bans extension permanently | No `eval()`, no remote script loading, no `new Function()` |
| Docker container runs as root | Container escape = root on host | Add USER directive, run as non-root UID |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Docker requires manual port mapping | Users confused by `docker run` command | Provide docker-compose.yml with sane defaults |
| Extension permission prompt on install | Users scared, don't install | Explain permissions in store listing description |
| Installer fails without clear error | "It doesn't work", user gives up | Check prerequisites, show actionable error messages |
| Version mismatch between components | Random failures, hard to debug | Show version in extension popup and API /health endpoint |
| Daemon starts before model download | First request times out | Pre-download models in installer, show loading state |
| No update notification | Users run old buggy versions forever | Extension checks for updates, shows changelog |
| Git clone instructions too long | Users abandon during setup | Provide one-liner with setup.sh, automate everything |

## "Looks Done But Isn't" Checklist

- [ ] **Docker image:** Often missing health check - verify `HEALTHCHECK` directive exists
- [ ] **Docker image:** Often missing proper signal handling - verify graceful shutdown on SIGTERM
- [ ] **Extension:** Often missing error handling for daemon offline - verify offline state UI
- [ ] **Extension:** Often missing update_url in manifest - verify auto-update configuration
- [ ] **Installer:** Often missing uninstaller - verify clean removal process exists
- [ ] **Installer:** Often missing prerequisite checks - verify system compatibility validation
- [ ] **All components:** Often missing version display in UI - verify user can see current version
- [ ] **All components:** Often missing changelog communication - verify users know what's new
- [ ] **Publishing workflow:** Often missing rollback procedure - verify one-click revert exists
- [ ] **Publishing workflow:** Often missing version validation - verify version increments correctly

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Version sync chaos | MEDIUM | 1. Audit all version locations. 2. Pick single source of truth. 3. Write sync script. 4. Add CI validation. Timeline: 1 day |
| Secrets leaked in Docker image | HIGH | 1. Rotate all secrets immediately. 2. Delete compromised images. 3. Audit git history. 4. Rebuild with BuildKit secrets. Timeline: 4 hours + audit |
| Multi-arch missing | LOW | 1. Set up buildx. 2. Add platform flags. 3. Rebuild and push. Timeline: 2 hours |
| Extension permission rejection | MEDIUM | 1. Remove unused permissions. 2. Document justification. 3. Resubmit for review. Timeline: 3-7 days (review time) |
| Installer platform incompatibility | HIGH | 1. Set up platform CI matrix. 2. Build on oldest target platform. 3. Test on all targets. 4. Re-release all platforms. Timeline: 2-3 days |
| Image size bloat | LOW | 1. Multi-stage Dockerfile. 2. Remove dev deps. 3. Clean up layers. 4. Rebuild. Timeline: 4 hours |
| CSP violations | MEDIUM | 1. Fix webpack config. 2. Remove inline scripts. 3. Test in production mode. 4. Resubmit. Timeline: 1 day + review |
| Broken release published | HIGH | 1. Immediate rollback. 2. Pin previous version. 3. Fix issue. 4. Add smoke tests. 5. Re-release. Timeline: 2-8 hours |
| Git clone workflow broken | MEDIUM | 1. Separate install paths. 2. Add environment detection. 3. Update docs. Timeline: 1 day |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Version sync chaos | Phase 1 | CI has version validation check, all components show same version |
| Docker secrets leakage | Phase 1 | CI runs `docker history` check, no secrets in layers |
| Multi-arch publishing | Phase 1 | Docker manifest shows both amd64 and arm64 |
| Image size bloat | Phase 1 | CI fails if image > 300MB, multi-stage build in place |
| Automated publish without smoke tests | Phase 1 | CI has smoke test step before publish |
| Permission creep rejection | Phase 2 | Permissions documented with justification, minimal set used |
| Manifest version mismatch | Phase 2 | Build script syncs version from pyproject.toml |
| CSP violations | Phase 2 | Production webpack config uses valid devtool, manual test passes |
| Installer breaks git clone | Phase 3 | Both installation modes tested, different service names |
| Platform dependency hell | Phase 3 | CI matrix tests all target platforms |

## Cross-Cutting Concerns

### Version Synchronization Strategy

**Problem:** 4 components (API, extension, Docker, installer), each needs version tracking, all must match for support purposes.

**Solution Pattern:**
1. **Single source:** `pyproject.toml` version is canonical
2. **Build-time injection:** CI extracts version, injects into all artifacts
3. **Runtime verification:** `/health` endpoint includes component versions, extension displays them
4. **CI gate:** Fail if any version mismatch detected before publish

### Security in Automated Pipelines

**Problem:** Automation requires credentials, but storing them is risky.

**Solution Pattern:**
1. **GitHub Actions secrets:** Store tokens as repository secrets, never in code
2. **Minimal permissions:** Use scoped tokens (packages:write, not repo:admin)
3. **Short-lived tokens:** Use OIDC federation where possible instead of long-lived PATs
4. **Audit trail:** Log all publish actions with committer attribution
5. **Manual gates:** Require approval for production deploys

### Breaking Existing Workflows

**Problem:** Git clone users have working setup, new distribution methods might interfere.

**Solution Pattern:**
1. **Non-invasive installs:** Each method uses different paths/service names
2. **Environment detection:** Scripts detect existing installations, warn appropriately
3. **Explicit modes:** `./setup.sh --dev` vs `./setup.sh --production` or use installer
4. **Documentation:** Clear guide on which installation method for which use case
5. **Migration path:** Document how to switch between methods safely

## Sources

**PRIMARY (HIGH confidence):**
- Docker BuildKit best practices (official Docker documentation)
- Chrome Web Store developer policies (official Chrome documentation)
- Manifest V3 migration guide (official Chrome documentation)
- systemd user services documentation (official systemd docs)

**SECONDARY (MEDIUM confidence):**
- Analysis of existing WIMS codebase (setup.sh, Dockerfile, manifest.json, pyproject.toml)
- Python packaging ecosystem knowledge (PyPI, wheels, manylinux)
- CI/CD patterns from GitHub Actions documentation
- Package manager standards (uv documentation)

**TERTIARY (LOW confidence - training data):**
- Common distribution pitfalls from software engineering best practices
- Extension review rejection patterns (observed trends, not current policy)
- Cross-platform installer challenges (general knowledge)

**VERIFICATION NEEDED:**
- Current Chrome Web Store review timelines and process
- Latest Docker BuildKit features for secrets management
- Current state of PyInstaller/similar tools for Python bundling
- Platform-specific system requirements for target distributions

---

**CONFIDENCE ASSESSMENT:**
- Docker pitfalls: HIGH (based on official docs + existing Dockerfile analysis)
- Extension pitfalls: MEDIUM (official policies accessible, current review process uncertain)
- Installer pitfalls: MEDIUM (strong patterns, platform-specific details may vary)
- Cross-cutting concerns: HIGH (based on existing codebase analysis)

**RECOMMENDATION:**
Verify Chrome Web Store current submission process and review criteria before Phase 2. Consider platform-specific research spike before Phase 3 for installer targets.

---
*Pitfalls research for: WIMS Distribution & Packaging*
*Researched: 2026-02-18*
