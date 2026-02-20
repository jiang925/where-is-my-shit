#!/bin/bash
set -e

# WIMS Watcher Installer
# One-liner: curl -sSL https://raw.githubusercontent.com/jiang925/wims/main/install-watcher.sh | bash

INSTALL_DIR="$HOME/.local/bin/wims-watcher"
CONFIG_DIR="$HOME/.wims"
GITHUB_API="https://api.github.com/repos/jiang925/wims/releases/latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

echo "WIMS Watcher Installer"
echo "======================"
echo ""

# Check Python
echo "→ Checking prerequisites..."
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 is required but not found."
    echo "Please install Python 3.11 or later: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
    log_error "Python 3.11+ is required (found: $PYTHON_VERSION)"
    echo "Please upgrade Python: https://www.python.org/downloads/"
    exit 1
fi

log_info "Python $PYTHON_VERSION found"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macos"
    log_info "Detected macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS_TYPE="linux"
    log_info "Detected Linux"
else
    log_error "Unsupported OS: $OSTYPE"
    echo "Only Linux and macOS are supported."
    exit 1
fi

# Check if installation exists
if [ -d "$INSTALL_DIR" ]; then
    log_warn "Existing installation found at $INSTALL_DIR"
    echo "This will update your installation in place."
    read -p "Continue? (y/n) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    UPDATING=true
else
    UPDATING=false
fi

# Check/install uv
echo ""
echo "→ Checking uv package manager..."
if ! command -v uv &> /dev/null; then
    echo "uv is not installed. uv is used to manage Python dependencies."
    read -p "Install uv now? (y/n) " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing uv..."
        curl -LsSf https://astral.sh/uv/install.sh | sh

        # Source the shell config to get uv in PATH
        if [ -f "$HOME/.cargo/env" ]; then
            source "$HOME/.cargo/env"
        fi

        # Verify installation
        if ! command -v uv &> /dev/null; then
            log_error "uv installation failed or not in PATH"
            echo "Please add uv to your PATH and run this script again."
            echo "Try: source ~/.cargo/env"
            exit 1
        fi
        log_info "uv installed successfully"
    else
        log_error "uv is required to install dependencies."
        echo "Install manually: curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi
else
    log_info "uv found"
fi

# Backup config if updating
CONFIG_BACKUP=""
if [ "$UPDATING" = true ] && [ -f "$CONFIG_DIR/server.json" ]; then
    echo ""
    echo "→ Backing up config..."
    CONFIG_BACKUP=$(cat "$CONFIG_DIR/server.json")
    log_info "Config backed up"
fi

# Download latest release
echo ""
echo "→ Downloading latest release..."
RELEASE_DATA=$(curl -sSL "$GITHUB_API")
LATEST_VERSION=$(echo "$RELEASE_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['tag_name'])")

if [ -z "$LATEST_VERSION" ]; then
    log_error "Could not fetch latest version from GitHub"
    echo "Check your internet connection or try again later."
    exit 1
fi

echo "Latest version: $LATEST_VERSION"

