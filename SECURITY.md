# Security

## Reporting a Vulnerability

If you discover a security vulnerability in DocDrop, **please do not open a public GitHub issue.**

Instead, report it privately by:
- Opening a [GitHub Security Advisory](https://github.com/token-hoarder/docdrop/security/advisories/new)
- Or emailing the maintainer directly (see GitHub profile)

Please include:
- A description of the vulnerability
- Steps to reproduce it
- Any relevant file paths or configuration details

You can expect an acknowledgement within 48 hours.

## Scope

DocDrop runs entirely locally — it does not transmit files or data to any external server. The main attack surface is:
- File parsing (malformed or malicious input files)
- Local network exposure of the FastAPI server (bound to `127.0.0.1` by default)
