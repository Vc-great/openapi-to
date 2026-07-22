# MCP Inspector launcher

Use the repository launcher for manual MCP review:

```sh
pnpm mcp:inspect
pnpm mcp:inspect -- --allow-write
```

The default is the safer read-only mode. `--allow-write` is an explicit operator
grant and starts a synthetic ten-Tool fixture. The launcher does not accept an
arbitrary Workspace, config, command, plugin, environment override, or remote
source. It builds the package, creates an OS-temporary synthetic Workspace,
chooses unused high localhost ports, writes only the trusted synthetic OpenAPI
config inside that temporary directory, and starts `@modelcontextprotocol/inspector` 0.22.0 in the
foreground. Inspector Proxy authentication remains enabled. The script never
sets `DANGEROUSLY_OMIT_AUTH`, never binds a public interface, and never uses
`nohup` or an orphaned background process.

The openapi-to runtime baseline remains Node.js 20. Inspector 0.22.0 separately
requires Node.js `>=22.7.5`; the launcher checks that exact minimum before
starting and prints an actionable message without changing package engines.
Use a compatible Node executable for the Inspector command while retaining Node
20 in CI and for the published MCP Server.

Run the launcher in a persistent foreground PTY. Keep that terminal open while
using the browser. Closing the PTY sends EOF/signals through the Inspector
process tree, so it is not equivalent to request cancellation. On SIGINT,
SIGTERM, or normal Inspector exit, the launcher forwards termination, waits for
the child, removes the temporary fixture/config, and releases its listeners.

## Manual checklist

In read-only configured mode, confirm exactly eight Tools: the three source
analysis Tools, target listing, operation search, bounded operation contract
reading, generation dry-run, and check. In write-enabled mode:

1. Confirm exactly ten Tools and the displayed Server name/version.
2. Review every Tool input/output schema and annotation.
3. Call Prepare and review added/modified/deleted counts.
4. Confirm Prepare made no Workspace or ownership-manifest change.
5. Apply the exact returned plan only after explicit review.
6. Confirm check reports `current`.
7. Prepare again and confirm the plan is unchanged.
8. Replay the used token and confirm `MCP_PLAN_ALREADY_USED`.
9. Review the prepared managed deletion before applying it.
10. Confirm the unmanaged synthetic file is byte-identical afterward.
11. Observe coarse progress without ordinary stdout text.
12. Inspect a structured stale/tamper/common-error result.

Do not copy plan, Proxy, or session tokens into validation documents. Record only
sanitized input/result summaries and normalized Workspace hashes.

## Authentication and health

The launcher prints the Inspector URLs emitted by Inspector itself but does not
persist credentials. A TCP listener plus an unauthenticated HTTP `401` is a
healthy authenticated Proxy, not a failure. `connection refused`, a disappeared
listener, or a reset before any Tool call is a lifecycle failure.

If the browser and launcher do not share the same localhost namespace, stop.
Use a same-host terminal, `tmux`/`screen`, or an approved private forwarding
mechanism. Never solve the mismatch by exposing the Proxy publicly or disabling
authentication.

## Cleanup and residual processes

Exit with Ctrl-C in the launcher terminal. Verify no Inspector or
`openapi-to-mcp` child remains and that the printed ports are free. If the
terminal was forcibly killed, inspect only processes started by that invocation
before terminating anything; do not kill unrelated Inspector sessions.

Inspector does not replace `pnpm test:mcp:recovery`. See
[MCP test strategy](./mcp-testing.md) for the exact automated/manual boundary and
[controlled-write Inspector evidence](../validation/mcp-controlled-write-inspector.md)
for the historical P3 acceptance record.
