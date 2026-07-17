---
name: add-openapi-plugin
description: Add or substantially extend an openapi-to generator plugin, including lifecycle selection, package registration, output naming, configuration types, fixtures, composition tests, exports, and regression validation. Use for a new `packages/plugin-*` package or a new output mode inside an existing official plugin; do not use for parser-only fixes, CLI commands, release-only work, or documentation-only edits.
---

# Add an openapi-to plugin

Read the root `AGENTS.md` first. Re-read current core lifecycle types and at least one similar official plugin; this Skill never substitutes for current code.

## Required inputs

Establish before editing:

- Intended consumer and output kind: per operation, per component, per tag, or whole build.
- Output representation: legacy TypeScript `SourceFile`, TypeScript artifact, text artifact, JSON artifact, or binary artifact.
- Required upstream metadata and plugin dependencies.
- Configuration surface, defaults, file naming, import-extension policy, and public export name.
- Supported OpenAPI constructs and deliberately unsupported cases.
- Whether this is a new package or an extension to an existing package.

For a new official plugin, ordinary registration work may include adding its package, plugin name to the existing enum/type, workspace/aggregate dependencies and exports, root TypeScript project reference, package exports, tests, and fixtures. Do not stop merely because the official name must be registered. Stop for separately scoped core-design changes: `HookContext`, Hook names/order, `OperationAccessor`'s public model, dependency-graph semantics, or existing plugin stage definitions. The fixed plugin-name union limits third-party extension; record that architecture concern rather than redesigning it incidentally.

P0 provides the general `GeneratedArtifact` contract. Existing TypeScript plugins may continue registering `ts-morph` files through `ctx.setSourceFiles()`; core adapts them to TypeScript artifacts. New plugins should prefer `ctx.addArtifact()`: use a TypeScript artifact for a `SourceFile`, JSON artifact for structured JSON, text artifact for Markdown/YAML/plain text, and binary only for a bounded, explicit byte output. Never fake a non-TypeScript file with a `SourceFile` or write around the artifact writer from a Hook.

## Workflow

### 1. Establish the baseline

1. Run `git status --short` and preserve pre-existing changes.
2. Read:
   - `packages/core/src/pluginManager/types.ts`
   - `packages/core/src/pluginManager/runPluginsByTags.ts`
   - `packages/core/src/pluginManager/graph.ts`
   - the closest `packages/plugin-*/src/plugin.ts`, `src/types.ts`, `src/index.ts`, tests, manifest, tsconfig, and tsup config
   - `packages/openapi/src/index.ts` and `packages/openapi/package.json` for official registration
3. Record the target package name and actual scripts from its `package.json`. Do not copy a command from another repository or call `pnpm exec` a package script.
4. Read [plugin-touchpoints.md](references/plugin-touchpoints.md) when creating a package, consuming another plugin's metadata, or choosing an aggregate output Hook.

### 2. Design the lifecycle

Use only Hooks declared by `PluginDefinition` at the current revision:

- `buildStart`: validate options and create build-local state.
- `componentsSchemas`, `componentsParameters`, `componentsRequestBodies`, `componentsResponses`: derive files from the matching component collection.
- `tagStart`: initialize state that does not depend on completed asynchronous operations.
- `operation`: create one-operation output and attach operation metadata.
- `tagEnd`: do not use as a completion barrier; the current runner can invoke it while scheduled operation work is still pending.
- `buildEnd`: create aggregate/barrel output after scheduled component and operation work.

Verify the await boundaries in `runPluginsByTags.ts`, not only the Hook names. In the current runner, component Hooks finish before the tag loop; operations within a tag can run concurrently; operations from different tags can overlap; `tagEnd` can run before its operations finish; and a later `tagStart` can run while an earlier tag still has operations in flight. All scheduled operations are awaited before `buildEnd`, making it the current final aggregation barrier. Never depend on shared `currentTag`/`currentOperation` variables or an unpartitioned mutable SourceFile/import/Set/Map. Partition state by build/tag/operation or synchronize it explicitly.

`ctx.addArtifact()` registers synchronously, but asynchronous operation Hooks can complete in any order. Core sorts the final artifact set; it cannot make concurrently mutated aggregate content deterministic. Collect immutable operation facts and emit a shared aggregate artifact once in `buildEnd`.

Declare `dependencies` when the plugin reads metadata produced by another plugin. Verify names against `pluginEnum` and the current `PluginEnumType`; do not invent a name that core types cannot represent.

### 3. Implement isolated state

1. Define `PluginConfig` in `src/types.ts` and derive a required/internal config type only when it removes repeated defaulting.
2. Apply defaults in the plugin factory or `buildStart`; keep user configuration immutable.
3. Prefer existing build context such as namespaced `ctx.store` when it reliably isolates the required lifetime.
4. If current architecture requires module-level compatibility storage, allow only a `WeakMap<OpenapiToSingleConfig, State>` whose value belongs exclusively to that key's build and is initialized in `buildStart`. Do not treat this as a general best practice.
5. Never use module-level strong-reference `Map`, `Set`, array, counter, registry, or `Project` state. Never put a cross-build registry inside the allowed `WeakMap`.
6. Run two consecutive builds with fresh configuration objects and assert that names, files, registries, and counters do not leak.
7. Make missing state or missing dependency metadata a clear error, not a non-null assertion that later produces a vague exception.

### 4. Produce deterministic artifacts

