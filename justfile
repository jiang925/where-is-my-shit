# WIMS - Where Is My Shit
# Task runner for development

# Default: show available commands
default:
    @just --list

# Run all tests (backend + frontend)
test-all: test-backend test-frontend

# Run backend tests
test-backend:
    uv run pytest --tb=short

# Run backend tests with coverage
test-backend-cov:
    uv run pytest --cov=src --cov-report=term-missing

# Run frontend tests
test-frontend:
    cd ui && npm test -- --run

# Run frontend tests with coverage
test-frontend-cov:
    cd ui && npx vitest --coverage --run

# Run all lints
lint-all: lint-backend lint-frontend

# Lint backend
lint-backend:
    uv run ruff check src/ tests/

# Lint frontend (extension)
lint-frontend:
    cd extension && npx eslint src/

# Format backend code
fmt:
    uv run ruff format src/ tests/

# Run E2E tests
e2e:
    npx playwright test

# Run E2E tests in headed mode
e2e-headed:
    npx playwright test --headed

# Start dev server
dev:
    uv run uvicorn src.app.main:app --reload --host 0.0.0.0 --port 8000

# Start frontend dev server
dev-ui:
    cd ui && npm run dev

# Build frontend
build-ui:
    cd ui && npm run build

# Build extension
build-ext:
    cd extension && npm run build

# CI check (all tests + lint)
ci: lint-backend test-backend test-frontend
