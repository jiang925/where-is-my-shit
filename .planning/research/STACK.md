# Technology Stack

**Project:** Where Is My Shit (WIMS)
**Researched:** 2026-02-07

## Recommended Stack

### Local Server (The Core)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Python** | 3.12+ | Runtime | Best ecosystem for LLM/Embedding libs. Easy LanceDB integration. |
| **FastAPI** | 0.109+ | Web Server | Fast, async, auto-generated Swagger docs. |
| **LanceDB** | 0.5+ | Vector Store | Serverless, embedded, stores data in files (local-first). |
| **SQLite** | 3.x | Metadata DB | Robust, simple, everywhere. |

### Security & Authentication
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **passlib[bcrypt]** | ^1.7.4 | Password Hashing | Industry standard for secure password storage. Required by FastAPI security utils. |
| **python-jose** | ^3.3.0 | JWT Handling | Standard for encoding/decoding JWTs. `[cryptography]` extra ensures speed and security. |
| **python-multipart** | ^0.0.9 | Form Parsing | Required for FastAPI's `OAuth2PasswordRequestForm`. |

### Browser Extension (Frontend)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **React** | 19.x | UI Framework | Component-based UI. Already in use. |
| **Vite** | 7.x | Bundler | Fast builds, configured for CRX. |
| **Tailwind** | 4.x | Styling | Utility-first CSS. Already in use. |

### Testing & Quality
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **pytest** | ^8.3.0 | Backend Test Runner | De facto standard for Python. Powerful fixtures system. |
| **pytest-asyncio** | ^0.25.0 | Async Support | Essential for testing FastAPI async endpoints. |
| **httpx** | ^0.28.0 | Test Client | Modern async HTTP client. Replaces `requests` for async tests. |
| **ruff** | ^0.9.0 | Linting/Formatting | Replaces Flake8/Black/Isort. Extremely fast (~100x faster). |
| **vitest** | ^4.0.0 | Frontend Test Runner | Native Vite integration. Shared config with app. |
| **@testing-library** | ^16.0.0 | Component Testing | Standard for behavior-driven React component testing. |
| **jsdom** | ^28.0.0 | Browser Environment | Required for simulating DOM in Node.js environment. |

### Infrastructure & CI/CD
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **GitHub Actions** | N/A | CI/CD | Integrated with repo. Free tier sufficient for public open source. |
| **Poetry** | Latest | Python Pkg Mgmt | Better dependency resolution than pip. |

## CI/CD Pipeline Configuration

### 1. Backend Quality Gate
- **Trigger:** Push/PR to `main`
- **Steps:**
  1. `actions/checkout`
  2. `actions/setup-python` (3.12)
  3. Install dependencies (`poetry install`)
  4. Lint (`ruff check .`)
  5. Test (`pytest`)

### 2. Frontend Quality Gate
- **Trigger:** Push/PR to `main`
- **Steps:**
  1. `actions/checkout`
  2. `actions/setup-node` (v22 LTS)
  3. Install dependencies (`npm ci`)
  4. Lint (`npm run lint`)
  5. Test (`npm run test`)

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **Auth** | **python-jose** | **PyJWT** | `python-jose` has broader encryption support out of the box, though PyJWT is also solid. Sticking to FastAPI defaults. |
| **Auth** | **Self-hosted** | **Auth0/Clerk** | This is a local-first app. External auth providers introduce unnecessary cloud dependency and latency. |
| **FE Testing** | **Vitest** | **Jest** | Jest requires separate config and transformation layers (ts-jest). Vitest reuses Vite config, reducing maintenance. |
| **Linter** | **Ruff** | **Flake8+Black** | Ruff is significantly faster and simplifies the toolchain (one tool vs many). |

## Sources
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Vitest Guide](https://vitest.dev/guide/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
