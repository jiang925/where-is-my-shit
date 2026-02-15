# Phase 21: Documentation for GitHub Release - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Write user-facing documentation so the project can be published on GitHub as an open-source tool. Covers README (EN + CN), setup instructions, configuration reference, and supporting docs/ files. No new features or code changes — documentation only.

</domain>

<decisions>
## Implementation Decisions

### Audience & Positioning
- Primary audience: technical but not necessarily developers (sysadmins, data folks, AI enthusiasts)
- They can follow instructions but need clear steps, not "figure it out from the code"
- Problem-first pitch: "Ever lost an AI conversation? WIMS captures and indexes all your AI chats so you can find them instantly."

### Bilingual Structure
- Separate files: README.md (English) + README_CN.md (Chinese)
- Link between them at the top of each file
- Both follow the same structure and section order

### README Structure & Tone
- Tone: practical and direct — "install this, run that, here's what happens" — no personality or marketing fluff
- Target length: 400-600 lines (medium, self-contained)
- Standard badge row at top (license, Python version, CI status)
- Top-level sections:
  1. Badges + one-liner pitch
  2. Features list (bullet points of key capabilities)
  3. How it works (brief architecture explanation — text only, no diagrams)
  4. Quick start (clone + one script to get running)
  5. Setup details (server, extension, watcher — all in README)
  6. Configuration (annotated server.json example)
  7. CLI commands (brief mention, link to docs/ for full reference)
  8. License
- NO screenshots, NO diagrams, NO contributing guide (for v1)
- NO architecture overview doc (add later if contributors show up)

### Reference Style (from ~/open-source examples)
- Emulate sub2api and claude-relay-service README style:
  - Clear section headers with obvious navigation
  - Quick-start at the very top
  - Config examples with inline comments showing real values
  - Concise, no fluff — gets to the point

### Setup Instructions
- Quick start: clone + `./setup.sh && ./start.sh` — one-liner to get running
- All three components (server, extension, watcher) documented in README
- Extension setup: brief mention + link to Chrome docs for "load unpacked extension"
- License: not decided yet — will determine during the phase

### Claude's Discretion
- Prerequisites to document (Python version, uv, Node.js, OS support)
- Exact wording of feature bullets
- How to organize the config section within the 400-600 line target
- Level of detail for watcher setup

### Configuration Reference
- Annotated example file style (complete server.json with inline comments)
- All embedding providers documented (sentence-transformers, fastembed, onnx, openai, ollama)
- CLI commands: brief mention in README, full reference in docs/ folder

### docs/ Folder Contents
- Full CLI reference (reembed, promote, flags, examples)
- Detailed embedding provider configuration guide
- Any other content that would bloat the README beyond 600 lines

</decisions>

<specifics>
## Specific Ideas

- Sub2api pattern: badges centered at top, `English | [中文](README_CN.md)` language toggle, features as bullet list with bold labels
- Claude-relay-service pattern: clear section separation with `---` dividers
- Server.json config should show a complete working example, not fragments — user can copy-paste and modify
- Each embedding provider should have its own config snippet showing required and optional fields

</specifics>

<deferred>
## Deferred Ideas

- Contributing guide — add when/if contributors show up
- Architecture documentation — not needed for v1
- Screenshots/demo GIF — skip for now, text-only docs
- Docker deployment — could be a future phase
- GitHub Wiki — not using, docs/ folder instead

</deferred>

---

*Phase: 21-documentation-github-release*
*Context gathered: 2026-02-15*
