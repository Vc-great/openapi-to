# MCP operations guide

`@openapi-to/mcp` requires Node.js 20 or newer and uses stdio only. Install with `pnpm add -D @openapi-to/mcp`, then launch `openapi-to-mcp --workspace-root .`. Without config it registers validate, inspect, and first-stage diff. Adding operator-trusted `--config .OpenAPI/openapi.config.ts` also registers generation dry-run and check.

The Workspace is canonicalized once. Local entries, transitive `$ref`, config imports, output roots, ownership manifests, and checked generated files must remain inside it. Remote loading denies private/reserved networks by default; only the operator may add `--allow-host` or the security-lowering `--allow-private-network`.

Server deadlines are configured in milliseconds with `--validate-timeout-ms`, `--inspect-timeout-ms`, `--diff-timeout-ms`, and `--generation-timeout-ms`. Values must be integers from 100 to 600000. Client cancellation and Server timeout are distinct (`MCP_REQUEST_CANCELLED` versus `MCP_TOOL_TIMEOUT`); remote HTTP timeout is a third limit. Cancellation propagates through compiler, plugins, artifacts, comparison, and queue waits.

Results are deterministic and bounded by diagnostics, operations/changes, artifacts, text, and preview limits. Totals remain accurate when arrays are truncated. Dry-run defaults to no preview; binary bodies are never returned. Check reports `outdated` as an expected business result with `isError: true`, not a protocol failure. Neither generation tool invokes the writer or changes ownership manifests.

Use `--log-format json --log-level warn` for newline-delimited operational stderr logs. stdout is exclusively MCP JSON-RPC. The package includes separate `benchmark`, `benchmark:check`, `stress`, and `evaluate:tools` scripts; they are development gates and are not packed.

The versioned baseline corpus has 1-operation small dialect fixtures, a 150-operation/81-schema medium document, a 700-operation/301-schema multi-file large document, a bounded 600-operation pathological document, and a 250-artifact generation fixture. On the recorded five-run reference host, p95 was 557 ms for startup, 31 ms for tools/list, 52/28/37 ms for validate/inspect/diff, and 59/48 ms for dry-run/check; maximum structured output was 77,814 bytes and approximate peak RSS was 355,123,200 bytes. Thresholds intentionally allow order-of-magnitude platform variance.
