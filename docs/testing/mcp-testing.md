# MCP test strategy

The MCP package has a repository-owned test surface. Maintainers should use the
root commands below instead of relying on the full-repository Vitest run or the
release smoke to discover MCP regressions indirectly.

| Command | Purpose | Expected scope |
| --- | --- | --- |
| `pnpm test:mcp:unit` | Pure and filesystem-bounded contracts | schemas/options, results, diagnostics, limits, tokens, plan storage, paths, config caching, and logging |
| `pnpm test:mcp:integration` | Server/application integration | registration, structured results, errors, concurrency, cancellation, timeouts, and generation serialization |
| `pnpm test:mcp:smoke` | Minimal cross-platform stdio smoke | initialize, list, validate/config matrix, stdout/stderr, and clean close |
| `pnpm test:mcp:stdio` | Real built-bin protocol E2E | official SDK `Client` plus `StdioClientTransport`, 3/8/10 tool matrices, schemas, annotations, calls, lifecycle, stdout, and stderr |
| `pnpm test:mcp:write` | Controlled-write E2E | Prepare read-only behavior, Apply, stale/tampered/replayed plans, managed deletion, unmanaged preservation, and current state |
| `pnpm test:mcp:recovery` | Destructive-failure safety | rollback failpoints, cancellation phases, SIGKILL recovery, journals, and CLI/MCP or multi-Server locking |
| `pnpm test:mcp:e2e` | MCP process and transaction E2E | stdio, controlled write, and Core transaction recovery evidence |
| `pnpm test:mcp:performance` | Bounded performance gates | multi-run benchmark regression plus bounded repetition/concurrency stress |
| `pnpm test:mcp:all` | Complete maintained MCP gate | all unique unit/integration/E2E/recovery tests plus the bounded performance gate |

`pnpm test:mcp` remains the package-only compatibility entry and now runs the
120-test MCP inventory. The package manifest is authoritative; root scripts only
route to it. The test-group
runner uses repository-relative explicit files, checks every file exists, and
does not use `--passWithNoTests`, so a stale group cannot silently pass with zero
tests. Groups intentionally share some evidence when run separately. The `all`
entry runs the unique union rather than multiplying identical files.

## Inventory after B2b

| Test file | Tests | Primary evidence | Real stdio / official SDK | Temporary Workspace | Controlled write | Recovery or cancellation | Observed package-run time |
| --- | ---: | --- | --- | --- | --- | --- | ---: |
| `packages/mcp/src/options.test.ts` | 17 | Unit | no | no | option authority | timeout bounds | 4 ms |
| `packages/mcp/src/logger.test.ts` | 2 | Unit | no | no | audit redaction | no | 10 ms |
| `packages/mcp/src/generation/generation-lock.test.ts` | 3 | Unit | no | no | queue isolation | cancelled waiter | 13 ms |
| `packages/mcp/src/generation/plan-store.test.ts` | 3 | Unit | no | no | HMAC, TTL, replay, LRU | cross-Server token rejection | 31 ms |
| `packages/mcp/src/generation/trusted-config.test.ts` | 2 | Unit | no | yes | config availability/cache | no | 108 ms |
| `packages/mcp/src/result.test.ts` | 2 | Unit | no | no | bounded result protocol | no | 3 ms |
| `packages/mcp/src/security/workspace.test.ts` | 3 | Unit/security | no | yes | output confinement | symlink escape | 14 ms |
| `packages/mcp/src/tools/limits.test.ts` | 4 | Unit/service | no | no | artifact/preview bounds | cancellation/listener cleanup | 58 ms |
| `packages/mcp/src/tools/schema.test.ts` | 11 | Unit/schema | no | no | all ten bounded input/output schemas, additive selection only | authority-field rejection | under 10 ms |
| `packages/mcp/src/catalog/trusted-target-registry.test.ts` | 3 | Unit/cache | no | yes | trusted target compilation/catalog cache plus fresh Apply compilation | concurrent first load, retry, target isolation | platform-dependent |
| `packages/mcp/src/generation/selection-state.test.ts` | 21 | Unit/service | no | yes | manifest, bootstrap, plan/token binding, direct selective Apply | symlink/hard-link/size/drift, three-state rollback, retry | platform-dependent |
| `packages/mcp/src/server.integration.test.ts` | 4 | stdio integration | yes | yes | read-only generation and catalog | queue/cache failure recovery | platform-dependent |
| `packages/mcp/src/lifecycle.integration.test.ts` | 3 | stdio lifecycle | child process (no SDK calls) | no | no | EOF, SIGINT, SIGTERM | 1.4 s |
| `packages/mcp/src/hardening.integration.test.ts` | 6 | stdio hardening | yes | yes | dry-run/check | active/queued cancel, timeout, disconnect | 7.2 s |
| `packages/mcp/src/controlled-write.integration.test.ts` | 36 | controlled-write stdio | yes | yes | full plus controlled Selective Prepare/Apply, no-op/replay, incremental selection | selection/source/ref/output/ownership/artifact drift, expiry, cancellation and locks | platform-dependent |
| `packages/core/src/artifacts/transaction.test.ts` | 19 | writer recovery | subprocess for SIGKILL case | yes | shared transaction writer | failpoints, rollback, crash, journal, lock | platform-dependent |
| `packages/core/src/artifacts/generation-state-transaction.test.ts` | 34 | state writer recovery | subprocess for SIGKILL cases | yes | artifacts + ownership + controlled state | journal v2, output/ownership/state failpoints, rollback, committed cleanup, first-create and crash recovery | platform-dependent; cross-device case conditional |

