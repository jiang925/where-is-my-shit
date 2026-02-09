#!/bin/bash
set -e

echo "Starting Where Is My Shit (WIMS)..."
echo "Press Ctrl+C to stop."

# Run the application using uv
# This ensures we use the correct virtual environment and dependencies
uv run uvicorn src.app.main:app --host 0.0.0.0 --port 8000 --reload
