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
