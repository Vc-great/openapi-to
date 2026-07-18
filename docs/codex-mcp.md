# Use openapi-to MCP with Codex

Codex reads MCP servers from `config.toml`; a trusted project may use `.codex/config.toml`. Current official fields for a local stdio server are `command`, `args`, `env`/`env_vars`, `cwd`, `startup_timeout_sec`, and `tool_timeout_sec`. Do not commit a machine-specific absolute path.

## Repository development mode

Build first with `pnpm --filter @openapi-to/mcp build`, then add this to the trusted project's `.codex/config.toml`:

```toml
[mcp_servers.openapi_to]
command = "node"
args = ["packages/mcp/bin/openapi-to-mcp.js", "--workspace-root", "."]
cwd = "."
startup_timeout_sec = 10
tool_timeout_sec = 60
```

`tool_timeout_sec` is the Codex-side deadline. The Server also enforces its own per-tool deadlines; configure them only in `args`, for example `"--validate-timeout-ms", "30000", "--generation-timeout-ms", "60000"`. Codex cancellation is propagated to the active compiler/generator call and queued generation. The Server remains usable after cancellation.

To enable generation preview/check, add the startup-fixed trusted config argument:

```toml
args = ["packages/mcp/bin/openapi-to-mcp.js", "--workspace-root", ".", "--config", ".OpenAPI/openapi.config.ts"]
```

## Installed package mode

After installing `@openapi-to/mcp`, use its bin:

```toml
[mcp_servers.openapi_to]
command = "openapi-to-mcp"
args = ["--workspace-root", "."]
cwd = "."
startup_timeout_sec = 10
tool_timeout_sec = 60
```

Restart Codex after configuration changes. Use `/mcp` in the Codex terminal UI or the MCP servers settings page in the desktop app/IDE extension to confirm the server and tools. A server without config shows three tools; a server with config shows five. Failures expose bounded structured diagnostics that identify compilation, Workspace, remote policy, config, plugin, stale generation, or result-limit conditions.

The examples follow the current [official Codex MCP documentation](https://developers.openai.com/codex/mcp/). Project configuration is loaded only for trusted projects.
