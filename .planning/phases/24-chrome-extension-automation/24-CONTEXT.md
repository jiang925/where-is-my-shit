# Phase 24: Chrome Extension Automation - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-publish WIMS Chrome extension to Chrome Web Store on version tags. Includes privacy policy page setup, OAuth configuration, and automated upload pipeline integrated with Phase 22's version management workflow.

</domain>

<decisions>
## Implementation Decisions

### Initial Web Store Submission
- **Manual first submission:** Create listing manually via Chrome Web Store Developer Dashboard
- **Category:** Developer Tools
- **Initial visibility:** Unlisted (safer for initial release, can make public later)
- **Claude's Discretion:** Minimal compliance for listing (screenshots, description per Web Store requirements)

### Privacy Policy Page
- **Hosting:** GitHub Pages (jiang925.github.io/wims/privacy or similar)
- **Content level:** Simple and clear - what data we collect (none), plain English
- **Language:** English only (Web Store standard, simpler than bilingual)
- **Contact:** GitHub Issues link for privacy questions

### Update Automation
- **Publish frequency:** Every CalVer tag triggers extension publish (unified versioning)
- **Beta channel:** No beta testing channel for v1.7 (keep simple)
- **Review process:** Standard Chrome Web Store review (~24 hours for updates)
- **Claude's Discretion:** Rollback strategy (manual via Web Store is acceptable)

### Version Synchronization
- **Timing:** Reuse Phase 22's version-sync job (manifest.json already updated there)
- **Credentials:** GitHub Secrets for Chrome Web Store API tokens
- **Validation:** Build extension zip and validate manifest.json schema before publishing
- **Build failure:** Fail workflow immediately (quality gate, requires fix and re-tag)

</decisions>

<specifics>
## Specific Ideas

- Leverage existing version-sync job from Phase 22 - already handles manifest.json
- GitHub Pages simple static HTML page for privacy policy
- Start unlisted, make public after initial validation period

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-chrome-extension-automation*
*Context gathered: 2026-02-20*
