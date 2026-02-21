---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/release.yml
autonomous: true
requirements: []

must_haves:
  truths:
    - Docker images build successfully in GitHub Actions without disk space errors
    - Workflow completes without "No space left on device" failures
    - Images published to GHCR with proper tags
  artifacts:
    - path: ".github/workflows/release.yml"
      provides: "Docker publishing job with disk optimization"
      contains: "publish-docker"
  key_links:
    - from: ".github/workflows/release.yml"
      to: "GHCR"
      via: "docker buildx build and push"
      pattern: "docker/build-push-action"
---

<objective>
Fix GitHub Actions disk space exhaustion during Docker image builds by implementing proven disk optimization strategies.

**Purpose:** Enable automated Docker publishing to GHCR by staying within GitHub Actions 14GB disk limit despite PyTorch/sentence-transformers dependencies (~2GB+ installed size).

**Output:** Working Docker publishing job in release workflow that successfully builds and publishes images without disk space errors.
</objective>

<execution_context>
@/Users/tianjiang/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tianjiang/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/23-docker-publishing/23-CONTEXT.md
@.github/workflows/release.yml
@Dockerfile
@pyproject.toml

**Previous attempts (all failed with "No space left on device"):**
1. Building AMD64 only (not multi-platform) - commit 6710896
2. Removing model pre-download from Dockerfile - commit 6232294
3. Disabling Docker build cache (`no-cache: true`) - commit b1511e1

**Key constraints:**
- GitHub Actions runners: ~14GB total disk space
- Dependencies: sentence-transformers + fastembed + PyTorch (~2GB+ installed)
- Base image: python:3.12-slim (~150MB)
- Workflow already runs tests before Docker build (consumes disk space)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Research and implement GitHub Actions disk optimization strategies</name>
  <files>.github/workflows/release.yml</files>
  <action>
Research proven disk optimization strategies for GitHub Actions Docker builds (search GitHub Actions documentation, community solutions, Docker optimization guides). Focus on:
- Disk cleanup before Docker build (remove unused tools, Docker images, apt cache)
- GitHub Actions disk space reclamation utilities
- Multi-stage Docker builds to minimize layer size
- Docker buildx cache optimization
- Prune strategies for GitHub runners

After research, implement comprehensive disk optimization in release.yml by adding a new `publish-docker` job:

1. **Add publish-docker job** after version-sync job (needs: version-sync)
   - runs-on: ubuntu-latest
   - if: github.ref_type == 'tag'
   - permissions: packages: write, contents: read

2. **Before Docker build steps, add aggressive disk cleanup:**
   ```yaml
   - name: Free disk space
     run: |
       # Show initial disk usage
       df -h

       # Remove large unused packages (Android, .NET, etc.)
       sudo rm -rf /usr/share/dotnet
       sudo rm -rf /usr/local/lib/android
       sudo rm -rf /opt/ghc
       sudo rm -rf /opt/hostedtoolcache/CodeQL

       # Clean apt cache
       sudo apt-get clean

       # Remove Docker images and containers
       docker system prune -af --volumes

       # Show final disk usage
       df -h
   ```

3. **Add Docker setup steps:**
   - actions/checkout@v4
   - Set up QEMU (docker/setup-qemu-action@v3) for multi-platform
   - Set up Docker Buildx (docker/setup-buildx-action@v3)
   - Login to GHCR (docker/login-action@v3) with GITHUB_TOKEN

4. **Extract version from tag** (same as version-sync job)

5. **Build and push Docker image:**
   - Use docker/build-push-action@v5
   - Context: . (repository root)
   - File: ./Dockerfile
   - Platforms: linux/amd64 only (ARM64 deferred due to space constraints)
   - Push: true
   - Tags:
     - ghcr.io/jiang925/wims:${{ steps.version.outputs.VERSION }}
     - ghcr.io/jiang925/wims:latest
   - Build args: VERSION=${{ steps.version.outputs.VERSION }}
   - Cache: Use GitHub Actions cache (cache-from/cache-to with type=gha, mode=max)
   - No --no-cache flag (cache reduces build size, previous attempt used wrong approach)

6. **Add success message** showing published images and tags

**Why this approach:**
- Disk cleanup reclaims ~10-12GB from unused tools (proven effective in GitHub community)
- GitHub Actions cache with mode=max reuses layers efficiently without accumulating disk waste
- Single platform (amd64) reduces build time and space by ~40%
- Existing Dockerfile already optimized (no model pre-download, slim base, efficient layers)
  </action>
  <verify>
