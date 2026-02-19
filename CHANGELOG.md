# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses Calendar Versioning (CalVer) with YYYY.MM.DD format.

## [Unreleased]

### Added
- TBD

## [2026.02.19.2] - 2026-02-19

### Fixed
- Playwright browsers installation in release workflow
- uv.lock regenerated with public PyPI (removed CodeArtifact URLs)
- Dockerfile model download using sentence-transformers (not fastembed)
- Simplified Docker to single image without model pre-download (fixes CI disk space)

## [2026.02.19] - 2026-02-19

### Added
- Version management foundation with CHANGELOG and Docker OCI labels
- CalVer-based versioning system (YYYY.MM.DD format)
- Automated release workflow with version synchronization
- Docker multi-platform images (AMD64, ARM64)
- Docker image variants: full (pre-downloaded models) and slim (runtime download)
- GitHub Container Registry publishing
- docker-compose.yml deployment template

## [2026.02.18] - 2026-02-18

### Added
- AI-powered search engine for chat messages across platforms
- FastAPI backend with RESTful API
- LanceDB vector database for efficient similarity search
- Multiple embedding model support (fastembed, sentence-transformers, ONNX, OpenAI, Ollama)
- BGE-M3 default model (1024d multilingual embeddings)
- JWT-based authentication with token refresh
- API key-based authentication for CLI tools
- Platform support for Claude, ChatGPT, Cursor, and generic platforms
- Browser extension for Chrome/Edge/Firefox
- Real-time hot reload support for configuration changes
- Comprehensive test suite with pytest
- Docker containerization with optimized caching
- English and Chinese bilingual documentation
- Project setup with uv package manager
- GNU AGPLv3 license

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Removed
- N/A (initial release)
