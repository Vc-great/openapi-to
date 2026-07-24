---
"@openapi-to/core": patch
"@openapi-to/cli": patch
"@openapi-to/mcp": minor
"openapi-to": patch
---

Harden remote loading by clearing trusted request headers on cross-Origin
redirects and rejecting HTTPS-to-HTTP downgrades. Merge trusted Target remote
requirements with MCP operator ceilings instead of replacing them; the MCP
server API can now supply optional remote timeout, response-size, and redirect
upper bounds while Tool schemas remain unchanged.

Classify native Windows absolute inputs without treating drive letters as URL
schemes, reject drive-relative and UNC configured inputs, and require portable
output segments across Linux, macOS, and Windows. Extend cross-platform CI,
stable lint coverage, package-surface checks, and real tarball consumers for the
three aggregate binaries and shared MCP CLI subpath.
