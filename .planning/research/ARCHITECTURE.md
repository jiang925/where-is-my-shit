# Architecture Research: Distribution & Packaging

**Domain:** Distribution mechanisms for WIMS (Docker, Chrome Extension Publishing, Standalone Daemon)
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

This research identifies integration points for adding three distribution mechanisms to the existing WIMS architecture:

1. **Docker containerization** for easy server deployment
2. **Chrome Web Store automated publishing** for extension distribution
3. **Standalone daemon packaging** with PyInstaller for watcher distribution

**Key Finding:** All three distribution mechanisms integrate cleanly without modifying core application architecture. They are packaging/deployment layers that wrap existing components.

**Build Strategy:** Three independent tracks that can be built in parallel:
1. Docker: Multi-stage build combining React frontend build + FastAPI backend
2. Extension: GitHub Actions workflow with Chrome Web Store API
3. Daemon: PyInstaller cross-platform builds with GitHub Releases hosting

**Migration Impact:** Minimal. Existing git clone + setup.sh workflow remains supported alongside new distribution options.

## Current Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Installation Methods                     │
│                                                                  │
│  Current:  git clone → ./setup.sh → ./start.sh                  │
│  New:      Docker Compose | Chrome Web Store | Binary Download  │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  FastAPI      │  │   Chrome     │  │  File Watcher      │   │
│  │  Backend      │  │  Extension   │  │  (wims-watcher)    │   │
│  │               │  │              │  │                    │   │
│  │  • API Server │  │ • Content    │  │ • Watchdog service │   │
│  │  • Embeddings │  │   Scripts    │  │ • API Client       │   │
│  │  • LanceDB    │  │ • Background │  │ • Log Parsers      │   │
│  │  • Static UI  │  │   Worker     │  │                    │   │
│  └───────┬───────┘  └──────┬───────┘  └─────────┬──────────┘   │
│          │                  │                    │              │
│       (serves)          (sends to)           (sends to)         │
│          │                  │                    │              │
│  ┌───────▼──────────────────▼────────────────────▼──────────┐  │
│  │               React Frontend (built to src/static)        │  │
│  │               • Search UI • Browse UI • Settings          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Current Deployment Flow

```
Developer Setup:
  git clone → ./setup.sh → ./start.sh → http://localhost:8000

Setup.sh:
  1. Install uv (Python package manager)
  2. uv sync (install Python deps)
  3. Download embedding models

Start.sh:
  1. Check if ui/build exists, if not: cd ui && npm run build
  2. uv run uvicorn src.app.main:app --reload

Extension:
  1. cd extension && npm run build
  2. Manual load unpacked in chrome://extensions

Watcher:
  1. cd wims-watcher && ./install.sh
  2. Installs systemd user service
```

## Distribution Architecture

### 1. Docker Distribution

**Goal:** Package FastAPI backend + React frontend + embedded LanceDB into a single container for one-command deployment.

#### Multi-Stage Build Architecture

```dockerfile
# STAGE 1: Build Frontend (Node.js)
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY ui/package*.json ui/
RUN cd ui && npm ci
COPY ui/ ui/
RUN cd ui && npm run build
# Output: ui/dist/ → Static files

# STAGE 2: Build Backend (Python)
FROM python:3.12-slim AS backend
WORKDIR /app

# Install uv for dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc python3-dev curl && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (use lockfile for reproducibility)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH"

# Pre-download embedding model (cached in image)
RUN python -c "from fastembed import TextEmbedding; \
    TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

# Copy application code
COPY src/ src/

# Copy frontend build from stage 1
COPY --from=frontend-builder /build/ui/dist/ src/static/

# Create data directory for volume mount
RUN mkdir -p /data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Run server
CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Docker Compose for Production

```yaml
version: '3.8'