Before B2b, the 15 MCP files contained 103 tests. The current inventory contains
120 MCP tests: 71 unit/service/schema tests and 49 real-process integration tests.
The complete unique gate adds 53 Core transaction tests for 173 tests total. The root Vitest configuration already discovered the original tests, and
the Quality workflow already ran them indirectly. Before P3.5, however, the E2E
workflow had no named MCP job and the package used a single permissive
`--passWithNoTests` command. Release smoke separately packed and installed the
MCP package and exercised stdio plus Prepare/Apply/replay/current; it was useful
release evidence, not a discoverable development test taxonomy.

## What to run

Before an ordinary MCP change, run the affected layer and then
`pnpm test:mcp:all`. A Tool schema or registration change must run `stdio` and
`pnpm mcp:check`. A Prepare/Apply, lock, writer, cancellation, or recovery change
must run `write` and `recovery`. Run `pnpm mcp:inspect` when user-visible Tool
metadata, approval semantics, progress, summaries, or interactive flows change.

Before release, also run package typecheck/build, the root Vitest/typecheck/build
matrix, changed-file lint, package-surface verification, pack-install smoke, and
Changesets status. `pnpm release:smoke` is the packed-consumer proof; it is not a
substitute for the source-tree E2E and recovery gates.

## CI responsibilities

Quality retains the full-repository Vitest suite. The E2E workflow adds named
Node 22 jobs so MCP status is visible on the CI page:

- **MCP stdio E2E** runs the built binary, controlled-write E2E, and Doctor;
- **MCP cross-platform smoke** runs on Linux, Windows, and macOS;
- **MCP transaction safety** proves rollback, cancellation, crash recovery, and
  lock behavior on Linux, including journal v2 state recovery and the cross-device fail-closed case;
- **MCP performance and bounded stress** runs on `main`, the weekly schedule,
  and manual dispatch, not on every pull request.

Doctor JSON is the only uploaded MCP report. It is sanitized and contains no
plan token, generated body, fixture path, or Inspector credential.

For a machine-readable stdout stream, use
`pnpm --silent mcp:check -- --json`; the `--silent` flag suppresses pnpm's own
lifecycle banner while Doctor routes dependency-build logs to stderr. CI uses
`--json --output <path>`, which writes a single stable JSON document regardless
of console presentation.

## Inspector versus automated safety

Inspector is a manual interaction surface. It verifies Tool discovery, schemas,
annotations, readable structured results, ordinary Prepare/Apply/replay/tamper/
stale behavior, managed deletion, unmanaged preservation, progress, and common
errors. It must not receive a failpoint, crash, cancellation, or force Tool.

Internal failpoint rollback, byte-identical restoration, pre-commit and
commit-critical cancellation, SIGKILL recovery, journal recovery, and lock
competition belong to the automated Safety Gate. Those cases require exact
synchronization or process control that Inspector 0.22.0 does not reliably
expose. A passing SDK/Core test is complementary evidence, not a fabricated
Inspector UI result.

## Diagnosing stdio pollution

The server's stdout is exclusively JSON-RPC. Official SDK subprocess tests and
Doctor fail if protocol parsing breaks. Plugin `console` output and operational
logs must appear only on stderr. When debugging, capture stderr separately; do
not merge it into stdout and do not infer Tool results from logs.
