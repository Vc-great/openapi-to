---
"@openapi-to/core": major
"@openapi-to/cli": major
"@openapi-to/plugin-msw": major
"@openapi-to/plugin-swr": major
"@openapi-to/plugin-ts-request": major
"@openapi-to/plugin-ts-type": major
"@openapi-to/plugin-vue-query": major
"@openapi-to/plugin-zod": major
"openapi-to": major
---

Freeze the P0 compiler and P1 Codex governance baseline. This release adds the
OpenAPI compiler pipeline, structured diagnostics, general generated artifacts,
validation, inspection, contract diffing, deterministic dry-run/check modes,
safe remote loading, and the expanded CLI surface.

The major bump records compatibility-sensitive behavior changes: private-network
remote sources are blocked by default, conflicting artifact paths fail instead of
depending on write order, managed output cleanup is manifest-aware, and CLI
failures now return classified non-zero exit codes.
