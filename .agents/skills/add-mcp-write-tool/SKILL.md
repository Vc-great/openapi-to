---
name: add-mcp-write-tool
description: Extend or repair openapi-to's operator-gated MCP generation Prepare/Apply protocol, including plan binding, HMAC tokens, stale-state validation, transactional writing, locks, rollback, crash recovery, cancellation, stdio integration, Codex confirmation safety, and release coverage. Use for changes to openapi_prepare_generation, openapi_apply_generation, plan storage, or the shared transaction writer; never add another write Tool or broaden writable files without separately explicit user authorization.
---

# Add MCP controlled write capability

Use this Skill only for the existing two-stage controlled generation writer. Prefer extending `openapi_prepare_generation` and `openapi_apply_generation` over introducing another Tool. Unless the user separately and explicitly authorizes a broader write surface, never add a direct-write Tool, OpenAPI/config modification, caller-selected path/content/plugin, shell execution, business API execution, `force`, or stale-plan bypass.

Read root `AGENTS.md`, `packages/core/AGENTS.md`, `packages/mcp/AGENTS.md`, `docs/architecture/mcp-controlled-write.md`, and [the controlled-write checklist](references/controlled-write-checklist.md) before editing. Also read `.agents/skills/add-mcp-tool/SKILL.md` for protocol/schema/stdout requirements and `.agents/skills/release-monorepo/SKILL.md` when public packages change.

Follow `packages/mcp/AGENTS.md` for the permanent registration matrix,
Prepare/Apply authority, token/plan, stale-state, transaction, cancellation,
and recovery invariants. This Skill owns change mapping, test selection,
security evaluation, and stop/report decisions rather than restating those
module rules.

## Establish the boundary

Confirm a clean committed baseline and preserve user changes. Map the exact change across:

- `packages/mcp/src/tools/prepare-generation.ts` and `apply-generation.ts`;
- per-Server `generation/plan-store.ts` and `write-plan.ts`;
- Workspace/config/generation services and the generation queue;
- Core artifact comparison, transaction lock/writer/journal/recovery;
- CLI writes that must share the same output lock;
- official Client subprocess tests, Inspector/Codex safety evaluation, docs, Changeset, and package smoke.

Keep the registration matrix stable: three total Tools without config, eight total with trusted config, and ten total only with trusted config plus operator `allowWrite`. Tool arguments can never enable writes. Current transaction scope is one target/output root per plan; fail visibly on multi-target requests rather than partially applying them.

## Change-specific review

Trace the proposed change through the complete internal plan and the bounded
external review result. List every newly bound input, identity, hash,
precondition, limit, or lifecycle transition. For Apply, identify the exact
point at which the plan becomes consumed, the checks repeated under the shared
lock, and the rollback/recovery behavior for each newly reachable failure.

Review Tool descriptions and Codex evaluation cases whenever confirmation
semantics change. The Server proves plan continuity, not human identity:
ambiguous “generate/update/continue” requests must still Prepare or ask, never
Apply.

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
