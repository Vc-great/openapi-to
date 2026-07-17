---
name: release-monorepo
description: Prepare and verify an openapi-to monorepo release by identifying affected packages, classifying semver impact, checking workspace dependencies, exports, declarations, packed files, Changesets readiness, changelogs, tags, generated artifacts, and the pre-publish test matrix. Use for release planning or package publication readiness; default to preparation only and never publish, push, or create remote tags without explicit user authorization.
---

# Prepare a monorepo release

Read root `AGENTS.md` and [release-facts.md](references/release-facts.md), then re-verify every fact in current manifests and Git state. This Skill prepares evidence and a plan; it does not publish by default.

## Required inputs

Establish:

- Release target: one package, affected packages, or the full published set.
- Intended channel: stable, canary, alpha/beta/rc, or another explicitly configured prerelease.
- Comparison base/tag and included commits.
- Whether the user requests only a plan, local versioning, artifact packing, tagging, or actual publication.
- Registry/auth environment, only if publication was explicitly authorized.

If the base/tag is unknown, Changesets configuration is missing, the worktree includes unexplained release artifacts, or publication authority is absent, continue with read-only analysis but stop before versioning/tagging/publishing.

## Workflow

### 1. Establish a clean evidence boundary

1. Run `git status --short`, identify user changes, and do not clean or rewrite them.
2. Determine the comparison base with local Git evidence. Do not fetch, push, or contact a registry unless authorized.
3. List changed files by package and shared root configuration.
4. Re-read root/package `package.json`, `pnpm-workspace.yaml`, `turbo.json`, root `tsconfig.json`, package changelogs/READMEs, and `.changeset/` if it exists.
5. Record whether each command below is a package script or a package-manager/tool invocation.

### 2. Build the affected-package graph

For every changed package, record:

- Published/private status and package name.
- Runtime, peer, optional, and dev dependency edges to workspace packages.
- Direct dependents, including the `openapi-to` aggregate package.
- Changed public types, runtime exports, generated output, CLI behavior, or documentation.
- Whether a dependent needs a release because its manifest range, bundled output, types, or user-facing aggregate API changes.

Internal dependencies currently use `workspace:*` broadly. Let pnpm/Changesets update resolved release metadata; never hand-edit `pnpm-lock.yaml` to simulate dependency correctness.

### 3. Classify semver impact

- **Major:** removes/renames an export, changes incompatible config/context/accessor types or generated contracts, changes CLI behavior incompatibly, or drops supported runtime/dialect behavior.
- **Minor:** adds a backward-compatible plugin/config/export/command/output capability.
- **Patch:** fixes behavior without intentionally breaking the public contract, or corrects docs/metadata that requires a package release under project policy.

Account for `0.x` semantics only if a target package is actually `0.x`; do not assume all packages share the same consumer risk merely because current versions align. A prerelease identifier does not make an incompatible stable change safe, and a prerelease must not be presented as a stable release.

Record the reason for every bump and every affected published dependent that receives no bump.

### 4. Verify package surfaces

For each release candidate:

1. Inspect `main`, `module`, `types`, `bin`, `exports`, `files`, and `publishConfig` where present.
2. Run its build and confirm every declared ESM/CJS/type/bin target exists in `dist` or the packed package.
3. Inspect emitted `.d.ts` files for missing private workspace paths, source-only aliases, and unintended public types.
4. Check aggregate exports in `packages/openapi/src/index.ts` and dependency declarations in `packages/openapi/package.json`.
5. Check the CLI's package/version relationship and built bin behavior when CLI/openapi packages change.
6. Inspect README availability: update root/package documentation only where the user-facing API needs it; do not invent missing package READMEs as a release prerequisite unless project policy requires them.
7. Perform a dry-run pack using a command supported by the installed package manager (verify with local help first), and inspect the complete file list. No secrets, fixtures, test outputs, source maps not intended for publication, or undeclared runtime files may leak.

Do not edit built output by hand. Rebuild it from source.

### 5. Verify Changesets and release metadata

