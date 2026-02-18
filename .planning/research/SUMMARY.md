# Project Research Summary

**Project:** Where Is My Shit (WIMS) - v1.7 Distribution & Packaging
**Domain:** Distribution Automation - Docker, Chrome Extension, Standalone Daemon
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

This milestone focuses on making WIMS easily distributable through three automated publishing channels: Docker images, Chrome Web Store extension, and standalone daemon binaries. The research reveals that all three distribution mechanisms integrate cleanly as packaging/deployment wrappers without modifying core application architecture.

The recommended approach builds three independent parallel tracks: (1) Docker multi-stage builds with volume persistence for the FastAPI+React server, (2) GitHub Actions workflow for automated Chrome Web Store publishing via API, and (3) PyInstaller cross-platform binary packaging with GitHub Releases hosting. Each track is additive - the existing git clone workflow continues to work, and users can mix installation methods.

Key risks center on version synchronization chaos across four components (pyproject.toml, manifest.json, Docker tags, git tags), secrets leakage in Docker layers, and platform-specific dependency incompatibilities. These are mitigated through single-source-of-truth version management, BuildKit secrets for Docker, and CI matrix testing on oldest supported platforms. The project is ready for distribution automation with existing documentation and passing CI.

## Key Findings

### Recommended Stack

Docker, GitHub Actions, and PyInstaller provide proven patterns for the three distribution channels. No new language dependencies required - leveraging existing Python and Node.js infrastructure.

**Core technologies:**
- **Docker multi-stage builds**: Combines React frontend build + FastAPI backend into single image with ~400MB footprint - separates build dependencies from runtime, uses python:3.12-slim base
- **GitHub Actions workflows**: Automates publishing on git tag triggers - uses Chrome Web Store API for extension, GitHub Container Registry for Docker, GitHub Releases for binaries
- **PyInstaller**: Bundles Python+dependencies into standalone executables (~50MB per platform) - cross-platform builds via GitHub Actions matrix on ubuntu-latest, macos-latest, windows-latest
- **chrome-webstore-upload action (mnao305/chrome-extension-upload@v5)**: Handles OAuth refresh token flow and Chrome Web Store API upload - requires one-time setup of client credentials and refresh token
- **docker buildx**: Multi-architecture builds for AMD64 and ARM64 - prevents "exec format error" on different platforms

### Expected Features

Distribution mechanisms are packaging layers, not application features. The milestone delivers installation/deployment capabilities rather than user-facing functionality.

**Must have (table stakes):**
- **Docker image publishing**: Users expect `docker compose up -d` for server deployment - automated push to GitHub Container Registry on version tags
- **Chrome Web Store availability**: Users expect extension installation without "load unpacked" friction - automated publish workflow replaces manual submission
- **Standalone daemon binary**: Users expect download+run without Python setup - PyInstaller bundles create platform-specific executables for watcher daemon

**Should have (competitive):**
- **Multi-architecture Docker support**: AMD64 + ARM64 for broad compatibility - prevents platform-specific deployment failures
- **Version synchronization**: All components show consistent versions - critical for support and debugging
- **Automated smoke tests**: Verify artifacts work before publishing - prevents broken releases reaching users

**Defer (v2+):**
- **Code signing for macOS/Windows**: Prevents Gatekeeper/SmartScreen warnings - costs $99-$200/year, optional for initial release
- **Homebrew/apt repositories**: Package manager integration for daemon - adds complexity, GitHub Releases sufficient for v1
- **Docker Hub publishing**: Alternative registry - GitHub Container Registry sufficient, avoids rate limits

### Architecture Approach

All three distribution tracks are independent and can be built in parallel. Each wraps existing components without modifying core application logic. The strategy is additive - existing git clone workflow remains supported.

**Major components:**

1. **Docker Distribution Layer** - Multi-stage Dockerfile (frontend build stage → backend runtime stage) with docker-compose.yml orchestration, volume mounts for database persistence at `/data` and config at `/.wims`, healthcheck endpoint validation, environment variable configuration overrides

2. **Chrome Extension Publishing Pipeline** - GitHub Actions workflow triggered on `extension-v*` tags, extracts version from tag and injects into manifest.json at build time, packages dist/ directory as ZIP, uploads via Chrome Web Store API with OAuth refresh token, creates GitHub Release with downloadable ZIP attachment

3. **Standalone Daemon Packaging System** - PyInstaller spec file bundles Python interpreter + watchdog dependencies into single executable, cross-platform GitHub Actions matrix builds on ubuntu-20.04 (for older glibc compatibility), macos-latest (ARM64), windows-latest, installation scripts (install.sh for Linux/macOS, install.ps1 for Windows) download from GitHub Releases and extract to `~/.local/bin` or equivalent

### Critical Pitfalls