services:
  wims:
    build: .
    container_name: wims-server
    ports:
      - "8000:8000"
    volumes:
      # Persist database and config
      - wims-data:/data
      - wims-config:/root/.wims
    environment:
      # Override via .env file
      - DB_PATH=/data/wims.lance
      - LOG_LEVEL=INFO
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 3s
      retries: 3

volumes:
  wims-data:
    driver: local
  wims-config:
    driver: local
```

#### Integration Points

**Existing Components Modified:**
- **Dockerfile** (already exists, needs multi-stage enhancement)
- **docker-compose.yml** (NEW file)
- **.dockerignore** (NEW file to exclude node_modules, .venv, .git)

**New Components:**
- **docker-compose.prod.yml** - Production configuration
- **docker-entrypoint.sh** - Initialization script for container startup
- **docs/docker.md** - Docker deployment documentation

**Build Flow:**
```
User runs: docker compose up -d
  ↓
Docker builds multi-stage image:
  Stage 1: npm run build → src/static/
  Stage 2: uv sync → .venv/, download models
  ↓
Container starts with volumes mounted:
  /data → wims-data volume (LanceDB persistence)
  /root/.wims → wims-config volume (server.json)
  ↓
Server accessible at http://localhost:8000
API key auto-generated on first run
```

**Configuration Strategy:**

Three-level config precedence:
1. **Environment variables** (highest priority) - for Docker secrets
2. **Config file** (~/.wims/server.json) - for persistent settings
3. **Defaults** (lowest priority) - hardcoded in config.py

```python
# Existing config.py pattern supports this
class Settings(BaseSettings):
    API_KEY: str = Field(default_factory=lambda: generate_api_key())
    DB_PATH: str = "data/wims.lance"
    PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False
    )
```

Docker users can override via:
```yaml
environment:
  - API_KEY=sk-wims-custom-key
  - DB_PATH=/data/wims.lance
```

**Volume Mount Strategy:**

| Volume | Purpose | Size | Backup Priority |
|--------|---------|------|-----------------|
| `/data` | LanceDB database | 100MB-10GB | HIGH - contains all indexed conversations |
| `/root/.wims` | Server config (server.json) | <1MB | MEDIUM - regeneratable but loses API key |
| `/tmp` (tmpfs) | Embedding model cache | 2GB | LOW - downloaded on startup |

**Development vs Production:**

```bash
# Development (with hot reload)
docker compose -f docker-compose.dev.yml up

# Production (optimized, no reload)
docker compose -f docker-compose.prod.yml up -d
```

**Confidence:** HIGH
- Multi-stage builds are standard Docker pattern
- Dockerfile already exists in codebase, needs enhancement
- Volume mounts for database persistence are well-documented
- FastAPI + React multi-stage builds extensively documented

### 2. Chrome Extension Publishing

**Goal:** Automate extension publishing to Chrome Web Store from GitHub releases/tags.

#### Publishing Flow Architecture

```
Developer creates git tag → GitHub Actions workflow triggers
  ↓
1. Build extension (webpack)
   - npm install
   - npm run build
   - Output: extension/dist/
  ↓
2. Package extension
   - zip extension/dist/ → wims-extension-v0.1.0.zip
  ↓
3. Upload to Chrome Web Store
   - Use Chrome Web Store API
   - Requires: refresh token, client ID, client secret
   - API uploads zip file
  ↓
4. Publish to testers or public
   - API call to publish uploaded version
   - Can target: testers, trusted testers, or public
  ↓
5. Create GitHub Release
   - Attach wims-extension-v0.1.0.zip
   - Generate release notes from commits
```

#### GitHub Actions Workflow

```yaml
# .github/workflows/publish-extension.yml
name: Publish Chrome Extension