1. Check for `.changeset/config.json` before invoking Changesets. At the authored revision, root scripts/dependencies exist but the tracked configuration directory does not; re-check rather than assuming it was added.
2. If configuration is missing, report release infrastructure as incomplete and stop before `pnpm changeset`, versioning, or publish. Do not silently initialize Changesets unless the user requests that scope.
3. If configured, run the non-publishing status command supported by the installed CLI and inspect package bumps/dependent bumps.
4. Add or review a changeset that names only affected packages and describes user-visible behavior. Do not rewrite historical versions.
5. Verify package changelogs and the intended local tag names against existing local tags/history.
6. Treat canary/alpha/beta/rc scripts as separate paths; inspect their exact command text and resulting dist-tag/version policy before use.

### 6. Validation matrix

Run focused commands first:

```sh
pnpm --filter <package-name> test
pnpm --filter <package-name> typecheck
pnpm --filter <package-name> build
```

For shared core/public API, aggregate package, or multi-package releases, run as impact requires:

```sh
pnpm test:vitest
pnpm typecheck
pnpm build
```

Also:

- For generator changes, use the repository's `run-codegen-tests` Skill when the current Agent supports Skill invocation. Otherwise read `.agents/skills/run-codegen-tests/SKILL.md` and execute its applicable workflow directly. Optional shortcuts are Codex `$run-codegen-tests` and Claude Code `/run-codegen-tests`; the release decision must not depend on either syntax.
- Run applicable CLI e2e smoke projects after a successful build when CLI/aggregate package behavior changes.
- Re-run pack inspection after the final build/version state.
- Ensure no uncommitted generated/test output was introduced.

A failing required test, typecheck, build, generated compile, idempotency check, export target, or pack inspection blocks a “ready to publish” conclusion.

### 7. Produce the plan, not the publication

Output an ordered plan containing:

- Package and bump table with reasons.
- Internal dependency/dependent updates expected from tooling.
- Changeset/changelog/README work.
- Validation commands and artifacts.
- Intended tag/dist-tag/channel and rollback notes.
- Exact operations requiring user authorization.

Do not run root `release`, package `release`, `pnpm publish`, `npm publish`, create/push a tag, or push a branch unless the user explicitly asks for that external change. Ask again if the exact packages/channel differ from the approved plan.

## Stop conditions and prohibited actions

- Stop if Changesets configuration is absent or invalid, required outputs are missing, pack contents are unsafe, versions/ranges are inconsistent, or required validation fails.
- Do not publish from a dirty/unexplained worktree.
- Do not modify historical release tags or historical package versions.
- Do not hand-edit the lockfile to repair workspace dependency relationships.
- Do not treat a prerelease as stable or reuse a stable tag for a prerelease.
- Do not claim readiness when a required test was skipped or continued-on-error in CI.
- Do not infer registry authentication or publication permission from local config.

## Diagnostics compatibility

If the current branch provides a unified Diagnostic API, preserve its stable code, severity, location, and bounded message in release evidence. Otherwise record current command/error output with sensitive values redacted and enough context to locate the failure. Do not make release preparation depend on an absent Diagnostics framework or broaden it into that refactor.

## Completion standard

Confirm that:

- Affected packages and dependents are fully mapped.
- Every bump has a semver rationale.
- Exports, declarations, bin targets, build output, and pack contents are verified.
- Changesets/changelog/tag readiness is explicit.
- Generator/CLI regressions are covered where applicable.
- No publish/tag/push occurred without explicit authorization.

## Final response

Report:

1. Comparison base and affected-package graph.
2. Proposed package bumps with reasons.
3. Changeset/changelog/README status.
4. Export/declaration/build/pack findings.
5. Exact validation commands/results.
6. Tag/channel plan and actions not performed.
7. Blockers, skipped checks, compatibility risks, and required user decisions.

Say “release plan prepared,” not “released,” unless publication actually completed.
Never report an unexecuted validation as passing, and never overwrite unexplained user files while preparing the plan.
