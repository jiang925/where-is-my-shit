# Requirements: Where Is My Shit (WIMS)

**Defined:** 2026-02-18
**Core Value:** Never lose a conversation again: Instantly recall specific AI discussions or dev sessions across any platform and jump straight back into the original context.

## v1.7 Requirements

Requirements for Distribution & Packaging milestone. Each maps to roadmap phases.

### Docker Publishing

- [ ] **DOCK-01**: Multi-platform Docker images (AMD64, ARM64)
- [ ] **DOCK-02**: Auto-publish to GitHub Container Registry on version tags
- [ ] **DOCK-03**: Auto-publish to Docker Hub on version tags
- [ ] **DOCK-04**: Semantic version tags (v1.7.0, latest, v1)
- [ ] **DOCK-05**: docker-compose.yml template for users
- [ ] **DOCK-06**: Volume mounts for database and config persistence

### Chrome Extension

- [ ] **EXT-01**: Publish extension to Chrome Web Store
- [ ] **EXT-02**: Automated publishing from GitHub Actions
- [ ] **EXT-03**: Privacy policy page (Web Store requirement)
- [ ] **EXT-04**: Version sync from git tag to manifest.json

### Daemon Distribution

- [ ] **DAEMON-01**: One-liner install script (curl | bash)
- [ ] **DAEMON-02**: Auto-install uv if not present on system
- [ ] **DAEMON-03**: Download watcher from GitHub Releases
- [ ] **DAEMON-04**: Setup systemd (Linux) and launchd (macOS) service
- [ ] **DAEMON-05**: Auto-update mechanism (check releases, prompt user)
- [ ] **DAEMON-06**: Uninstall script for clean removal

### Version Management

- [ ] **VER-01**: pyproject.toml as single source of truth
- [ ] **VER-02**: CI validates version consistency across all artifacts
- [ ] **VER-03**: Git tags trigger all publishing workflows

## v1.8 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Code Signing
- **SIGN-01**: macOS daemon code signing ($99/year Apple Developer Program)
- **SIGN-02**: Windows daemon code signing (~$200/year certificate)

### Package Managers
- **PKG-01**: Homebrew tap for daemon installation
- **PKG-02**: APT repository for Debian/Ubuntu

### Distribution Enhancements
- **DIST-01**: Extension beta distribution channel for testing
- **DIST-02**: Docker Hub secondary registry mirror

## Out of Scope

Explicitly excluded to prevent scope creep.

| Feature | Reason |
|---------|--------|
| PyPI publication | Avoid PyPI complexity and bureaucracy, use GitHub Releases for daemon distribution instead |
| Binary daemon (PyInstaller) | Script-based approach simpler and faster, target users have Python already |
| Auto-update without user prompt | Security risk, all updates require explicit user approval |
| Publishing every commit | Rate limits and noise, only publish on version tags |
| Automated rollback | Manual intervention acceptable for v1, add if production issues arise |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VER-01 | Phase 22 | Not started |
| VER-02 | Phase 22 | Not started |
| VER-03 | Phase 22 | Not started |
| DOCK-01 | Phase 23 | Not started |
| DOCK-02 | Phase 23 | Not started |
| DOCK-03 | Phase 23 | Not started |
| DOCK-04 | Phase 23 | Not started |
| DOCK-05 | Phase 23 | Not started |
| DOCK-06 | Phase 23 | Not started |
| EXT-01 | Phase 24 | Not started |
| EXT-02 | Phase 24 | Not started |
| EXT-03 | Phase 24 | Not started |
| EXT-04 | Phase 24 | Not started |
| DAEMON-01 | Phase 25 | Not started |
| DAEMON-02 | Phase 25 | Not started |
| DAEMON-03 | Phase 25 | Not started |
| DAEMON-04 | Phase 25 | Not started |
| DAEMON-05 | Phase 25 | Not started |
| DAEMON-06 | Phase 25 | Not started |

**Coverage:**
- v1.7 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation*
