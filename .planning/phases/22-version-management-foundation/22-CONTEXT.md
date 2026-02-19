# Phase 22: Version Management & Foundation - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish single source of truth for version synchronization across all distribution artifacts (Docker images, Chrome extension, daemon installer). Creates foundation for automated publishing in phases 23-25.

</domain>

<decisions>
## Implementation Decisions

### Version Number Format
- **CalVer with full date:** 2026.02.18 format (YYYY.MM.DD)
- **Hotfix suffix:** Same-day releases use dotted suffix (2026.02.18.1, 2026.02.18.2)
- **No v-prefix:** Tags are `2026.02.18` not `v2026.02.18`
- **Rationale:** OpenClaw precedent, clearer than semantic versioning for fast-shipping tool, date tells release timeline story

### Git Tagging Strategy
- **Unified tag:** One tag (2026.02.18) triggers publishing for all three artifacts (Docker, Extension, Daemon)
- **Manual tagging:** Developer creates tags when ready to release, not automated on every push
- **Tag triggers CI:** Git tag push starts the publishing workflows

### CI Validation Approach
- **What gets validated:**
  - Version consistency: pyproject.toml, manifest.json, Docker labels all match git tag
  - All tests passing: backend, frontend, e2e tests must pass
  - Changelog updated: CHANGELOG.md must mention this version
- **Validation timing:** Only on tag pushes, not regular commits
- **Failure handling:** Fail build and block publish (no warnings-only mode)

### Version Injection Methods
- **Claude's Discretion:** Implementation approach for extracting version from git tag and injecting into artifacts
- Likely approach: Git tag as source of truth, build-time injection into files

</decisions>

<specifics>
## Specific Ideas

- Follow OpenClaw's CalVer pattern (similar tool, similar audience)
- Keep versions in sync across all artifacts - no divergence allowed
- Manual tagging gives release control while CI handles automation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-version-management-foundation*
*Context gathered: 2026-02-18*
