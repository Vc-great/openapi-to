---
"@openapi-to/mcp": minor
"@openapi-to/core": minor
"@openapi-to/cli": patch
---

Add the independent read-only stdio MCP server with bounded validate, inspect,
diff, generation dry-run, and generation check Tools. Core gains opt-in local
file-root confinement for entry and transitive reference reads plus the shared
trusted configuration loader; the CLI now reuses that loader without changing
its command contract.
