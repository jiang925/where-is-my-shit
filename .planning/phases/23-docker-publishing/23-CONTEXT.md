# Phase 23: Docker Publishing - Context

**Gathered:** 2026-02-19
**Status:** Automated publishing deferred

<domain>
## Phase Boundary

Provide Docker deployment option for WIMS. Dockerfile and docker-compose.yml for manual builds. Automated publishing to container registries deferred due to infrastructure constraints.

</domain>

<decisions>
## Implementation Decisions

### Image Optimization
- **Single slim image:** ~200MB base, models download at runtime
- **No pre-download:** Avoids GitHub Actions disk space issues
- **Runtime model download:** ~2GB on first startup (acceptable for self-hosted tool)

### Registry Strategy
- **Manual publishing only:** GitHub Actions 14GB disk limit prevents automated builds
- **Dockerfile provided:** Users can build locally with `docker build -t wims .`
- **Future:** Can add automation with self-hosted runner or alternative CI

### docker-compose.yml Design
- **Claude's Discretion:** Practical deployment example with volume mounts and environment overrides

### Multi-platform Builds
- **linux/amd64 only:** Covers 90%+ of servers
- **No ARM64:** GitHub Actions disk space constraints
- **Future:** Can add ARM64 with self-hosted runner

### Automated Publishing Status
- **Deferred:** Tested extensively but GitHub Actions runners (14GB) insufficient for PyTorch/transformers builds
- **Manual workaround:** Dockerfile functional, users build themselves
- **Revisit:** Phase 23.1 or later with self-hosted runner

</decisions>

<specifics>
## Specific Ideas

- Dockerfile works - validated locally
- docker-compose.yml provides one-command deployment
- Automation blocked by infrastructure, not code quality

</specifics>

<deferred>
## Deferred Ideas

- Automated GHCR publishing - needs self-hosted runner or lighter dependencies
- Multi-platform builds (ARM64) - same infrastructure constraints
- Multiple image variants (full/slim) - disk space issues

</deferred>

---

*Phase: 23-docker-publishing*
*Context gathered: 2026-02-19*
*Status: Automation deferred to future phase*