Top 5 pitfalls that will cause immediate problems if not addressed:

1. **Version Sync Chaos Across Components** - Four version sources (pyproject.toml, manifest.json, Dockerfile labels, git tags) diverge, causing API incompatibilities between extension and server updates, support nightmares when versions don't match - AVOID by using pyproject.toml as single source of truth, inject version into all artifacts at build time, add CI validation that fails if versions don't match

2. **Docker Image Secrets Leakage** - GitHub tokens or API keys embedded in Docker ENV/ARG persist in image layers even if deleted later, public registry exposes credentials via `docker history` inspection - AVOID by using Docker BuildKit `--mount=type=secret` for build-time secrets, add `.dockerignore` with `.env*` patterns, CI job scans docker history for sensitive patterns and fails build

3. **Multi-Architecture Publishing Hell** - Docker image built on ARM64 Mac won't run on AMD64 Linux servers (exec format error) or runs under emulation at 10x slower speed, binary dependencies like fastembed have architecture-specific builds - AVOID by using `docker buildx build --platform linux/amd64,linux/arm64`, GitHub Actions builds both architectures, test on actual target platforms in CI matrix

4. **Chrome Extension Permission Creep Rejection** - Adding broad permissions like `<all_urls>` triggers Chrome Web Store review rejection, existing users see scary permission expansion prompts and uninstall - AVOID by requesting minimum permissions actively used in code (current WIMS manifest is already correct with specific host_permissions), document justification for each permission in submission notes, use optional permissions for future features

5. **Automated Publishing Without Smoke Tests** - Workflow builds and publishes immediately, broken Docker image or extension with import errors reaches users before discovery - AVOID by adding integration smoke tests that start container/install extension and verify basic API calls work, require manual approval gate before publishing to production registries, document rollback procedure

## Implications for Roadmap

Based on research, suggested phase structure groups work by distribution channel with clear dependency ordering:

### Phase 1: Docker Publishing (Highest Priority)
**Rationale:** Biggest user impact - Docker provides one-command deployment without Python/Node.js setup, self-contained with persistence, addresses widest user base wanting simplified installation
**Delivers:** Multi-stage Dockerfile with frontend+backend, docker-compose.yml for dev and production, GitHub Actions workflow publishing to GitHub Container Registry on version tags, volume mounting strategy for database and config persistence
**Addresses:** Table stakes feature - users expect container deployment option for modern web applications
**Avoids:** Version sync chaos (establish single-source-of-truth pattern), secrets leakage (BuildKit secrets from day one), image size bloat (multi-stage build removes dev dependencies and build tools), multi-arch issues (buildx with AMD64+ARM64)
**Dependencies:** None - can start immediately
**Estimated Effort:** 6-8 hours

### Phase 2: Chrome Extension Automation (Medium Priority)
**Rationale:** Reduces friction for extension users who currently must manually "load unpacked", improves discoverability through Chrome Web Store listing, professional appearance with automated updates
**Delivers:** GitHub Actions workflow triggered on extension-v* tags, Chrome Web Store API integration with OAuth credentials, version synchronization from pyproject.toml to manifest.json, GitHub Release creation with extension ZIP attachment
**Addresses:** Distribution friction - manual load unpacked is developer-only workflow, Chrome Web Store is expected channel for end users
**Avoids:** Permission creep rejection (audit current manifest permissions, document justifications), manifest version mismatch (build-time version injection), CSP violations (webpack production config already correct)
**Dependencies:** Chrome Web Store developer account ($5 one-time fee), OAuth credentials setup (one-time 15-minute process)
**Estimated Effort:** 4-6 hours

### Phase 3: Standalone Daemon Packaging (Lower Priority)
**Rationale:** wims-watcher currently requires Python setup via pip install, standalone binary removes dependency but serves smaller user base (only users wanting file watching), more complex than other tracks due to cross-platform compilation
**Delivers:** PyInstaller spec file for daemon bundling, GitHub Actions matrix building Linux/macOS/Windows binaries, installation scripts (install.sh, install.ps1) that download from GitHub Releases and extract to PATH, documentation for each platform's installation method
**Addresses:** Developer experience friction - Python environment setup is barrier for non-technical users wanting watcher functionality
**Avoids:** Platform dependency hell (build on ubuntu-20.04 for older glibc, test on CI matrix with multiple distros), installer conflicts with git clone workflow (different install paths and systemd service names), dev dependency bloat (PyInstaller uses runtime requirements.txt only)
**Dependencies:** None - PyInstaller is pure Python, GitHub Actions provides multi-platform runners
**Estimated Effort:** 8-10 hours

### Phase Ordering Rationale

