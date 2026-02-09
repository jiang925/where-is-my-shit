#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Where Is My Shit (WIMS) Setup ===${NC}"

# 1. Check for uv and install if missing
if ! command -v uv &> /dev/null; then
    echo -e "${BLUE}Installing uv...${NC}"
    curl -LsSf https://astral.sh/uv/install.sh | sh

    # Add to path for current session if needed (generic approach)
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    fi
else
    echo -e "${GREEN}uv is already installed.${NC}"
fi

# 2. Sync dependencies
echo -e "${BLUE}Syncing dependencies...${NC}"
uv sync

# 3. Pre-download embedding models
echo -e "${BLUE}Pre-downloading embedding models to prevent first-request timeouts...${NC}"
uv run python -c "from fastembed import TextEmbedding; print('Downloading BAAI/bge-small-en-v1.5...'); TextEmbedding(model_name='BAAI/bge-small-en-v1.5'); print('Model ready.')"

echo -e "${GREEN}Setup complete! You can now run ./start.sh${NC}"
