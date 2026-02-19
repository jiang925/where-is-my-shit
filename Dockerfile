FROM python:3.12-slim

# Build arguments for version metadata
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Add .venv to PATH
ENV PATH="/app/.venv/bin:$PATH"

# NOTE: Models (bge-m3, ~2GB) download automatically on first run
# Pre-downloading in Docker image causes disk space issues in CI (~14GB runner limit)
# Runtime download is acceptable for self-hosted tool

# Copy application code
COPY src ./src

# Create directory for data
RUN mkdir -p data

# Expose port
EXPOSE 8000

# OCI image metadata labels
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="https://github.com/tianjiang/where-is-my-shit" \
      org.opencontainers.image.title="Where Is My Shit" \
      org.opencontainers.image.description="AI-powered search for chat messages across platforms"

# Run the application
CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
