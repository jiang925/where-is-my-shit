# Phase 22: Version Management & Foundation - Research

**Researched:** 2026-02-18
**Domain:** Version synchronization, CalVer, CI/CD automation
**Confidence:** HIGH

## Summary

This phase establishes version management foundation for distributing three artifacts (Docker images, Chrome extension, daemon) with synchronized versions. The core architecture uses **git tags as the immutable source of truth**, with CI/CD workflows extracting the version and injecting it into all artifact files before building. This approach eliminates manual sync errors while maintaining pyproject.toml as the readable source.

CalVer (YYYY.MM.DD format) is ideal for this fast-shipping tool, with dotted suffixes for same-day hotfixes (2026.02.18.1). GitHub Actions provides native tag triggering via `github.ref_name`, and standard shell tools (sed, jq, grep) handle all injection and validation without external dependencies.

**Primary recommendation:** Use GitHub tag push as trigger, extract version with `github.ref_name`, inject into pyproject.toml and manifest.json with sed/jq, validate consistency before building, then publish all three artifacts with synchronized versions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Version Number Format:**
- CalVer with full date: 2026.02.18 format (YYYY.MM.DD)
- Hotfix suffix: Same-day releases use dotted suffix (2026.02.18.1, 2026.02.18.2)
- No v-prefix: Tags are `2026.02.18` not `v2026.02.18`
- Rationale: OpenClaw precedent, clearer than semantic versioning for fast-shipping tool, date tells release timeline story

**Git Tagging Strategy:**
- Unified tag: One tag (2026.02.18) triggers publishing for all three artifacts (Docker, Extension, Daemon)
- Manual tagging: Developer creates tags when ready to release, not automated on every push
- Tag triggers CI: Git tag push starts the publishing workflows

**CI Validation Approach:**
- What gets validated:
  - Version consistency: pyproject.toml, manifest.json, Docker labels all match git tag
  - All tests passing: backend, frontend, e2e tests must pass
  - Changelog updated: CHANGELOG.md must mention this version
- Validation timing: Only on tag pushes, not regular commits
- Failure handling: Fail build and block publish (no warnings-only mode)

### Claude's Discretion

**Version Injection Methods:**
- Implementation approach for extracting version from git tag and injecting into artifacts
- Likely approach: Git tag as source of truth, build-time injection into files

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VER-01 | pyproject.toml as single source of truth | Git tag is PRIMARY source (immutable), pyproject.toml is READABLE source (what code reads). CI bridges them via injection. |
| VER-02 | CI validates version consistency across all artifacts | Bash validation script compares pyproject.toml, manifest.json, and Docker labels against git tag. CHANGELOG.md checked with grep. |
| VER-03 | Git tags trigger all publishing workflows | GitHub Actions `on.push.tags` with pattern `[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9]*` triggers workflow. Single tag builds all artifacts. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.ref_name | Built-in | Extract tag name in workflows | Native GitHub Actions variable, zero setup, most reliable |
| sed | Built-in | Modify pyproject.toml version field | Pre-installed in ubuntu-latest, simple text replacement |
| jq | Built-in | Modify manifest.json version field | Pre-installed in ubuntu-latest, standard JSON tool |
| bash | Built-in | Validation regex and consistency checks | Native shell, no dependencies |
| grep | Built-in | Validate CHANGELOG.md mentions version | Pre-installed, simple pattern matching |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| hatch-vcs | 0.4+ | Dynamic versioning from git tags | Alternative to sed injection, cleaner but adds dependency |
| docker buildx | Latest | Multi-platform Docker builds | AMD64/ARM64 support in Phase 23 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sed/jq injection | hatch-vcs | hatch-vcs is cleaner but adds dependency, requires git history in builds |
| Manual tagging | semantic-release | User decided manual control, semantic-release forces SemVer and automated releases |
| Bash validation | Python script | Bash is simpler with zero dependencies, Python would require checkout and setup |

**Installation:**

No installation needed. All tools pre-installed in `ubuntu-latest` GitHub Actions runners.

