# MCP operations guide

`@openapi-to/mcp` requires Node.js 20 or newer and uses stdio only. Install with `pnpm add -D @openapi-to/mcp`, then launch `openapi-to-mcp --workspace-root .`. Without config it registers validate, inspect, and first-stage diff. Adding operator-trusted `--config .OpenAPI/openapi.config.ts` also registers generation dry-run and check. Adding `--allow-write` registers Prepare and Apply only after all configured output roots pass Workspace validation.

The Workspace is canonicalized once. Local entries, transitive `$ref`, config imports, output roots, ownership manifests, and checked generated files must remain inside it. Remote loading denies private/reserved networks by default; only the operator may add `--allow-host` or the security-lowering `--allow-private-network`.

Server deadlines are configured in milliseconds with `--validate-timeout-ms`, `--inspect-timeout-ms`, `--diff-timeout-ms`, and `--generation-timeout-ms`. Values must be integers from 100 to 600000. Client cancellation and Server timeout are distinct (`MCP_REQUEST_CANCELLED` versus `MCP_TOOL_TIMEOUT`); remote HTTP timeout is a third limit. Cancellation propagates through compiler, plugins, artifacts, comparison, and queue waits.

Results are deterministic and bounded by diagnostics, operations/changes, artifacts, text, and preview limits. Totals remain accurate when arrays are truncated. Dry-run/Prepare default to no preview; binary bodies are never returned. Check reports `outdated` as an expected business result with `isError: true`, not a protocol failure. Dry-run/check never invoke the writer.

## Controlled-write runbook

Start with `--workspace-root`, trusted `--config`, and `--allow-write`. Optional startup-only controls are:

```text
--plan-ttl-ms 300000
--max-plans 20
--max-plan-bytes 4194304
--max-total-plan-bytes 33554432
--max-write-files 5000
--max-write-bytes 268435456
--write-lock-wait-ms 30000
--commit-timeout-ms 60000
```

Call Prepare for exactly one configured target. Review added/modified/deleted counts, every returned path, truncation, and the exact `planHash`; a truncated external list does not truncate the stored plan. Prepare must leave the output tree byte-identical. Only after explicit user approval should the Host pass the returned `planId`, token, and approved hash to Apply.

Apply re-generates and fails stale rather than adopting new content. It may delete only unchanged regular files listed in the current ownership manifest and prepared deletion set. User/unmanaged files survive. Success consumes the token and updates files plus the version-2 manifest; failure after commit begins rolls back or reports a recovery-required high-severity diagnostic. There is no force or retry-with-new-plan behavior.

Cancellation while queued, regenerating, or staging stops cleanly. Cancellation after commit starts is deferred until commit/rollback finishes. The commit deadline is separate from the MCP generation timeout. `openapi_check_generation` should report current after success.

CLI generate and MCP Apply use the same cross-process output lock. Check/dry-run do not take the exclusive lock; if a writer is active they fail safely instead of claiming a stable current result. See [recovery](./mcp-write-recovery.md) before handling any leftover transaction state.

Use `--log-format json --log-level warn` for newline-delimited operational stderr logs. stdout is exclusively MCP JSON-RPC. The package includes separate `benchmark`, `benchmark:check`, `stress`, and `evaluate:tools` scripts; they are development gates and are not packed.

The versioned baseline corpus has 1-operation small dialect fixtures, a 150-operation/81-schema medium document, a 700-operation/301-schema multi-file large document, a bounded 600-operation pathological document, and a 250-artifact generation fixture. The benchmark also creates an isolated temporary 250-file Workspace for repeated Prepare/Apply timing, staging/commit duration, plan bytes, structured output, and approximate RSS. Thresholds intentionally allow order-of-magnitude platform variance and never write benchmark output into the repository.
