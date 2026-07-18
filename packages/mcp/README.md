# @openapi-to/mcp

`@openapi-to/mcp` is the independent bounded stdio MCP adapter for `openapi-to`. Its five existing tools are read-only. An operator may additionally enable a two-phase, transaction-backed generation writer; it cannot write without a prior in-memory Prepare plan. Install it as a development dependency for a local Codex workflow, or as a regular dependency when a managed developer environment launches it at runtime.

```sh
pnpm add -D @openapi-to/mcp
openapi-to-mcp --workspace-root .
```

Without `--config`, the server exposes `openapi_validate`, `openapi_inspect`, and `openapi_diff`. Supplying a trusted Workspace-local project configuration adds `openapi_generate_dry_run` and `openapi_check_generation`:

```sh
openapi-to-mcp --workspace-root . --config ./.OpenAPI/openapi.config.ts
```

The configuration is executable trusted project code selected only by the server operator and cached for the server lifetime. Tool callers cannot replace it, change the Workspace, select plugins, or relax remote-network policy. Every local OpenAPI input and transitive local `$ref` is confined to the real Workspace. Dry-run/check execute plugins but never write generated files, ownership manifests, snapshots, or caches.

## Controlled generation writes

Writing is absent unless the operator supplies both trusted config and `--allow-write`:

```sh
openapi-to-mcp \
  --workspace-root . \
  --config ./.OpenAPI/openapi.config.ts \
  --allow-write
```

This registers `openapi_prepare_generation` and `openapi_apply_generation`, for seven tools total. Prepare executes generation and stores a short-lived complete plan binding config, sources and local `$ref` files, remote response hashes, Workspace/output identity, ownership manifest, planned files, artifact hashes, generator version, and one target. It does not create an output directory or write a file. Apply accepts only `planId`, `token`, and `approvedPlanHash`; it re-generates, revalidates every bound precondition, rejects drift, then commits through the shared Core lock/journal/rollback writer.

The default plan lifetime is five minutes, with at most 20 in-memory plans. Tokens use a per-process HMAC key, are one-time, and become invalid on Server restart. This release intentionally limits one plan to exactly one configured target/output root. There is no `force`, stale-plan override, dynamic config, caller-supplied path/content, or direct write tool.

The Server proves that Apply addresses the exact plan returned by Prepare. It cannot independently prove that a human performed confirmation; final approval depends on the MCP Host. Operators should require Host approval for `openapi_apply_generation`, especially when Prepare reports managed deletions.

Remote access is private-network-denied by default. Use repeatable `--allow-host` options to narrow allowed hosts. `--allow-private-network` is operator-only and lowers the security boundary.

The package intentionally does not provide HTTP transport, authentication, resources, prompts, sampling, elicitation, Tasks, Apps UI, LLM calls, background jobs, arbitrary writes, OpenAPI/config modification, or business API execution.

## Production controls

Every request has both Host-side and Server-side limits. The Server defaults are 30 seconds for validate/inspect, 45 seconds for diff, and 60 seconds for generation tools; an operator may set `--validate-timeout-ms`, `--inspect-timeout-ms`, `--diff-timeout-ms`, and `--generation-timeout-ms` from 100 through 600000 milliseconds. Tool arguments cannot extend them. These are separate from remote HTTP connection/response limits, the transaction commit deadline, and Codex `tool_timeout_sec`.

Controlled-write startup limits are `--plan-ttl-ms`, `--max-plans`, `--max-plan-bytes`, `--max-total-plan-bytes`, `--max-write-files`, `--max-write-bytes`, `--write-lock-wait-ms`, and `--commit-timeout-ms`. Tool arguments cannot relax them. Apply may be cancelled while waiting, regenerating, or staging. After commit starts, cancellation is deferred until the transaction finishes or rolls back; the independent commit deadline remains active.

MCP cancellation is propagated to remote fetch, reference loading, compiler checkpoints, plugin hooks through `ctx.signal`, artifact materialization/formatting/comparison, and the per-server generation queue. A cancelled or timed-out generation never calls the writer; queued cancellation does not strand the lock. Stable clients may request coarse progress for diff/dry-run/check. Progress is advisory, monotonic, content-free, and stops on cancellation.

Operational logs remain on stderr. `--log-format text|json` selects text or newline-delimited JSON and `--log-level debug|info|warn|error|silent` controls verbosity. Logs contain bounded counts and duration, never Tool arguments, documents, generated content, credentials, query strings, headers, environment variables, or config source.

See [controlled-write architecture](../../docs/architecture/mcp-controlled-write.md), [operations](../../docs/mcp-operations.md), [recovery](../../docs/mcp-write-recovery.md), [threat model](../../docs/mcp-threat-model.md), and [limitations](../../docs/mcp-limitations.md).