Optional alternative:
```bash
# If choosing hatch-vcs approach
pip install hatch-vcs
```

## Architecture Patterns

### Recommended Project Structure

```
.github/
└── workflows/
    ├── ci.yml                    # Existing: tests on push/PR
    └── release.yml               # New: version sync + publishing on tags

pyproject.toml                     # Version injected by CI
extension/
└── manifest.json                  # Version injected by CI
Dockerfile                         # Version passed as build arg
CHANGELOG.md                       # Manually updated before tagging
```

### Pattern 1: Git Tag as Immutable Source

**What:** Git tag contains the version, CI extracts and injects into all artifacts

**When to use:** When you want one action (tagging) to trigger synchronized releases

**How it resolves VER-01:** Git tag is the PRIMARY source (immutable, triggers everything). pyproject.toml is the READABLE source (what Python code reads at runtime). CI bridges them: tag → injection → pyproject.toml. "Single source of truth" means "one source for reading", not "one source for defining".

**Example:**
```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9]*'

jobs:
  version-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Extract version from tag
        id: version
        run: echo "VERSION=${{ github.ref_name }}" >> $GITHUB_OUTPUT

      - name: Validate tag format
        run: |
          if [[ ! "${{ steps.version.outputs.VERSION }}" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$ ]]; then
            echo "Invalid tag format: must be YYYY.MM.DD or YYYY.MM.DD.N"
            exit 1
          fi

      - name: Update pyproject.toml version
        run: |
          sed -i 's/version = ".*"/version = "${{ steps.version.outputs.VERSION }}"/' pyproject.toml

      - name: Update manifest.json version
        run: |
          cd extension
          jq --arg version "${{ steps.version.outputs.VERSION }}" \
             '.version = $version' \
             manifest.json > manifest.json.tmp
          mv manifest.json.tmp manifest.json

      - name: Validate version consistency
        run: |
          TAG_VERSION="${{ steps.version.outputs.VERSION }}"
          PYPROJECT_VERSION=$(grep '^version = ' pyproject.toml | cut -d'"' -f2)
          MANIFEST_VERSION=$(jq -r '.version' extension/manifest.json)

          ERRORS=()
          if [ "$PYPROJECT_VERSION" != "$TAG_VERSION" ]; then
            ERRORS+=("pyproject.toml version ($PYPROJECT_VERSION) != tag ($TAG_VERSION)")
          fi
          if [ "$MANIFEST_VERSION" != "$TAG_VERSION" ]; then
            ERRORS+=("manifest.json version ($MANIFEST_VERSION) != tag ($TAG_VERSION)")
          fi

          if [ ${#ERRORS[@]} -gt 0 ]; then
            echo "Version mismatch detected:"
            printf '%s\n' "${ERRORS[@]}"
            exit 1
          fi

          echo "Version consistency validated: $TAG_VERSION"

      - name: Validate CHANGELOG updated
        run: |
          if ! grep -q "${{ steps.version.outputs.VERSION }}" CHANGELOG.md; then
            echo "CHANGELOG.md does not mention version ${{ steps.version.outputs.VERSION }}"
            exit 1
          fi
```

### Pattern 2: Pre-Release Validation Job

**What:** Separate job that runs all tests before proceeding to publish

**When to use:** Ensure tag isn't "burned" by test failures after tagging

**Example:**
```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run backend tests
        run: uv sync && uv run pytest
      - name: Run frontend tests
        run: cd ui && npm ci && npm test
      - name: Run extension tests
        run: cd extension && npm ci && npm test

  version-sync:
    needs: validate  # Blocks if tests fail
    runs-on: ubuntu-latest
    steps:
      # ... version injection steps
```

### Pattern 3: Docker Build Args for Version Labels

**What:** Pass version as build argument to inject into Docker image labels

**When to use:** For OCI-compliant version metadata in Docker images

**Example:**
```dockerfile
# Dockerfile
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
```