1. Resolve every output beneath `ctx.openapiToSingleConfig.output.dir`.
2. Derive names from normalized operation/schema names using existing utilities when they match the contract.
3. Detect collisions after normalization, including case-only collisions relevant on Windows/macOS.
4. Choose one output API: retain `ctx.setSourceFiles()` for a small change to an existing TypeScript plugin, otherwise register the correctly typed artifact with `ctx.addArtifact()`.
5. Sort aggregate entries, imports, exports, schemas, and operations explicitly. Do not use timestamps, ambient locale, network data, or unseeded randomness.
6. Create shared/barrel files once in `buildEnd`, never once per operation.
7. Keep generated import specifiers consistent with the plugin's `importWithExtension` contract and existing `formatterModuleSpecifier`/`getRelativePath` helpers.
8. Treat paths as output-root-relative artifact paths. Do not bypass normalization, case-collision, duplicate-content, traversal, symlink, size, or ownership-manifest checks.
9. Identical paths with identical serialized bytes are deduplicated; identical or case-only paths with different identities/content are errors. Test the intended behavior rather than depending on Hook completion order.

### 5. Register the plugin

For a new official package:

1. Create the minimal package files modeled on the nearest official plugin: manifest, tsconfig, tsup config, `src/index.ts`, `src/plugin.ts`, and `src/types.ts`.
2. Add its TypeScript project reference only if the current root reference model requires it.
3. Export the factory and public types from the package entrypoint.
4. Add the workspace dependency and named aggregate export to `packages/openapi`.
5. Check `main`, `module`, `types`, `exports`, and `files` against emitted `dist` names; test both ESM and CJS entries when both are declared.
6. Update only documentation that users need to configure or import the plugin.

When extending an existing package, avoid creating a parallel entrypoint unless the package export map and user API require it.

### 6. Add evidence-producing tests

Add all applicable layers:

1. Unit tests for configuration defaults, naming, collision handling, and builder edge cases.
2. A minimal fixture under the target package's existing `mock/` convention. Do not use only the broad Petstore file.
3. An integration test that runs `PluginManager`, awaits `run()`, and asserts exact file paths and meaningful content.
4. Snapshot/golden coverage only when it makes the complete emitted shape easier to review; avoid empty or placeholder snapshots.
5. A composition test with declared dependencies in dependency order and at least one unrelated official plugin when output coexistence matters.
6. A second build using a fresh configuration/state to detect cross-build pollution.
7. Cases beyond one happy path: collision/invalid option plus relevant `$ref`, nullable/union, enum, request body, or empty-input behavior.

Add representation-specific assertions:

- TypeScript: exact file set, semantics, imports, compilation, and a byte-stable second generation.
- JSON: parse the serialized bytes, assert the structure/sorting policy, and require byte stability.
- Text/Markdown/YAML: assert UTF-8/newline policy, no unintended TypeScript formatting, and byte stability.
- Binary: assert exact bytes, hash, bounded size, and byte stability.

Never modify a checked-in generated result without changing and testing the generating logic or fixture that explains it.

## Validation matrix

Replace placeholders with manifest names and run only commands confirmed in the current tree:

```sh
pnpm --filter <plugin-package> test
pnpm --filter <plugin-package> typecheck
pnpm --filter <plugin-package> build
```

Then:

- Run tests for each declared plugin dependency and the focused composition test.
- Inspect snapshots and every generated add/delete/rename, not just the test exit code.
- Use the Codex `$run-codegen-tests` Skill. If Skill invocation is unavailable, read `.agents/skills/run-codegen-tests/SKILL.md` and execute its applicable workflow directly.
- If core public types or lifecycle changed with explicit authorization, run core tests/typecheck plus every official plugin test, then `pnpm typecheck` and `pnpm build`.
- Inspect the plugin and aggregate package export maps and built declarations.

Do not automatically update fixtures/snapshots. First explain why the semantic diff is expected. Unexpected broad output, unstable second generation, a path outside the output root, a collision, or missing dependency metadata is a stop condition.

## Diagnostics

Use `ctx.addDiagnostic(...)` for plugin-owned unsupported structures and recoverable failures. Codes are stable API; choose `warning` when generation can continue with a named limitation and `error` when promised output is unreliable. Include the plugin name and an OpenAPI field path when available. Do not emit an empty file as success, substitute `console.warn`, repeat Loader/Resolver/Validator diagnostics, serialize complete documents, or expose tokens, headers, cookies, or URL queries.

## Stop conditions and prohibited shortcuts

- Do not copy a large plugin and merely rename identifiers.
- Do not create the same file repeatedly in `operation`.
- Do not use global mutable build state.
- Do not change `HookContext`, `OperationAccessor`, or plugin lifecycle without cross-plugin tests and explicit task scope.
- Do not hand-edit generated output to make a test pass.
- Do not claim compatibility from a single Petstore happy path.
- Do not add a dependency or update a lockfile by hand.
- Stop before unrequested network writes, publishing, tagging, or pushing. Preserve unexplained user files and never overwrite them automatically.

## Completion standard

Confirm that:

- Configuration types/defaults and unsupported cases are documented.
- State cannot leak across builds.
- Output paths are bounded, collision-checked, and stable.
- Required dependencies and public exports are correct.
- Unit, integration, fixture, composition, typecheck, and build evidence is recorded as applicable.
- The second generation is byte/file-set stable.
- Any public API change has a release classification.

## Final response

Report:

1. Plugin purpose, Hook choices, and dependency graph.
2. Files/packages changed and public exports added.
3. Fixtures and edge cases covered.
4. Exact validation commands and results.
5. Reviewed generated/snapshot differences and idempotency result.
6. Breaking-change assessment, risks, skipped checks, and remaining work.

Never claim a command or scenario passed unless it was executed; list skipped validation and its reason.
