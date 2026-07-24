---
"@openapi-to/mcp": minor
"openapi-to": minor
---

Make `openapi-to` the complete user installation entrypoint. The aggregate now
depends on the MCP runtime and installs the `openapi-to-mcp` command alongside
the `openapi` and `openapi-to` CLI aliases, so most users no longer need to
install `@openapi-to/mcp` separately.

Expose the shared MCP CLI runner through the stable `@openapi-to/mcp/cli`
subpath so both package bins use one argument parser and stdio Server startup
implementation.