```yaml
# workflow
- name: Set build metadata
  id: meta
  run: |
    echo "VERSION=${{ github.ref_name }}" >> $GITHUB_OUTPUT
    echo "BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> $GITHUB_OUTPUT
    echo "VCS_REF=${{ github.sha }}" >> $GITHUB_OUTPUT

- name: Build Docker image
  run: |
    docker build \
      --build-arg VERSION=${{ steps.meta.outputs.VERSION }} \
      --build-arg BUILD_DATE=${{ steps.meta.outputs.BUILD_DATE }} \
      --build-arg VCS_REF=${{ steps.meta.outputs.VCS_REF }} \
      -t app:${{ steps.meta.outputs.VERSION }} \
      .
```

### Anti-Patterns to Avoid

- **Automatic version bumping in CI:** User decided manual tagging for release control
- **SemVer tools for CalVer:** semantic-release, bump2version assume SemVer conventions
- **Mutable version files as source:** pyproject.toml changes between commits, git tags are immutable
- **v-prefix in tags:** User decided no prefix, keep consistent
- **Separate workflows per artifact:** One tag should trigger all three, not separate tags per artifact

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON modification | Python script to update manifest.json | jq (built-in) | jq is standard, handles edge cases (whitespace, escape sequences), pre-installed |
| TOML modification | Custom TOML parser | sed with simple pattern | pyproject.toml version is simple `version = "X.Y.Z"` format, sed is sufficient |
| Tag format validation | Complex string parsing | Bash regex `^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$` | Regex is concise and handles optional hotfix suffix |
| Version from git | Parsing `git describe` output | `github.ref_name` variable | GitHub Actions provides clean tag name directly |
| Multi-registry push | Custom Docker push loop | Docker tag + push per registry | Standard practice, explicit and debuggable |

**Key insight:** Version management is cross-cutting but well-supported by standard tools. Avoid custom scripting when shell tools and GitHub Actions variables provide the functionality with zero dependencies.

## Common Pitfalls

### Pitfall 1: Tag/Version Mismatch

**What goes wrong:** Developer tags release as 2026.02.18, but pyproject.toml still shows 0.1.0. Published artifacts have inconsistent versions.

**Why it happens:** Manual process requires updating multiple files, easy to forget one

**How to avoid:** Use CI injection pattern. Git tag is source, CI updates files automatically. Validation step catches any mismatches before publishing.

**Warning signs:** CI logs show different versions in validation step, users report extension version doesn't match docker image version

### Pitfall 2: Forgetting to Update CHANGELOG

**What goes wrong:** Release published without changelog entry. Users don't know what changed. Have to retroactively update and re-release.

**Why it happens:** CHANGELOG update is easy to forget when focused on code changes

**How to avoid:** CI validation step with grep check: `grep -q "$VERSION" CHANGELOG.md` fails build if not found. Forces developer to update CHANGELOG before tagging.

**Warning signs:** CI build fails on "CHANGELOG.md does not mention version X.Y.Z"

### Pitfall 3: Reusing/Moving Tags

**What goes wrong:** Tag 2026.02.18 created, CI publishes. Developer realizes mistake, deletes and recreates tag. Docker registry has v1, GitHub release has v2 of same version. Users get inconsistent artifacts.

**Why it happens:** Git allows deleting and recreating tags, but registries cache first version

**How to avoid:** Treat tags as immutable. Document: "Never delete/move tags". Use hotfix suffix instead (2026.02.18.1). Registry webhooks often cache first version permanently.

**Warning signs:** Re-pushed tag doesn't trigger CI (GitHub caches), registry shows old version, user reports mismatched checksums

### Pitfall 4: Test Failures After Tagging