on:
  push:
    tags:
      - 'extension-v*'  # Trigger on extension-v0.1.0 tags

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: extension/package-lock.json

      - name: Extract version from tag
        id: version
        run: |
          VERSION=${GITHUB_REF#refs/tags/extension-v}
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Update manifest version
        working-directory: ./extension
        run: |
          jq '.version = "${{ steps.version.outputs.version }}"' manifest.json > manifest.tmp
          mv manifest.tmp manifest.json

      - name: Install dependencies
        working-directory: ./extension
        run: npm ci

      - name: Build extension
        working-directory: ./extension
        run: npm run build

      - name: Package extension
        run: |
          cd extension/dist
          zip -r ../../wims-extension-v${{ steps.version.outputs.version }}.zip .

      - name: Upload to Chrome Web Store
        uses: mnao305/chrome-extension-upload@v5.0.0
        with:
          file-path: wims-extension-v${{ steps.version.outputs.version }}.zip
          extension-id: ${{ secrets.CHROME_EXTENSION_ID }}
          client-id: ${{ secrets.CHROME_CLIENT_ID }}
          client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}
          publish: true  # Auto-publish or draft

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: wims-extension-v${{ steps.version.outputs.version }}.zip
          generate_release_notes: true
          draft: false
```

#### Secrets Management

**Required GitHub Secrets:**

| Secret | Source | Purpose |
|--------|--------|---------|
| `CHROME_EXTENSION_ID` | Chrome Web Store Developer Dashboard | Extension identifier (fixed after first upload) |
| `CHROME_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials | OAuth client for Web Store API |
| `CHROME_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 credentials | OAuth client secret |
| `CHROME_REFRESH_TOKEN` | One-time OAuth flow using chrome-webstore-upload-cli | Long-lived token for automated uploads |

**Obtaining Secrets (One-Time Setup):**

```bash
# Install CLI tool
npm install -g chrome-webstore-upload-cli

# Generate refresh token (opens browser for OAuth)
chrome-webstore-upload-cli \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET \
  --refresh-token

