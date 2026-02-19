# Phase 23: Docker Publishing - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-publish multi-platform Docker images to GitHub Container Registry when CalVer tags are pushed. Extends the release.yml workflow from Phase 22 with Docker build and push steps.

</domain>

<decisions>
## Implementation Decisions

### Image Optimization
- **Two image variants:** full (pre-downloaded models) and slim (download at runtime)
- **Full variant:** ~800MB, embedding models pre-downloaded, instant startup
- **Slim variant:** ~200MB, models download on first run, smaller footprint
- **Tags:** 2026.02.18-full, 2026.02.18-slim, 2026.02.18 (alias for -full), latest, latest-slim
- **Implementation:** Single Dockerfile with ARG DOWNLOAD_MODELS build argument

### Registry Strategy
- **GitHub Container Registry (GHCR) only:** ghcr.io/jiang925/wims
- **No Docker Hub:** Simpler, no separate account/tokens needed
- **Visibility:** Inherits from repo (private now, public when repo goes public)
- **Naming:** ghcr.io/jiang925/wims:[tag]

### docker-compose.yml Design
- **Claude's Discretion:** Structure, environment variables, volume configuration
- Should include practical examples for common use cases

### Multi-platform Builds
- **linux/amd64:** Intel/AMD servers (required)
- **linux/arm64:** Apple Silicon, ARM servers (required)
- **No ARM v7:** Skip Raspberry Pi 3/older embedded (niche)

</decisions>

<specifics>
## Specific Ideas

- Two variants give users real choice (size vs speed)
- Default tag (2026.02.18) should be the full variant for better UX
- Build time ~20 min total (buildx builds variants in parallel)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-docker-publishing*
*Context gathered: 2026-02-18*