**What goes wrong:** Developer creates tag 2026.02.18. CI triggers, runs tests, tests fail. Tag exists but release is blocked. Tag now "burned" (can't reuse).

**Why it happens:** Didn't verify all tests pass before tagging

**How to avoid:** Pre-tag checklist: ensure CI green on main, run tests locally, then tag. Workflow structure: validate job (tests) runs before version-sync job (needs: validate).

**Warning signs:** Tag exists but no release published, CI shows red status on tag

### Pitfall 5: pyproject.toml Source of Truth Confusion

**What goes wrong:** Requirement says "pyproject.toml as single source", but git tag triggers publishing. Developer doesn't know which to update first. Circular dependency.

**Why it happens:** "Source of truth" can mean "source for defining" or "source for reading"

**How to avoid:** **Clarification:** Git tag is the PRIMARY source (immutable, triggers CI). pyproject.toml is READABLE source (what code reads at runtime). CI bridges them: tag → injection → pyproject.toml. "Single source of truth" means "one source for reading", not "one source for defining".

**Warning signs:** Confusion about whether to update pyproject.toml or create tag first

### Pitfall 6: Chrome Extension Version Format Incompatibility

**What goes wrong:** Git tag uses "2026.02.18", but Chrome Web Store requires specific integer format. Version rejected on upload.

**Why it happens:** Misunderstanding Chrome extension version requirements

**How to avoid:** Chrome Web Store accepts 1-4 dot-separated integers (0-65535). CalVer YYYY.MM.DD format works directly: 2026.02.18 → "2026.2.18" (valid). Keep format consistent between tag and manifest.

**Warning signs:** Extension upload fails with "invalid version format"

### Pitfall 7: Docker Build Args Not Propagating

**What goes wrong:** Pass VERSION build arg but Docker image still shows "dev" version in labels.

**Why it happens:** ARG declared after layer that uses it, or not interpolated correctly

**How to avoid:** Declare ARG before using it. Use `${VERSION}` syntax in LABEL. Place version LABELs at END of Dockerfile to maximize layer caching.

**Warning signs:** `docker inspect` shows wrong version in labels

## Code Examples

Verified patterns from standard tooling:

### Extract Version from GitHub Tag

```yaml
# Source: GitHub Actions built-in variables
- name: Extract version from tag
  id: version
  run: echo "VERSION=${{ github.ref_name }}" >> $GITHUB_OUTPUT

- name: Use version in later step
  run: echo "Building version ${{ steps.version.outputs.VERSION }}"
```

**Context:** `github.ref_name` gives clean tag name ("2026.02.18"), not full ref ("refs/tags/2026.02.18")

### Validate CalVer Format

```bash
# Source: Standard bash regex
if [[ ! "$VERSION" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$ ]]; then
  echo "Invalid tag format: must be YYYY.MM.DD or YYYY.MM.DD.N"
  exit 1
fi
```

**Context:** Pattern allows base format (2026.02.18) and optional hotfix suffix (2026.02.18.1)

### Update pyproject.toml Version

```bash
# Source: sed pattern matching
sed -i 's/version = ".*"/version = "2026.02.18"/' pyproject.toml
```

**Context:** Simple replacement, pyproject.toml version format is predictable: `version = "X.Y.Z"`

### Update manifest.json Version

```bash
# Source: jq JSON manipulation
cd extension
jq --arg version "2026.02.18" \
   '.version = $version' \
   manifest.json > manifest.json.tmp
mv manifest.json.tmp manifest.json
```

**Context:** jq handles JSON properly (escaping, whitespace), more reliable than sed for JSON

### Validate Version Consistency

```bash
# Source: Shell script pattern
TAG_VERSION="2026.02.18"
PYPROJECT_VERSION=$(grep '^version = ' pyproject.toml | cut -d'"' -f2)
MANIFEST_VERSION=$(jq -r '.version' extension/manifest.json)

ERRORS=()
if [ "$PYPROJECT_VERSION" != "$TAG_VERSION" ]; then
  ERRORS+=("pyproject.toml version mismatch")
fi
if [ "$MANIFEST_VERSION" != "$TAG_VERSION" ]; then
  ERRORS+=("manifest.json version mismatch")
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  printf '%s\n' "${ERRORS[@]}"
  exit 1
fi
```

**Context:** Collect all errors before failing, provides complete error report

### Validate CHANGELOG Updated

```bash
# Source: grep pattern matching
if ! grep -q "2026.02.18" CHANGELOG.md; then
  echo "CHANGELOG.md does not mention version 2026.02.18"
  exit 1
fi
```

**Context:** Simple presence check, can be enhanced to check for heading format

### Docker Version Labels

```dockerfile
# Source: OCI Image Spec
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
```

**Context:** Standard OCI labels for tracing image to source. Place at end of Dockerfile for better caching.

### Multi-Registry Docker Push

```yaml
# Source: Standard Docker workflow pattern
- name: Push to multiple registries
  run: |
    VERSION=${{ github.ref_name }}

    # GitHub Container Registry
    docker tag app:build ghcr.io/user/app:${VERSION}
    docker push ghcr.io/user/app:${VERSION}
    docker tag app:build ghcr.io/user/app:latest
    docker push ghcr.io/user/app:latest

    # Docker Hub
    docker tag app:build user/app:${VERSION}
    docker push user/app:${VERSION}
    docker tag app:build user/app:latest
    docker push user/app:latest
```

**Context:** Explicit tag + push per registry/tag combination. More verbose but easier to debug than loops.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual version files | Git tag as source with CI injection | 2020s | Eliminates manual sync errors, single action triggers release |
| SemVer for all projects | CalVer for date-relevant tools | 2015+ | Release date tells the story better for fast-shipping tools |
| Docker LABEL in FROM | ARG + LABEL pattern | 2018 | Dynamic metadata, better caching |
| docker/metadata-action | Direct github.ref_name | Current | Simpler, fewer dependencies for basic CalVer |
| setuptools_scm | hatch-vcs for hatch projects | 2023 | Better integration with modern Python packaging |

**Deprecated/outdated:**
- **bump2version/bumpversion:** Designed for SemVer, manual file updates. Superseded by git-tag-based versioning.
- **versioneer:** Complex setup, setuptools-focused. Modern projects use hatch-vcs or direct injection.
- **semantic-release:** Automates releases based on commit messages. User decided manual control for release timing.

## Open Questions

1. **Should we use hatch-vcs instead of sed injection?**
   - What we know: hatch-vcs is cleaner (no file modification), but adds dependency and requires git history
   - What's unclear: Whether git history access is issue in multi-stage Docker builds
   - Recommendation: Start with sed/jq (zero dependencies), migrate to hatch-vcs if file injection becomes maintenance burden

2. **Should Docker images have month/year alias tags (2026.02, 2026)?**
   - What we know: Common pattern for convenience, but mutable tags can confuse
   - What's unclear: Whether users will want month-based pinning
   - Recommendation: Start with exact version + latest only, add aliases in v2 if requested

3. **Should CHANGELOG validation check for specific heading format?**
   - What we know: Simple grep checks presence, could enforce "## [2026.02.18]" format
   - What's unclear: Whether strict format is helpful or annoying
   - Recommendation: Start with presence check, enhance if CHANGELOG quality becomes issue

## Sources

### Primary (HIGH confidence)

- GitHub Actions documentation (built-in variables): github.ref, github.ref_name, github.ref_type usage
- Docker OCI Image Spec: Standard label format (org.opencontainers.image.*)
- Chrome Web Store manifest.json spec: Version format requirements (1-4 integers, 0-65535 range)
- Hatch documentation (https://raw.githubusercontent.com/pypa/hatch/master/docs/version.md): Version source plugins, hatch-vcs usage

### Secondary (MEDIUM confidence)

- CalVer.org principles: YYYY.MM.DD format, when to use CalVer vs SemVer
- Ubuntu CalVer usage: YY.MM format example (24.04, 24.10)
- OpenClaw precedent: User-referenced CalVer pattern

### Tertiary (LOW confidence)

- Common GitHub Actions patterns: Observed in open-source projects, not officially documented
- Docker Hub tagging conventions: Community practice, not strict standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are built-in to ubuntu-latest runners, well-documented
- Architecture: HIGH - Pattern (git tag → CI injection → artifacts) is proven and widely used
- Pitfalls: HIGH - Based on common version management errors documented across projects

**Research date:** 2026-02-18
**Valid until:** 2027-02-18 (1 year - version management practices are stable, but check for new GitHub Actions features)
