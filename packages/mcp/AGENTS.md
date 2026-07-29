# MCP agent guide

This file extends the root `AGENTS.md` for `packages/mcp/`. The current package
uses the production-stable `@modelcontextprotocol/sdk` over stdio only.

## Protocol and adapter boundary

stdin/stdout carry MCP JSON-RPC only. Operational logs and plugin incidental
console output go to bounded, sanitized stderr. Do not replace
`process.stdout.write`, install concurrent per-call console restore logic, or
hand-code protocol versions.

Handlers call public Core APIs directly. Never spawn the CLI, parse CLI output,
call the MCP server recursively, or add a generator plugin as an adapter.

Every Tool keeps a stable name, title, limitation-aware description, bounded
input/output schemas, truthful stable annotations, one short text summary, and
non-duplicated JSON-safe `structuredContent` conforming to `outputSchema`.
Expected compilation, Workspace, policy, config, plugin, stale-plan, and result
limit failures return `isError: true`; protocol errors are for unknown Tools,
invalid schema input, lifecycle, and unrecoverable SDK/protocol failures.

Results must use stable priority ordering before truncation, retain
total/returned/omitted counts, and emit `MCP_RESULT_TRUNCATED` when bounded.
Never return a complete document or generated tree by default, binary Base64,
raw errors, stacks, absolute machine paths, config source, environment, tokens,
headers, cookies, credentials, or URL queries.

## Startup authority and Tool matrix

Workspace, config, remote policy, deadlines, limits, output roots, and write
permission are startup authority. Tool arguments cannot choose executable
config/plugins/code/shell/environment, expand Workspace/output scope, or relax
network/private-address policy. Startup `configPath` is operator-authorized
project code and is cached for the server lifetime.

Re-check `src/server.ts` and `src/tools/index.ts` when registration changes. The
current total Tool matrix is:

| Startup mode | Tools |
| --- | ---: |
| no config | 3 analysis Tools |
| trusted config | 8 read-only Tools |
| trusted config plus operator `allowWrite` | 10 Tools |

The five config-gated read-only Tools list/search/read trusted operations and
dry-run/check configured generation. Dry-run and check may execute plugins and
read managed output but never write, repair, format user files, clean, or update
ownership.

Analysis calls use call-local state. Generation is serialized through one
`GenerationLock` per Server instance and released in `finally`; never introduce
a module-global cross-Server lock.

## Cancellation and deadlines

Use the SDK handler's call-local AbortSignal, combine it with validated
startup-owned deadlines, and propagate it through remote loading, compiler
checkpoints, plugin Hooks, artifact work, generation queues, and lock waits.
Distinguish client cancellation, server deadline, and HTTP timeout. Remove
timers/listeners on all exits and prove active or queued cancellation cannot
strand the generation lock. Standard progress is optional, coarse,
monotonic/content-free, and sent only with a client-supplied token.

Preserve fail-closed TOCTOU checks around source, config, reference, output, and
manifest reads. Use opened handles or revalidation where practical; do not
claim races are completely eliminated or return `current` after inconsistency.

## Controlled Prepare/Apply writes

Write Tools exist only with startup-trusted config plus operator `allowWrite`.
Tool arguments cannot grant or broaden that authority. Keep exactly the
existing `openapi_prepare_generation` and `openapi_apply_generation` pair; no
direct-write shortcut or additional write Tool.

Prepare runs the full deterministic generation/comparison pipeline and creates
no Workspace/output file, directory, selection state, lock, staging area,
journal, cache, or ownership manifest. Its external summary may be truncated,
but its internal plan is complete. Bind plans to one Server, Workspace,
trusted config/target, all input/reference/remote hashes, output/manifest/file
state, selection/projection when applicable, generator/plugin identity, and all
artifact hashes.

Plans use per-Server memory, a random HMAC key, bounded count/bytes, TTL,
deterministic cleanup, restart invalidation, constant-time verification, and
one-time consumption. Never persist or log the key, full token, or generated
content.

Apply accepts only `planId`, `token`, and `approvedPlanHash`. It cannot accept
targets, paths, content, deletes, config, plugins, force, stale overrides,
validation bypasses, or safety policy. Under the per-Server queue and shared
Core output lock, Apply revalidates every bound precondition, re-runs
generation, requires exact plan equality, rejects appeared/changed targets, and
deletes only unchanged regular files in both ownership and the approved plan.
It never silently re-plans.

All commits use Core's transaction writer and output lock. Files, ownership
manifest, and controlled selection state commit or roll back together. Before
commit, cancellation cleans staging and releases locks without stranding the
queue. After commit starts, defer cancellation until commit/rollback completes
under the independent commit deadline. Unsafe/tampered locks or journals,
incomplete recovery, root replacement, symlinks, and detected stale state fail
closed.

## Test layers

Choose the maintained package/root script matching the change:

- `test:unit` — schemas, limits, sanitization, options, plan store, and focused
  helpers.
- `test:integration` — in-process and subprocess service interactions.
- `test:stdio` — official SDK Client plus real built-bin protocol/stdout
  integrity.
- `test:write` — Prepare/Apply plan and disk behavior.
- `test:recovery` — transaction, lock, rollback, cancellation, failpoints,
  SIGKILL, journal, and recovery.
- `test:performance` — bounded benchmark/stress.
- `test:e2e` and `test:all` — maintained aggregate gates.
- Doctor (`pnpm mcp:check`) — built-bin matrix, schemas, annotations, results,
  cleanup, and sanitized report.

A declared group must fail for missing files or zero collected tests. Tool
registration/schema changes update stdio E2E and Doctor. Controlled-write
changes update write E2E; transaction/cancellation/lock/crash/recovery changes
also run recovery.

Use Inspector only for user-visible discovery, schema, annotation, and result
inspection. It does not replace automated failpoint, SIGKILL, journal, lock, or
commit-critical cancellation tests. Do not add a production Tool argument,
environment switch, public failpoint, or packed test helper to simplify tests.

Do not add Streamable HTTP, auth, Resources, Prompts, Sampling, Elicitation,
Apps UI, Tasks, background jobs, LLM/chat calls, or another write Tool as
incidental MCP work. Use `.agents/skills/add-mcp-tool/SKILL.md` for read-only
Tools and `.agents/skills/add-mcp-write-tool/SKILL.md` for Prepare/Apply work.
