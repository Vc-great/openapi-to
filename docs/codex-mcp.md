# Use openapi-to MCP with Codex

Codex reads MCP servers from `config.toml`; a trusted project may use `.codex/config.toml`. Current official fields for a local stdio server include `command`, `args`, `env`/`env_vars`, `cwd`, `startup_timeout_sec`, and `tool_timeout_sec`. This project requires Node.js 20 or newer. Do not commit a machine-specific absolute path.

The examples follow the current official [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp). Project configuration is loaded only for trusted projects.

## Repository development mode

Run `pnpm install` and `pnpm build`, then add this to the trusted project's `.codex/config.toml`:

```toml
[mcp_servers.openapi_to]
command = "node"
args = ["packages/mcp/bin/openapi-to-mcp.js", "--workspace-root", "."]
cwd = "."
startup_timeout_sec = 10
tool_timeout_sec = 60
```

Native Windows uses the same Node entrypoint with a Windows path:

```toml
[mcp_servers.openapi_to]
command = "node.exe"
args = ["packages\\mcp\\bin\\openapi-to-mcp.js", "--workspace-root", "."]
cwd = "."
startup_timeout_sec = 10
tool_timeout_sec = 60
```

`tool_timeout_sec` is the Codex-side deadline. The Server also enforces its own per-tool deadlines; configure them only in `args`, for example `"--validate-timeout-ms", "30000", "--generation-timeout-ms", "60000"`. Codex cancellation is propagated to the active compiler/generator call and queued generation. The Server remains usable after cancellation.

To enable generation preview/check, add the startup-fixed trusted config argument:

```toml
args = ["packages/mcp/bin/openapi-to-mcp.js", "--workspace-root", ".", "--config", ".OpenAPI/openapi.config.ts"]
```

To expose controlled writes, the Server operator must additionally add `--allow-write`:

```toml
[mcp_servers.openapi_to]
command = "node"
args = ["packages/mcp/bin/openapi-to-mcp.js", "--workspace-root", ".", "--config", ".OpenAPI/openapi.config.ts", "--allow-write"]
cwd = "."
startup_timeout_sec = 10
tool_timeout_sec = 120
default_tools_approval_mode = "writes"

[mcp_servers.openapi_to.tools.openapi_apply_generation]
approval_mode = "prompt"
```

This produces ten tools: the three no-config analysis tools, five trusted-config read-only tools, and Prepare/Apply. Codex should call `openapi_prepare_generation` first, tell the user the added/modified/deleted summary and exact plan hash, and wait. It may call `openapi_apply_generation` only after the user explicitly approves that one unexpired plan. “Generate”, “update”, “continue”, a freshness check, or a preview request is not sufficient confirmation. When more than one plan is in context, Codex must ask which hash; it must never guess. A stale/expired rejection requires a new Prepare and a new confirmation, not an automatic Prepare-then-Apply chain.

When adding discovered operations to persistent project intent, Codex may pass `selection: { type: "add", operationKeys: [...] }` to Prepare. It should compare the returned previous/requested/new/already-selected/desired summaries, projection counts, change summary, and exact plan hash. Prepare writes neither selection nor generated output, but a successful selective plan has `applySupported: true` and a one-time token. Codex must still show the plan and wait for explicit approval before calling Apply. Apply accepts only the returned plan ID, token, and exact approved hash; it cannot accept or infer a path, config, source, plugin, content, or changed operation set. Omit `selection` for the existing full Prepare/Apply workflow.

`--allow-write` is an operator capability grant, not proof of human approval. The Server cryptographically binds Apply to the Prepare result but relies on Codex/Host Tool approval for the final interaction boundary. Review managed deletions carefully. There is no force, dynamic target/path/content override, OpenAPI edit, or arbitrary file write.

## Installed package mode

Install the package in the Workspace:

```sh
pnpm add -D @openapi-to/mcp
```

Then launch its bin through the Workspace package manager:

```toml
[mcp_servers.openapi_to]
command = "pnpm"
args = ["exec", "openapi-to-mcp", "--workspace-root", "."]
cwd = "."
startup_timeout_sec = 10
tool_timeout_sec = 60
```

Native Windows:

```toml
[mcp_servers.openapi_to]
command = "cmd.exe"
args = ["/d", "/s", "/c", "pnpm exec openapi-to-mcp --workspace-root ."]
cwd = "."
startup_timeout_sec = 10
tool_timeout_sec = 60
```

Restart Codex after configuration or OpenAPI target changes. Use `/mcp` in the Codex terminal UI or the MCP servers settings page in the desktop app/IDE extension to confirm the server and tools. A server without config shows three tools; a server with config shows eight; config plus `--allow-write` shows ten. Failures expose bounded structured diagnostics that identify compilation, Workspace, remote policy, config, plugin, stale generation, plan/token, transaction/recovery, or result-limit conditions.

## Doctor, Inspector, and common failures

Repository maintainers can run `pnpm mcp:check` for a non-interactive built-bin health report and `pnpm mcp:inspect` for foreground manual review. Those helpers are intentionally absent from the npm package.

See [getting started](./getting-started.md), [troubleshooting](./troubleshooting.md), and the shared [MCP security boundary](./mcp-security.md). The server is local stdio only. stdout is MCP JSON-RPC; operational logs use stderr. It does not provide HTTP, OAuth, multi-tenancy, LLM calls, or a chat UI.
