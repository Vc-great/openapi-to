---
name: add-mcp-write-tool
description: Extend or repair openapi-to's operator-gated MCP generation Prepare/Apply protocol, including plan binding, HMAC tokens, stale-state validation, transactional writing, locks, rollback, crash recovery, cancellation, stdio integration, Codex confirmation safety, and release coverage. Use for changes to openapi_prepare_generation, openapi_apply_generation, plan storage, or the shared transaction writer; never add another write Tool or broaden writable files without separately explicit user authorization.
---

# Add MCP controlled write capability

Use this Skill only for the existing two-stage controlled generation writer. Prefer extending `openapi_prepare_generation` and `openapi_apply_generation` over introducing another Tool. Unless the user separately and explicitly authorizes a broader write surface, never add a direct-write Tool, OpenAPI/config modification, caller-selected path/content/plugin, shell execution, business API execution, `force`, or stale-plan bypass.

Read root `AGENTS.md`, `packages/core/AGENTS.md`, `packages/mcp/AGENTS.md`, `docs/architecture/mcp-controlled-write.md`, and [the controlled-write checklist](references/controlled-write-checklist.md) before editing. Also read `.agents/skills/add-mcp-tool/SKILL.md` for protocol/schema/stdout requirements and `.agents/skills/release-monorepo/SKILL.md` when public packages change.

## Establish the boundary

Confirm a clean committed baseline and preserve user changes. Map the exact change across:

- `packages/mcp/src/tools/prepare-generation.ts` and `apply-generation.ts`;
- per-Server `generation/plan-store.ts` and `write-plan.ts`;
- Workspace/config/generation services and the generation queue;
- Core artifact comparison, transaction lock/writer/journal/recovery;
- CLI writes that must share the same output lock;
- official Client subprocess tests, Inspector/Codex safety evaluation, docs, Changeset, and package smoke.

Keep the registration matrix stable: three total Tools without config, eight total with trusted config, and ten total only with trusted config plus operator `allowWrite`. Tool arguments can never enable writes. Current transaction scope is one target/output root per plan; fail visibly on multi-target requests rather than partially applying them.

## Preserve Prepare semantics

Prepare runs the complete compiler/plugin/artifact comparison pipeline but creates no Workspace file, output directory, lock, staging area, journal, or ownership manifest. Bind the internal full plan to Server, Workspace, trusted config and config sources, selected target, local and remote inputs, every local `$ref`, output-root identity, ownership manifest, every affected file's before state, generator/plugin identity, and complete artifact hashes.

The external result is a bounded, deterministic review summary. Make deletions conspicuous. Truncating external changes must never truncate the internal applicable plan. Preview stays off by default, text-only, and bounded; never return binary bodies or full generated trees.

Use a per-Server random HMAC key and constant-time verification. Plans remain in bounded per-instance memory with TTL, maximum count/bytes, deterministic eviction, once-only consumption, restart invalidation, and cleanup on close. Never store or log the HMAC secret or full token.

## Preserve Apply semantics

Apply accepts only `planId`, `token`, and `approvedPlanHash`. It cannot accept targets, change lists, output roots, content, deletes, config, plugins, `force`, skip-validation, or safety-policy overrides.

Under the per-Server generation queue and shared filesystem lock:

1. Verify existence, TTL, unused state, exact hash, and token.
2. Revalidate Server/Workspace/config/source/reference/output/manifest/file identities and hashes.
3. Re-run full deterministic generation and require exact artifact/plan equality.
4. Require added paths still absent and modified/deleted paths unchanged.
5. Delete only regular, unlinked files present in both ownership manifest and exact prepared deletion plan.
6. Commit through Core's transaction writer; never implement a second MCP-only writer.
7. Consume or invalidate the plan according to the documented phase and never auto-replan into a write.

The Server proves plan continuity, not human identity. Tool descriptions and Codex evaluation must require explicit confirmation of the exact reviewed plan, and Host approval remains the final boundary. Ambiguous “generate/update/continue” requests must Prepare or ask, never Apply.

## Transaction and cancellation rules

Stage and hash all new bytes on the output filesystem before commit. Journal only bounded relative paths and hashes, back up old managed files and manifest, atomically rename where the platform supports it, switch the stable ownership manifest with the files, and clean only transaction-owned paths. Any failure after commit begins must fully roll back or return a high-severity recovery-required result; do not report success after partial restoration.

CLI generation and MCP Apply share the same cross-process output lock. Validate lock/root identities and still recheck hashes under lock. Never trust PID, lock record, or journal checksum as the only authorization/integrity proof.

Before commit, cancellation cleans staging/releases locks and must not strand the queue. After commit starts, defer cancellation until commit or rollback completes and retain the independent bounded commit deadline. A timed-out commit rolls back. Server restart or Apply must detect and safely recover phase journals; unsafe/tampered recovery fails closed.

## Required validation

Use test-only internal failpoints, never public Tool arguments. Cover every staging/backup/rename/delete/manifest/cleanup point and compare the full pre/post output byte state, not only exit codes. Use a real subprocess SIGKILL for crash recovery. Cover lock/journal symlinks and tampering, hard links where supported, root replacement, token tamper/replay/expiry/cross-Server, all stale-plan inputs, waiting cancellation, commit cancellation, two Servers, and actual CLI/MCP contention.

Use the official stable SDK Client and stdio transport against the built binary for Prepare, Apply, disk verification, replay, invalid input, timeout/cancellation, stderr redaction, and stdout purity. Register the coverage under the package-owned write/recovery test layers, update repository Doctor, and keep the named Node 20/cross-platform CI jobs current. Check current Inspector help before user-visible smoke; Inspector never replaces internal failpoint, SIGKILL, journal, lock, or commit-critical cancellation tests. Run real Codex safety cases when policy permits and require zero Apply calls without explicit confirmation, no plan guessing/replay, and deletion disclosure.

Then run `pnpm test:mcp:write`, `pnpm test:mcp:recovery`, `pnpm test:mcp:all`, MCP Doctor, affected Core/MCP/CLI tests/typechecks/builds, formal second-run generation check, root Vitest/typecheck/build, changed-file lint, release scripts, package surface, tarball install/write smoke, and Changeset status. Inspect the MCP tarball for repository test/Doctor/Inspector scripts, fixtures, journals, failpoints, tokens, benchmarks, logs, local config, or machine paths. Never publish, commit, push, or tag without explicit authorization.

## Stop conditions

Stop and report rather than weakening controls if:

- a write can occur without Prepare, operator grant, exact token/hash, or revalidation;
- a stale plan can be forced, silently re-planned, or applied to new output;
- an unmanaged/changed/symlinked/linked file could be overwritten or deleted;
- rollback or recovery cannot prove a consistent file-plus-manifest state;
- CLI and MCP can concurrently write one root;
- cancellation can leave half-commit state or a stranded lock;
- stdout contains non-protocol output or logs expose a token/content;
- the requested feature needs another write Tool or a broader write target without separate explicit user authorization.
