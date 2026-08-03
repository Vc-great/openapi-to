# Setup diagnosis

Use the inspector before suggesting a write. Its JSON is a bounded observation,
not proof that a command started, a Host reloaded configuration, or an MCP Tool
Schema is compatible.

## State model

| State | Evidence | Next decision |
| --- | --- | --- |
| `UNINSPECTED` | No current inspector result | Read rules, Git state, and run the inspector. |
| `BLOCKED` | Conflicting package-manager evidence, multiple configs, unsafe symlink, oversized/invalid metadata, version conflict, or duplicate Codex section | Stop writes and report the exact bounded reason. |
| `PACKAGE_MISSING` | No aggregate `openapi-to` declaration | Plan an exact-version aggregate install or request a version decision. |
| `PACKAGE_READY` | Aggregate package is declared locally | Continue to generation config; do not infer that binaries resolve. |
| `CONFIG_MISSING` | No supported root config | Plan the existing `pnpm exec openapi init`. |
| `CONFIG_READY` | Exactly one supported config exists | Treat it as trusted executable project code only when validation is approved. |
| `HOST_CONFIG_MISSING` | No project Codex server section | Plan a missing-file create or exact append. |
| `HOST_CONFIG_READY` | One conservatively recognized server section | Restart may still be required; existing sections default to manual review. |
| `RESTART_REQUIRED` | Project Host configuration changed | Stop until the user restarts the Host. |
| `MCP_ANALYSIS_ONLY` | Compatible current analysis Tool list and Schemas | Validation/inspection/diff only. |
| `MCP_READ_ONLY` | Compatible configured read-only Tool list and Schemas | Hand discovery/preview to `openapi-to-generate`. |
| `MCP_WRITE_ENABLED` | Compatible Prepare/Apply list and Schemas plus prompt policy | Hand controlled generation to `openapi-to-generate`; Apply still needs exact approval. |

## Inspector envelope

- `schemaVersion` identifies the JSON contract.
- `observedStateHash` is SHA-256 over the canonical observation without the
  hash. Bind a Setup Plan to this exact value.
- `blockingReasons` is sorted and closed: do not guess through a reason.
- `workspace` reports only bounded booleans, a relative root marker, and the
  running Node major/support decision. It never prints the absolute Workspace.
- `packageManager` prefers `package.json#packageManager`, then a unique lockfile
  manager. A mismatch or multiple managers is `conflict`; only pnpm is an
  automatic write path in this phase.
- `dependencies` lists only manifest declarations for `openapi-to` and
  `@openapi-to/*`, their dependency section and range. It does not inspect a
  global installation or claim that a declared package resolves.
- `generationConfig` checks only `openapi.config.ts`, `.js`, `.cjs`, and `.mjs`
  at the root. It hashes bytes without importing or executing the file.
- `runtimeState` checks `.openapi-to/` presence and a conservative explicit
  root ignore rule. It never reads state contents.
- `codex` hashes `.codex/config.toml` and uses conservative section/text
  inspection. It never returns TOML content, credentials, command bodies, or
  environment data. `parser: conservative-text-inspection` is deliberately not
  a claim of complete TOML parsing. `manualReviewRequired` prevents automatic
  rewriting of an existing section; `configurationBlocked` separately marks a
  shape or policy that cannot be treated as safe current Host configuration.

## Package boundaries

The aggregate `openapi-to` package provides the `openapi`, `openapi-to`, and
`openapi-to-mcp` binaries plus official generation plugins. `@openapi-to/mcp`
alone is an advanced MCP-only boundary, not a complete business
code-generation environment. Report MCP-only state; do not silently replace it
or install over it.

Existing versions are immutable in this workflow. Exact user choice outranks
an exact, consistent local `@openapi-to/*` version. Without either, request a
version decision. Ranges, tags, `latest`, prereleases, and global commands do
not supply safe version evidence.

## Failure-closed rules

- More than one supported generation config is `BLOCKED`; do not select one.
- An invalid/oversized package, config, ignore, or Codex metadata file is
  `BLOCKED`; do not truncate and proceed.
- A symlink that resolves outside the real project root is `BLOCKED` and is not
  followed.
- A Codex section the conservative inspector cannot understand is
  `manualReviewRequired`; do not rewrite arbitrary TOML.
- A package declaration is not command resolution. A Host section is not a
  restart. A Tool count is not Schema compatibility.
- If the user requested diagnosis only, stop after reporting the state and do
  not prepare or apply writes.