# Outputs refresh token → save to GitHub Secrets
```

**Security Best Practices:**
- Use GitHub Environment Secrets (production environment)
- Restrict workflow to main branch and version tags
- Enable branch protection for main
- Review extension changes in PR before merge

#### Version Syncing Strategy

**Problem:** Keep manifest.json version in sync with git tags

**Solution:** Use git tags as source of truth, update manifest during workflow

```yaml
# In workflow, before build:
- name: Update manifest version
  run: |
    VERSION=${GITHUB_REF#refs/tags/extension-v}
    jq '.version = "$VERSION"' extension/manifest.json > manifest.tmp
    mv manifest.tmp extension/manifest.json
```

**Version Scheme:**
- Git tag: `extension-v0.1.0`
- Manifest version: `0.1.0` (semantic versioning required by Chrome)
- GitHub Release: `Extension v0.1.0`

#### Integration Points

**Existing Components Modified:**
- **extension/manifest.json** - version field updated by workflow
- **extension/package.json** - no changes (version not used by Chrome)

**New Components:**
- **.github/workflows/publish-extension.yml** - Publishing workflow
- **docs/extension-publishing.md** - Publishing documentation
- **scripts/generate-refresh-token.sh** - Helper for OAuth setup

**Build Flow:**
```
Developer creates tag: git tag extension-v0.1.0 && git push --tags
  ↓
GitHub Actions triggered
  ↓
Workflow checks out code
  ↓
Updates manifest.json version from tag
  ↓
npm ci && npm run build
  ↓
Zips extension/dist/ → wims-extension-v0.1.0.zip
  ↓
Chrome Web Store API upload
  ↓
Chrome Web Store API publish
  ↓
GitHub Release created with zip attached
  ↓
Users download from GitHub or Chrome Web Store
```

**Publishing Modes:**

| Mode | Trigger | Visibility | Use Case |
|------|---------|------------|----------|
| Draft | Manual workflow dispatch | Hidden | Pre-release testing |
| Trusted Testers | Tag: `extension-v*-beta` | Limited audience | Beta testing |
| Public | Tag: `extension-v*` (no suffix) | Everyone | Production release |

**Rollback Strategy:**

If published version has critical bug:
1. Create new tag with patch version (e.g., `extension-v0.1.1`)
2. Workflow publishes new version
3. Chrome auto-updates users within 24 hours

No way to unpublish or rollback in Chrome Web Store. Must fix forward.

**Confidence:** HIGH
- Chrome Web Store API well-documented
- GitHub Actions marketplace has maintained chrome-extension-upload action
- OAuth refresh token flow is standard
- Versioning sync pattern is battle-tested

### 3. Standalone Daemon Packaging

**Goal:** Package wims-watcher as standalone executable for easy installation without Python setup.

#### PyInstaller Packaging Architecture

```
Source Python files → PyInstaller → Platform-specific binary
                              ↓
                    ┌─────────┴──────────┐
                    │                    │
              Linux binary          macOS binary         Windows binary
              (ELF 64-bit)          (Mach-O)            (PE .exe)
                    │                    │                    │
              Install to:            Install to:          Install to:
              ~/.local/bin/          /usr/local/bin/      C:\Program Files\
```

#### PyInstaller Build Configuration

```python
# wims-watcher/wims-watcher.spec
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['src/main.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Include config templates
        ('config.template.json', '.'),
    ],
    hiddenimports=[
        'watchdog.observers',
        'watchdog.events',
        'requests',
        'structlog',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='wims-watcher',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # Compress binary
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # CLI application
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

#### Cross-Platform Build Matrix

```yaml
# .github/workflows/build-daemon.yml
name: Build Standalone Daemon

on:
  push:
    tags:
      - 'daemon-v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            platform: linux
            arch: x86_64
            binary_name: wims-watcher
          - os: macos-latest
            platform: macos
            arch: arm64
            binary_name: wims-watcher
          - os: windows-latest
            platform: windows
            arch: x86_64
            binary_name: wims-watcher.exe

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        working-directory: ./wims-watcher
        run: |
          pip install -r requirements.txt
          pip install pyinstaller

      - name: Build with PyInstaller
        working-directory: ./wims-watcher
        run: pyinstaller wims-watcher.spec

      - name: Package binary
        run: |
          cd wims-watcher/dist
          tar -czf wims-watcher-${{ matrix.platform }}-${{ matrix.arch }}.tar.gz wims-watcher*

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: wims-watcher-${{ matrix.platform }}-${{ matrix.arch }}
          path: wims-watcher/dist/*.tar.gz

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: ./artifacts

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: artifacts/**/*.tar.gz
          generate_release_notes: true
```

#### Installation Scripts

**Linux/macOS Installer:**

```bash
#!/bin/bash
# install.sh - Downloaded by users

set -e

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" = "x86_64" ]; then
    ARCH="x86_64"
elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    ARCH="arm64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

RELEASE_URL="https://github.com/{owner}/where-is-my-shit/releases/latest/download/wims-watcher-${PLATFORM}-${ARCH}.tar.gz"

echo "Downloading wims-watcher for ${PLATFORM}-${ARCH}..."
curl -L "$RELEASE_URL" | tar -xz

echo "Installing to ~/.local/bin/wims-watcher..."
mkdir -p ~/.local/bin
mv wims-watcher ~/.local/bin/
chmod +x ~/.local/bin/wims-watcher

# Add to PATH if not already
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
fi

echo "✓ wims-watcher installed successfully!"
echo "Run 'wims-watcher' to start (may need to restart shell for PATH)"
```

**Windows Installer (PowerShell):**

```powershell
# install.ps1

$Platform = "windows"
$Arch = "x86_64"
$ReleaseUrl = "https://github.com/{owner}/where-is-my-shit/releases/latest/download/wims-watcher-$Platform-$Arch.tar.gz"

Write-Host "Downloading wims-watcher..."
Invoke-WebRequest -Uri $ReleaseUrl -OutFile "wims-watcher.tar.gz"

# Extract (requires tar support in Windows 10+)
tar -xzf wims-watcher.tar.gz

# Install to Program Files
$InstallPath = "$env:ProgramFiles\WIMSWatcher"
New-Item -ItemType Directory -Force -Path $InstallPath
Move-Item -Force wims-watcher.exe $InstallPath

# Add to PATH
$Path = [Environment]::GetEnvironmentVariable("Path", "User")
if ($Path -notlike "*$InstallPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$Path;$InstallPath", "User")
}

Write-Host "✓ wims-watcher installed to $InstallPath"
Write-Host "Restart your terminal and run 'wims-watcher.exe'"
```

#### Binary Hosting Strategy

**Option A: GitHub Releases (Recommended)**

Pros:
- Free for public repos
- No infrastructure needed
- Built-in versioning
- Automated via GitHub Actions

Cons:
- 2GB per file limit (not an issue for ~50MB binaries)
- Must have GitHub account to download from web UI (API doesn't require auth)

**Option B: Self-Hosted (If GitHub limits hit)**

Use static file hosting:
- Cloudflare R2 (10GB free/month)
- AWS S3 + CloudFront
- DigitalOcean Spaces

Not needed initially. GitHub Releases sufficient for v1.

#### Platform-Specific Considerations

| Platform | Install Location | Daemon Setup | Notes |
|----------|------------------|--------------|-------|
| Linux | `~/.local/bin/wims-watcher` | systemd user service | PyInstaller requires glibc 2.17+ (Ubuntu 14.04+) |
| macOS | `/usr/local/bin/wims-watcher` | launchd plist | Must notarize for macOS 10.15+ (Gatekeeper) |
| Windows | `C:\Program Files\WIMSWatcher\wims-watcher.exe` | NSSM (Windows service wrapper) | May trigger SmartScreen (need code signing cert) |

**macOS Code Signing (Optional but Recommended):**

```bash
# Requires Apple Developer account ($99/year)
codesign --sign "Developer ID Application: Your Name" wims-watcher
xcrun notarytool submit wims-watcher.zip --apple-id ... --password ...
xcrun stapler staple wims-watcher
```

Without signing:
- Users must right-click → Open (first run)
- Or: System Preferences → Security & Privacy → Allow

**Windows Code Signing (Optional but Recommended):**

```bash
# Requires code signing certificate (~$200/year)
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com wims-watcher.exe
```

Without signing:
- Windows Defender SmartScreen warning
- Users must click "More info" → "Run anyway"

#### Integration Points

**Existing Components Modified:**
- **wims-watcher/src/main.py** - Ensure standalone mode works without dev dependencies
- **wims-watcher/requirements.txt** - Minimal runtime dependencies only

**New Components:**
- **wims-watcher/wims-watcher.spec** - PyInstaller spec file
- **.github/workflows/build-daemon.yml** - Build workflow
- **install.sh** - Linux/macOS installer
- **install.ps1** - Windows installer
- **docs/daemon-packaging.md** - Packaging documentation

**Build Flow:**
```
Developer creates tag: git tag daemon-v0.1.0 && git push --tags
  ↓
GitHub Actions matrix builds on: ubuntu-latest, macos-latest, windows-latest
  ↓
Each runner:
  1. pip install pyinstaller
  2. pyinstaller wims-watcher.spec
  3. tar -czf wims-watcher-{platform}-{arch}.tar.gz dist/wims-watcher*
  ↓
Upload artifacts to workflow
  ↓
Release job downloads all artifacts
  ↓
Creates GitHub Release with 3 binaries attached
  ↓
Users download with curl or GitHub web UI
  ↓
Run install script → extracts + moves to PATH
```

**Configuration Discovery:**

Standalone binary must find config without Python environment:

```python
# wims-watcher/src/config.py
import os
from pathlib import Path

def get_config_path():
    """
    Find config file in order of precedence:
    1. ~/.wims/server.json (standard location)
    2. /etc/wims/server.json (system-wide)
    3. ./config.json (local override)
    """
    search_paths = [
        Path.home() / ".wims" / "server.json",
        Path("/etc/wims/server.json"),
        Path("config.json"),
    ]

    for path in search_paths:
        if path.exists():
            return path

    raise FileNotFoundError("No WIMS config found. Run server setup first.")
```

**Confidence:** MEDIUM-HIGH
- PyInstaller is mature and widely used
- GitHub Actions matrix builds are standard
- Binary distribution via GitHub Releases well-documented
- Cross-platform builds tested in many projects
- Lower confidence on Windows/macOS signing (optional, costs money)

## Integration Summary

### New vs Modified Components

| Component | Type | Integration Point | Complexity |
|-----------|------|-------------------|------------|
| **Dockerfile** | Modified | Existing single-stage → Multi-stage with frontend build | Medium |
| **docker-compose.yml** | New | Orchestrates container with volumes | Low |
| **.github/workflows/publish-extension.yml** | New | Automated extension publishing | Medium |
| **.github/workflows/build-daemon.yml** | New | Cross-platform binary builds | Medium |
| **wims-watcher/wims-watcher.spec** | New | PyInstaller configuration | Low |
| **install.sh / install.ps1** | New | User installation scripts | Low |
| **src/app/core/config.py** | Modified | Support env var overrides for Docker | Low |
| **docs/** | New | Distribution documentation | Low |

### Data Flow Changes

**No changes to application data flow.** Distribution mechanisms are packaging/deployment wrappers.

**New flows added:**

1. **Docker data persistence flow:**
   ```
   LanceDB writes → /app/data/wims.lance (in container)
                 → Mounted to wims-data volume (on host)
                 → Persists across container restarts
   ```

2. **Extension update flow:**
   ```
   Developer pushes tag → GitHub Actions builds + publishes
                       → Chrome Web Store
                       → User's browser auto-updates (within 24h)
   ```

3. **Daemon distribution flow:**
   ```
   Developer pushes tag → GitHub Actions builds binaries
                       → GitHub Release created
                       → User downloads + runs install script
                       → Binary in PATH, config discovered
   ```

## Build Order and Dependencies

### Recommended Build Order

**Track 1: Docker (Highest Priority)**
- Most users want simplified deployment
- No Python/Node.js setup needed
- Self-contained with persistence

**Dependencies:** None
**Estimated Effort:** 6-8 hours
**Deliverables:**
1. Multi-stage Dockerfile
2. docker-compose.yml (dev + prod)
3. .dockerignore
4. docs/docker.md

**Track 2: Extension Publishing (Medium Priority)**
- Reduces friction for extension users
- Currently requires manual "load unpacked"

**Dependencies:**
- Chrome Web Store developer account
- OAuth credentials setup (one-time)

**Estimated Effort:** 4-6 hours
**Deliverables:**
1. .github/workflows/publish-extension.yml
2. scripts/generate-refresh-token.sh
3. docs/extension-publishing.md

**Track 3: Daemon Packaging (Lower Priority)**
- wims-watcher currently requires Python + pip install
- Standalone binary removes dependency

**Dependencies:** None
**Estimated Effort:** 8-10 hours
**Deliverables:**
1. wims-watcher/wims-watcher.spec
2. .github/workflows/build-daemon.yml
3. install.sh / install.ps1
4. docs/daemon-packaging.md

### Parallel vs Sequential

**Can be built in parallel:**
- All three tracks are independent
- No shared code changes (except minor config.py tweaks)

**Suggested order IF sequential:**
1. Docker (biggest user impact)
2. Extension publishing (easier, quick win)
3. Daemon packaging (most complex, optional)

### Deployment Strategy

Each distribution method is additive:

- **Existing method continues to work:** `git clone → ./setup.sh → ./start.sh`
- **Docker adds option:** `docker compose up -d`
- **Extension adds option:** Download from Chrome Web Store instead of manual load
- **Daemon adds option:** Download binary instead of pip install

**No breaking changes.** Users can mix methods:
- Run server via Docker
- Install extension from Chrome Web Store
- Run watcher via systemd (git clone method)

## Migration Concerns for Existing Users

### Database Compatibility

**Scenario:** User switches from git clone → Docker

**Issue:** Database at `./data/wims.lance` not accessible in container

**Solution:** Mount existing database directory

```yaml
# docker-compose.yml
volumes:
  - ./data:/data  # Use existing local data
  - ~/.wims:/root/.wims  # Use existing config
```

**Migration steps:**
1. Stop server: `Ctrl+C` in terminal
2. Run: `docker compose up -d`
3. Database path unchanged, container reads from host

**No data migration needed.** LanceDB files are portable.

### Config File Location

**Scenario:** User has config at `~/.wims/server.json`, switches to Docker

**Solution:** Mount config directory

```yaml
volumes:
  - ~/.wims:/root/.wims  # Config available in container
```

**Alternative:** Use environment variables

```yaml
environment:
  - API_KEY=sk-wims-xxxxx
  - DB_PATH=/data/wims.lance
```

### Extension Configuration

**Scenario:** Extension currently has manual load unpacked, user switches to Chrome Web Store install

**Issue:** Extension settings lost (stored in Chrome's storage API, tied to extension ID)

**Solution:** Extension ID remains same whether loaded unpacked or from Web Store

**Mitigation:** Document export/import settings feature in extension (future enhancement)

### Watcher Service

**Scenario:** User has systemd service installed via `./install.sh`, switches to standalone binary

**Issue:** Two watchers running (systemd + binary)

**Solution:** Uninstall systemd service first

```bash
systemctl --user stop wims-watcher
systemctl --user disable wims-watcher
rm ~/.config/systemd/user/wims-watcher.service
systemctl --user daemon-reload
```

**Then install standalone binary.**

## Performance and Resource Considerations

### Docker Resource Usage

| Component | Memory | CPU | Disk |
|-----------|--------|-----|------|
| Base image (python:3.12-slim) | 50MB | Minimal | 200MB |
| Embedding model (cached) | 100MB | Minimal | 500MB |
| LanceDB (1K conversations) | 50MB | Minimal | 100MB |
| FastAPI runtime | 200MB | 10-20% (idle) | N/A |
| **Total (idle)** | ~400MB | <1% | ~800MB |
| **Total (indexing)** | ~600MB | 50-100% | Growing |

**Recommendation:** Minimum 1GB RAM, 2GB recommended for comfortable operation.

### Binary Size

| Platform | Uncompressed | Compressed (tar.gz) |
|----------|-------------|---------------------|
| Linux x86_64 | ~50MB | ~15MB |
| macOS arm64 | ~55MB | ~17MB |
| Windows x86_64 | ~48MB | ~14MB |

PyInstaller bundles Python interpreter + dependencies. Size is acceptable for modern systems.

### Extension Size

| Component | Size |
|-----------|------|
| Webpack bundle (production) | ~500KB |
| Icons | ~50KB |
| Manifest | <1KB |
| **Total** | ~550KB |

Well within Chrome's 10MB limit. No performance concerns.

## Anti-Patterns to Avoid

### Docker Anti-Pattern 1: Running as Root

**What people do:**
```dockerfile
CMD ["uvicorn", "src.app.main:app"]
# Runs as root (UID 0)
```

**Why it's wrong:**
- Security risk if container compromised
- File permissions issues on bind mounts
- Against Docker best practices

**Do this instead:**
```dockerfile
RUN useradd -m -u 1000 wims
USER wims
CMD ["uvicorn", "src.app.main:app"]
```

### Docker Anti-Pattern 2: Not Using .dockerignore

**What people do:** `COPY . .` without .dockerignore

**Why it's wrong:**
- Copies node_modules, .venv, .git into build context
- Slow builds (100s of MB copied)
- Bloats image size

**Do this instead:**
```
# .dockerignore
node_modules
.venv
.git
__pycache__
*.pyc
.env
data/
```

### Docker Anti-Pattern 3: Putting Secrets in Image

**What people do:**
```dockerfile
ENV API_KEY=sk-wims-hardcoded-secret
```

**Why it's wrong:**
- Secret baked into image layers
- Anyone with image access sees secret
- Can't change without rebuilding

**Do this instead:**
```yaml
# docker-compose.yml
environment:
  - API_KEY=${API_KEY}  # From .env file or shell

# Or use Docker secrets
secrets:
  - api_key
```

### Extension Publishing Anti-Pattern: Hardcoding Version

**What people do:**
```json
// manifest.json
"version": "0.1.0"  // Manually update before each release
```

**Why it's wrong:**
- Easy to forget and publish wrong version
- Version in git doesn't match published version
- Manual step prone to errors

**Do this instead:** Use git tags as source of truth, update manifest in workflow

```yaml
- name: Update manifest version
  run: |
    VERSION=${GITHUB_REF#refs/tags/extension-v}
    jq '.version = "$VERSION"' manifest.json > manifest.tmp
```

### PyInstaller Anti-Pattern: Bundling Dev Dependencies

**What people do:**
```
pip install -r requirements-dev.txt
pyinstaller main.py  # Bundles pytest, black, etc.
```

**Why it's wrong:**
- Binary size bloated (100MB → 200MB)
- Slower startup (loading unused modules)
- Potential security issues (dev tools in prod binary)

**Do this instead:**
```
pip install -r requirements.txt  # Runtime deps only
pyinstaller main.py
```

## Sources

**Docker Multi-Stage Builds:**
- [Official Docker Multi-Stage Builds Documentation](https://docs.docker.com/build/building/multi-stage/) - HIGH confidence
- [Best practices for writing Dockerfiles](https://docs.docker.com/develop/dev-best-practices/) - HIGH confidence
- [FastAPI in Containers - Docker](https://fastapi.tiangolo.com/deployment/docker/) - HIGH confidence

**Chrome Web Store Publishing:**
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/using_webstore_api/) - HIGH confidence
- [chrome-webstore-upload-cli GitHub](https://github.com/fregante/chrome-webstore-upload-cli) - MEDIUM confidence (community tool)
- [Automating Chrome Extension Publishing with GitHub Actions](https://developer.chrome.com/docs/webstore/publish/) - MEDIUM confidence

**PyInstaller:**
- [PyInstaller Documentation](https://pyinstaller.org/en/stable/) - HIGH confidence
- [PyInstaller Spec Files](https://pyinstaller.org/en/stable/spec-files.html) - HIGH confidence
- [Cross-Platform Compilation with PyInstaller](https://pyinstaller.org/en/stable/usage.html#supporting-multiple-operating-systems) - HIGH confidence

**GitHub Actions:**
- [GitHub Actions: Building and Testing Python](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-python) - HIGH confidence
- [Creating Releases with GitHub Actions](https://docs.github.com/en/actions/releasing-packages) - HIGH confidence
- [Matrix Builds in GitHub Actions](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) - HIGH confidence

**LanceDB Persistence:**
- [LanceDB Storage Documentation](https://lancedb.github.io/lancedb/storage/) - HIGH confidence
- Based on existing Dockerfile analysis - HIGH confidence (already uses volume mounts)

---
*Architecture research for: WIMS Distribution & Packaging*
*Researched: 2026-02-18*
*Confidence: HIGH - All patterns are industry standard, existing codebase already demonstrates feasibility*