# Find watcher tarball URL
TARBALL_URL=$(echo "$RELEASE_DATA" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for asset in data.get('assets', []):
    if 'watcher' in asset['name'] and asset['name'].endswith('.tar.gz'):
        print(asset['browser_download_url'])
        break
")

if [ -z "$TARBALL_URL" ]; then
    log_error "Could not find watcher tarball in release"
    echo "Please report this issue: https://github.com/jiang925/wims/issues"
    exit 1
fi

# Download and extract
TEMP_DIR=$(mktemp -d)
TARBALL_PATH="$TEMP_DIR/wims-watcher.tar.gz"

echo "Downloading from $TARBALL_URL..."
if ! curl -sSL -o "$TARBALL_PATH" "$TARBALL_URL"; then
    log_error "Download failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi

log_info "Download complete"

echo "→ Extracting..."
tar -xzf "$TARBALL_PATH" -C "$TEMP_DIR"

# Find extracted directory
EXTRACTED_DIR="$TEMP_DIR/wims-watcher"
if [ ! -d "$EXTRACTED_DIR" ]; then
    # Try subdirectory
    SUBDIR=$(find "$TEMP_DIR" -type d -name "wims-watcher" | head -1)
    if [ -n "$SUBDIR" ]; then
        EXTRACTED_DIR="$SUBDIR"
    else
        log_error "Could not find wims-watcher directory in tarball"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
fi

# Install to target directory
echo "→ Installing to $INSTALL_DIR..."
mkdir -p "$(dirname "$INSTALL_DIR")"

if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
fi

mv "$EXTRACTED_DIR" "$INSTALL_DIR"
log_info "Installed to $INSTALL_DIR"

# Install dependencies with uv
echo ""
echo "→ Installing dependencies with uv..."
cd "$INSTALL_DIR"

if ! uv venv; then
    log_error "Failed to create virtual environment"
    exit 1
fi

if ! uv pip install -r requirements.txt; then
    log_error "Failed to install dependencies"
    exit 1
fi

log_info "Dependencies installed"

# Restore config if it was backed up
if [ -n "$CONFIG_BACKUP" ]; then
    echo ""
    echo "→ Restoring config..."
    mkdir -p "$CONFIG_DIR"
    echo "$CONFIG_BACKUP" > "$CONFIG_DIR/server.json"
    log_info "Config restored"
fi

# Setup service
echo ""
echo "→ Setting up service..."

if [ "$OS_TYPE" = "linux" ]; then
    # systemd service
    SERVICE_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SERVICE_DIR"

    cp "$INSTALL_DIR/templates/wims-watcher.service.template" "$SERVICE_DIR/wims-watcher.service"

    systemctl --user daemon-reload
    systemctl --user enable wims-watcher.service
    systemctl --user restart wims-watcher.service

    log_info "systemd service configured and started"

    # Check service status
    if systemctl --user is-active --quiet wims-watcher.service; then
        log_info "Service is running"
    else
        log_warn "Service may not have started correctly"
        echo "Check status: systemctl --user status wims-watcher.service"
    fi

elif [ "$OS_TYPE" = "macos" ]; then
    # launchd service
    PLIST_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$PLIST_DIR"

    PLIST_FILE="$PLIST_DIR/com.wims.watcher.plist"

    # Replace HOMEDIR placeholder with actual home directory
    sed "s|HOMEDIR|$HOME|g" "$INSTALL_DIR/templates/com.wims.watcher.plist.template" > "$PLIST_FILE"

    # Unload if already loaded
    launchctl bootout "gui/$(id -u)/com.wims.watcher" 2>/dev/null || true

    # Load service
    launchctl bootstrap "gui/$(id -u)" "$PLIST_FILE"
    launchctl kickstart -k "gui/$(id -u)/com.wims.watcher"

    log_info "launchd service configured and started"

    # Give service a moment to start
    sleep 2

    # Check if process is running
    if launchctl print "gui/$(id -u)/com.wims.watcher" &>/dev/null; then
        log_info "Service is running"
    else
        log_warn "Service may not have started correctly"
        echo "Check logs: tail -f ~/.wims/watcher.log"
    fi
fi

# Install uninstall script
cp "$INSTALL_DIR/templates/uninstall.sh.template" "$INSTALL_DIR/uninstall.sh"
chmod +x "$INSTALL_DIR/uninstall.sh"

# Install wims-watcher command wrapper
WRAPPER_BIN="$HOME/.local/bin/wims-watcher"
cp "$INSTALL_DIR/templates/wims-watcher.template" "$WRAPPER_BIN"
chmod +x "$WRAPPER_BIN"

# Ensure ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    log_warn "~/.local/bin is not in your PATH"
    echo "Add this to your ~/.bashrc, ~/.zshrc, or ~/.profile:"
    echo '  export PATH="$HOME/.local/bin:$PATH"'
    echo ""
fi

# Write version file
mkdir -p "$CONFIG_DIR"
echo "$LATEST_VERSION" > "$CONFIG_DIR/.watcher-version"

# Cleanup
rm -rf "$TEMP_DIR"

# Final message
echo ""
echo "======================================"
log_info "Installation complete!"
echo "======================================"
echo ""
echo "Version: $LATEST_VERSION"
echo "Location: $INSTALL_DIR"
echo "Logs: $CONFIG_DIR/watcher.log"
echo ""
echo "Commands:"
echo "  Update:    wims-watcher update"
echo "  Uninstall: bash $INSTALL_DIR/uninstall.sh"
echo ""
echo "Check logs: tail -f $CONFIG_DIR/watcher.log"
echo ""

if [ "$OS_TYPE" = "linux" ]; then
    echo "Service status: systemctl --user status wims-watcher.service"
elif [ "$OS_TYPE" = "macos" ]; then
    echo "Service status: launchctl print gui/$(id -u)/com.wims.watcher"
fi

echo ""