- **Phase 1 first:** Docker has highest user impact (server deployment is core use case), establishes version synchronization and CI patterns reused in later phases, no external dependencies beyond GitHub
- **Phase 2 second:** Extension publishing is quick win (lower complexity than daemon), requires one-time OAuth setup but then fully automated, unblocks Chrome Web Store listing for broader distribution
- **Phase 3 last:** Daemon packaging is optional enhancement (users can still pip install), highest complexity due to cross-platform builds, smallest user impact (only benefits watcher users)
- **All phases can run in parallel:** No shared code changes except minor config.py tweaks for environment variable overrides, independent GitHub Actions workflows, separate build artifacts

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Daemon):** Platform-specific system requirements need verification on actual target distros - research shows ubuntu-20.04 baseline recommended but Debian/Rocky/Fedora compatibility should be tested, macOS code signing process poorly documented for open-source projects
- **Phase 2 (Extension):** Chrome Web Store current review process timelines uncertain - tertiary sources suggest 3-7 days but official documentation doesn't specify, permission justification requirements may have changed since training data

Phases with standard patterns (skip research-phase):
- **Phase 1 (Docker):** Multi-stage builds and GitHub Container Registry publishing are well-documented with official examples, existing Dockerfile already demonstrates feasibility
- **Phase 2 (Extension - build workflow):** GitHub Actions and webpack bundling patterns are industry standard with extensive documentation
- **Phase 3 (Daemon - PyInstaller basics):** PyInstaller usage and spec files well-documented with official guides

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Docker, GitHub Actions, PyInstaller are all industry-standard tools with official documentation and mature ecosystems, verified against existing codebase which already has Dockerfile and extension build setup |
| Features | HIGH | Distribution mechanisms are packaging layers with clear requirements (publish on tag, multi-arch support, version sync), no ambiguity about what needs to be delivered |
| Architecture | HIGH | All three tracks integrate as wrappers without modifying core application, existing Dockerfile and extension setup demonstrate feasibility, LanceDB volume persistence pattern already working |
| Pitfalls | MEDIUM-HIGH | Docker and extension pitfalls backed by official documentation and codebase analysis (HIGH confidence), daemon cross-platform pitfalls based on general knowledge without recent PyInstaller verification (MEDIUM confidence) |

**Overall confidence:** HIGH

### Gaps to Address

Areas where research was inconclusive or needs validation during implementation:

- **Chrome Web Store review timelines:** Training data suggests 3-7 days but official documentation doesn't specify current SLA - HANDLE by assuming 1 week buffer in release planning, monitor first submission closely
- **macOS notarization for daemon:** Process well-documented but costs $99/year for Apple Developer account - HANDLE by shipping unsigned initially with documentation about Gatekeeper workaround (right-click → Open), add signing if user feedback indicates friction
- **Windows code signing for daemon:** Requires certificate (~$200/year) to avoid SmartScreen warnings - HANDLE same as macOS, document "More info → Run anyway" workaround, evaluate cost/benefit after initial release feedback
- **Platform-specific glibc versions:** Research recommends ubuntu-20.04 build for glibc 2.31 compatibility but actual target distro requirements unknown - HANDLE by testing on CI matrix with ubuntu-20.04/22.04/24.04, Debian, Rocky before release
- **Docker BuildKit secrets syntax:** Official documentation exists but not verified against current Docker version in project - HANDLE by testing BuildKit secrets in Phase 1 development, fallback to runtime environment variables if issues arise

## Sources

### Primary (HIGH confidence)
- Docker Multi-Stage Builds Documentation - Official Docker docs covering multi-stage build patterns
- Chrome Web Store API Documentation - Official Chrome developer docs for automated publishing
- PyInstaller Documentation - Official PyInstaller docs covering spec files and cross-compilation
- GitHub Actions Documentation - Official GitHub docs for workflows, matrix builds, and releases
- LanceDB Storage Documentation - Official LanceDB docs covering file-based storage and persistence
- Existing WIMS codebase - setup.sh, Dockerfile, extension/manifest.json, pyproject.toml analysis

### Secondary (MEDIUM confidence)
- chrome-webstore-upload-cli GitHub repository - Community-maintained tool for Chrome Web Store automation (33k+ downloads/month indicates maturity)
- FastAPI in Containers guide - Tiangolo's official FastAPI Docker deployment documentation
- Best practices for writing Dockerfiles - Official Docker development best practices
- GitHub Actions: Building and Testing Python - Official GitHub guide for Python workflows
- Existing WIMS Dockerfile and docker-compose patterns - Demonstrates volume mounting already working

### Tertiary (LOW confidence)
- Chrome Web Store review timelines - Based on community reports, not official SLA
- Extension review rejection patterns - Observed trends from developer forums, not current policy documentation
- Cross-platform installer challenges - General software engineering knowledge, not WIMS-specific verification
- PyInstaller binary size optimization - Community best practices, not benchmarked on WIMS dependencies

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
