# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2026.x  | :white_check_mark: |
| < 2026  | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in WIMS, please report it by opening an issue at:

**https://github.com/jiang925/where-is-my-shit/issues**

For sensitive security issues that should not be disclosed publicly, please email the maintainer directly (email available in commit history or GitHub profile).

### What to Include

Please include the following in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Initial response:** Within 48 hours
- **Status update:** Within 7 days
- **Fix timeline:** Depends on severity (critical issues prioritized)

## Security Best Practices for Users

WIMS is designed for local, self-hosted use. To maintain security:

1. **API Key Protection:** Keep your `~/.wims/server.json` file secure (contains API key)
2. **Local Binding:** Server binds to localhost by default - only expose if needed
3. **HTTPS:** Use HTTPS if exposing server over network
4. **Updates:** Keep WIMS updated to latest version for security patches
5. **Extension Permissions:** Review extension permissions - only grants access to supported AI platforms

## Known Security Considerations

- **Local Storage:** All conversation data stored locally in `~/.wims/*.lance` - secure your disk encryption
- **API Key Auth:** Simple API key authentication suitable for local/personal use, not for multi-tenant production
- **No Cloud Sync:** By design - all data stays on your machine

---

For general questions and feature requests, use GitHub Issues or Discussions.
