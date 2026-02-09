#!/bin/bash
set -e

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="wims-watcher.service"
USER_SYSTEMD_DIR="$HOME/.config/systemd/user"

echo "Installing WIMS Watcher..."

# 1. Install Dependencies
# We assume dependencies are installed via:
# python3 -m pip install --user --break-system-packages -r requirements.txt
# python3 -m pip install --user --break-system-packages -r wims-watcher/requirements.txt
# Skipping automatic install in script to avoid environment issues seen previously,
# but validating imports work.

echo "Verifying dependencies..."
if ! python3 -c "import watchdog, requests" 2>/dev/null; then
    echo "Error: Python dependencies (watchdog, requests) not found."
    echo "Please run: pip install --user -r requirements.txt"
    exit 1
fi

# 2. Install Service File
echo "Installing systemd service..."
mkdir -p "$USER_SYSTEMD_DIR"
cp "$PROJECT_ROOT/$SERVICE_FILE" "$USER_SYSTEMD_DIR/$SERVICE_FILE"

# 3. Reload and Enable
echo "Reloading systemd..."
systemctl --user daemon-reload
echo "Enabling and starting service..."
systemctl --user enable "$SERVICE_FILE"
systemctl --user restart "$SERVICE_FILE"

echo "Installation complete. Status:"
systemctl --user status "$SERVICE_FILE" --no-pager
