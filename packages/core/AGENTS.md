# Core agent guide

This file extends the root `AGENTS.md` for `packages/core/`. Core owns compiler
semantics, diagnostics, plugin orchestration, artifacts, comparison, and the
formal writer. CLI, MCP, and plugins must call these public capabilities rather
than reimplement them.

## Pipeline and representations

Classify a change by its owning stage:

1. Source loading — local/object/HTTP(S) acquisition and remote policy in
   `src/openapi/sourceLoader.ts`.
2. Parsing and Swagger conversion — JSON/YAML parsing and Swagger 2.0
   conversion in `src/openapi/sourceLoader.ts`.
3. Reference resolution — internal/external `$ref`, pointer, cycle, cache, and
   missing-target handling in `src/openapi/refResolver.ts`.
4. Validation — dialect/version and structural diagnostics in
   `src/openapi/validator.ts`.
5. Normalization — deterministic, non-mutating key ordering in
   `src/openapi/normalizer.ts`.
6. Legacy-compatible plugin context — `src/OpenAPIContext/`.
7. Plugin generation — Hook execution and plugin contributions in
   `src/pluginManager/`.
8. Artifact formatting — typed artifact materialization and configured
   formatting in `src/artifacts/`.
9. Comparison — hashes, managed deletions, dry-run/check manifests.
10. Writing — locks, transactions, journal/recovery, files, and the ownership
    manifest.

`compileOpenAPI()` currently loads/parses or converts, resolves references,
validates the converted legacy-compatible document, and normalizes the resolved
representation.

- `OpenAPICompilation.document` is the converted, legacy-compatible document.
  Existing plugin Hooks receive this representation as
  `HookContext.openAPIDocument`.
- `resolvedDocument` expands resolvable references while retaining detected
  cycles as `$ref`.
- `normalizedDocument` recursively sorts object keys in the resolved
  representation while preserving array order and unknown fields.

Plugins do not currently choose `resolvedDocument` or `normalizedDocument`
through `HookContext`. A caller that needs those forms must use
`compileOpenAPI()` directly. Name the representation explicitly when it affects
behavior.

Do not infer repository support for an OpenAPI version or JSON Schema keyword
from parser or dependency support. Distinguish complete support, compatible
read, accepted-not-generated behavior, and unsupported input with focused
end-to-end evidence.

## Diagnostic ownership

Use the public `Diagnostic` contract from `src/diagnostics.ts`; codes are a
compatibility surface and public results must be sorted.

- Loader/parser owns acquisition, protocol, syntax, conversion, and remote
  failures.
- Resolver owns `$ref` failures.
- Validator owns dialect and structural findings.
- Artifact stages own serialization, path, format, comparison, lock, and write
  failures.
- Plugins own only their generation limitations and Hook failures.

Do not duplicate one compiler finding in each plugin or re-create it in CLI/MCP
presentation. Plugins use `ctx.addDiagnostic()` with a plugin name and precise
OpenAPI path where possible. Library code must not call `process.exit`.

## Plugin scheduling and state

Dependency stages run in topological order. Within each current stage:

- `buildStart` completes before component Hooks.
- Component Hook groups can run concurrently and finish before the tag loop.
- Each `tagStart` is awaited before scheduling that tag's `operation` Hooks.
- Operations in one tag run concurrently, and work from different tags may
  overlap.
- `tagEnd` is invoked while scheduled operations for that tag may still be in
  flight; it is not a completion barrier.
- All scheduled operations for the stage finish before `buildEnd`, so
  `buildEnd` is the current stage aggregation barrier.

Re-read `src/pluginManager/runPluginsByTags.ts` whenever lifecycle code changes.
Do not use shared `currentTag`/`currentOperation` variables or mutate an
unpartitioned SourceFile, import collection, `Map`, or `Set` from concurrent
operation Hooks. Prefer namespaced build-local `ctx.store`. If an existing
plugin architecture requires compatibility storage, only a per-config
`WeakMap<OpenapiToSingleConfig, State>` initialized in `buildStart` is allowed;
never use a module-global strong-reference registry, counter, `Project`, or
cross-build collection. Test consecutive builds for leakage.

Use component Hooks for matching component output, `operation` for
operation-local artifacts/metadata, and `buildEnd` for sorted aggregate files.
Core's final sort cannot make concurrently mutated aggregate content
deterministic.

## Artifact and writer contract

Legacy TypeScript plugins may register `ts-morph` SourceFiles through
`ctx.setSourceFiles()`. New output should use `ctx.addArtifact()` with the
correct TypeScript, JSON, text, or bounded binary kind. Hooks never write output
directories directly.

- Artifact paths remain inside `output.dir`. Traversal, absolute escapes,
  reserved transaction paths, unsafe symlink segments, and case-only
  collisions fail.
- Identical paths with identical serialized bytes deduplicate; conflicting
  bytes at one path fail.
- The default serialized limit is 64 MiB per artifact. Preserve or tighten
  resource bounds deliberately.
- `output.clean` may delete only unchanged paths recorded by the prior
  `.openapi-to-manifest.json`. Without that manifest there is no legacy
  directory sweep, and unmanaged files survive.
- Dry-run and check compare only: they do not update files, ownership,
  transaction state, or the manifest.
- The Core transaction writer is the only formal filesystem writer. It owns
  the shared output lock, staging, journal, commit, rollback, and recovery.
  CLI and MCP must not implement parallel writers or incompatible locks.

## Validation

For compiler/OpenAPI behavior, add the smallest legal fixture and a focused
invalid, unsupported, or cross-dialect case. A broad Petstore fixture is only
additional smoke evidence.

Run commands only after confirming them in manifests. The normal Core baseline
is:

```sh
pnpm --filter @openapi-to/core test
pnpm --filter @openapi-to/core typecheck
```

Also run every affected official plugin test. Shared public types, lifecycle,
or emitted behavior normally require focused fixture generation followed by
`pnpm typecheck` and `pnpm build`. Artifact, path, naming, import, or ordering
changes require full file-set review, generated consumer validation where
applicable, and a byte-stable second generation. Use the matching repository
Skill for plugin, OpenAPI-support, or codegen-regression work.