1. Validate YAML syntax: `yamllint .github/workflows/release.yml` or GitHub Actions workflow validator
2. Check publish-docker job structure: grep "publish-docker:" .github/workflows/release.yml
3. Verify disk cleanup commands present: grep "Free disk space" .github/workflows/release.yml
4. Confirm GHCR authentication configured: grep "ghcr.io" .github/workflows/release.yml
  </verify>
  <done>
- publish-docker job added to release.yml after version-sync
- Disk cleanup steps remove ~10GB of unused tools before Docker build
- Docker buildx configured with GitHub Actions cache (mode=max)
- GHCR authentication using GITHUB_TOKEN
- Image tags: VERSION and latest
- Platform: linux/amd64 only
- YAML syntax valid
  </done>
</task>

<task type="auto">
  <name>Task 2: Test workflow locally and commit changes</name>
  <files>.github/workflows/release.yml</files>
  <action>
1. **Validate workflow syntax** using act or GitHub CLI:
   ```bash
   gh workflow view release.yml
   ```
   If gh CLI not available, validate YAML structure manually.

2. **Verify Docker build works locally** (sanity check before pushing):
   ```bash
   docker build -t wims:test --build-arg VERSION=test .
   ```
   This confirms Dockerfile itself is sound (not testing GHA disk optimization, just Docker build).

3. **Update ROADMAP.md** to reflect Docker automation re-enabled:
   - Find Phase 23 section in .planning/ROADMAP.md
   - Update status to note automation implemented with disk optimization
   - Keep note that ARM64 builds deferred

4. **Commit changes** using gsd-tools:
   ```bash
   node /Users/tianjiang/.claude/get-shit-done/bin/gsd-tools.cjs commit "fix(quick-2): implement GitHub Actions disk optimization for Docker builds" --files .github/workflows/release.yml .planning/ROADMAP.md
   ```

**What to avoid:**
- Do NOT test the full GitHub Actions workflow locally (act doesn't simulate disk constraints accurately)
- Do NOT add back model pre-download (deferred per phase 23 decisions)
- Do NOT enable multi-platform ARM64 builds (deferred due to space)
  </action>
  <verify>
1. Local Docker build succeeds: `docker build -t wims:test --build-arg VERSION=test .` exits 0
2. Workflow YAML valid: `gh workflow view release.yml` shows no syntax errors
3. Changes committed: `git log -1 --oneline` shows commit message
4. ROADMAP.md updated: `grep -A5 "Phase 23" .planning/ROADMAP.md` shows automation status
  </verify>
  <done>
- Docker build works locally (Dockerfile validated)
- Workflow YAML syntax validated
- ROADMAP.md updated to reflect Docker automation re-enabled
- Changes committed to git with descriptive message
- Ready for next tag push to test in real GitHub Actions environment
  </done>
</task>

</tasks>

<verification>
After execution:

1. **Workflow structure check:**
   ```bash
   grep -A3 "publish-docker:" .github/workflows/release.yml
   grep "Free disk space" .github/workflows/release.yml
   grep "ghcr.io/jiang925/wims" .github/workflows/release.yml
   ```

2. **Local Docker build:**
   ```bash
   docker build -t wims:test --build-arg VERSION=test .
   docker images wims:test
   ```

3. **Git status:**
   ```bash
   git log -1 --stat
   git diff HEAD~1 .github/workflows/release.yml
   ```

**Real test:** Next tag push (e.g., `2026.02.20.1`) will trigger workflow in GitHub Actions. Monitor:
- Disk space after cleanup step (should show ~20-25GB free)
- Docker build completion without "No space left on device"
- GHCR push success
- Image availability at ghcr.io/jiang925/wims
</verification>

<success_criteria>
- [ ] publish-docker job added to release.yml with disk cleanup, Docker buildx, GHCR push
- [ ] Disk cleanup removes unused tools (dotnet, android, ghc, CodeQL) before build
- [ ] Docker buildx uses GitHub Actions cache (mode=max) for efficiency
- [ ] GHCR authentication configured with GITHUB_TOKEN
- [ ] Image tags: VERSION and latest for linux/amd64
- [ ] Local Docker build succeeds (validates Dockerfile)
- [ ] Workflow YAML syntax valid
- [ ] ROADMAP.md updated to reflect automation re-enabled
- [ ] Changes committed to git
- [ ] Ready for next tag push to test in real GitHub Actions environment
</success_criteria>

<output>
After completion, create `.planning/quick/2-fix-github-actions-disk-space-for-docker/2-SUMMARY.md` documenting:
- Disk optimization strategies implemented
- Workflow changes made
- Local validation results
- Next steps for real-world testing
</output>
