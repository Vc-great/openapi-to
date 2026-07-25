---
"@openapi-to/mcp": patch
---

Use the native realpath representation for the trusted MCP Workspace so Windows
temporary paths remain Workspace-relative across config loading, generation
results, and cross-platform stdio smoke tests.
