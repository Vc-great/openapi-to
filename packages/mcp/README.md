# @openapi-to/mcp

`@openapi-to/mcp` is the independent, read-only stdio MCP adapter for `openapi-to`. Install it as a development dependency when the server is only part of a local Codex workflow, or as a regular dependency when your application or managed developer environment launches the server at runtime.

```sh
pnpm add -D @openapi-to/mcp
openapi-to-mcp --workspace-root .
```

Without `--config`, the server exposes `openapi_validate`, `openapi_inspect`, and `openapi_diff`. Supplying a trusted Workspace-local project configuration adds `openapi_generate_dry_run` and `openapi_check_generation`:

```sh
openapi-to-mcp --workspace-root . --config ./.OpenAPI/openapi.config.ts
```

The configuration is executable trusted project code selected only by the server operator and cached for the server lifetime. Tool callers cannot replace it, change the Workspace, select plugins, or relax remote-network policy. Every local OpenAPI input and transitive local `$ref` is confined to the real Workspace. Generation tools execute plugins but never write generated files, ownership manifests, snapshots, or caches.

Remote access is private-network-denied by default. Use repeatable `--allow-host` options to narrow allowed hosts. `--allow-private-network` is operator-only and lowers the security boundary.

The package intentionally does not provide HTTP transport, authentication, resources, prompts, sampling, elicitation, Apps UI, LLM calls, background tasks, or write tools.

## Production controls

Every request has both Host-side and Server-side limits. The Server defaults are 30 seconds for validate/inspect, 45 seconds for diff, and 60 seconds for dry-run/check; an operator may set `--validate-timeout-ms`, `--inspect-timeout-ms`, `--diff-timeout-ms`, and `--generation-timeout-ms` from 100 through 600000 milliseconds. Tool arguments cannot extend them. These are separate from remote HTTP connection/response limits and Codex `tool_timeout_sec`.

MCP cancellation is propagated to remote fetch, reference loading, compiler checkpoints, plugin hooks through `ctx.signal`, artifact materialization/formatting/comparison, and the per-server generation queue. A cancelled or timed-out generation never calls the writer; queued cancellation does not strand the lock. Stable clients may request coarse progress for diff/dry-run/check. Progress is advisory, monotonic, content-free, and stops on cancellation.

Operational logs remain on stderr. `--log-format text|json` selects text or newline-delimited JSON and `--log-level debug|info|warn|error|silent` controls verbosity. Logs contain bounded counts and duration, never Tool arguments, documents, generated content, credentials, query strings, headers, environment variables, or config source.

See [operations](../../docs/mcp-operations.md), [threat model](../../docs/mcp-threat-model.md), and [limitations](../../docs/mcp-limitations.md).
