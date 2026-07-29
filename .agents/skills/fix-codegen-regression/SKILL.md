---
name: fix-codegen-regression
description: Diagnose and implement fixes for openapi-to generated-code defects, fixture or snapshot regressions, missing or extra files, invalid imports, type errors, nondeterminism, and downstream consumer failures. Use when generated output is wrong and needs an owning-source repair followed by run-codegen-tests; do not use merely to execute existing tests or for unrelated CLI, release, or MCP protocol work.
---

# Fix an openapi-to codegen regression

Read the root `AGENTS.md`, `packages/core/AGENTS.md`, the affected package
manifests, and the closest generator tests before editing. Use current code as
the pipeline authority.

This Skill diagnoses and implements the repair. Afterward, follow
[run-codegen-tests](../run-codegen-tests/SKILL.md) for generated file-set,
consumer, and idempotency evidence. Do not duplicate that Skill's full test
workflow here.

If the primary request is to add or broaden an OpenAPI dialect/JSON Schema
feature rather than repair an observed generated-output regression, also use
`.agents/skills/upgrade-openapi-support/SKILL.md`.

## Establish the evidence boundary

1. Record branch, HEAD, `git status --short`, and pre-existing changes. Preserve
   all user files and distinguish them from test-created output.
2. Collect:
   - exact OpenAPI input or smallest failing structure and its dialect;
   - target/plugin combination and dependency order;
   - relevant `openapi.config.*` settings;
   - generation/test command and output root;
   - expected file set/content and actual diagnostic or consumer error;
   - downstream consumer, module mode, TypeScript/runtime versions, and import
     policy where relevant.
3. Reproduce against current source before editing. Do not rely only on a stale
   snapshot or reported generated file.

## Create the minimal regression

Compress the failure into the smallest local immutable fixture under an
existing affected fixture convention. Prefer one operation/schema and only the
fields needed to demonstrate the defect. Add a cross-dialect or invalid case
when semantics differ.

Establish a stable failing unit/integration test or bounded reproduction script
before changing implementation. Assert meaningful semantics and the exact
added/deleted/renamed file set when those are part of the failure. A broad
Petstore fixture is follow-up smoke coverage, not the primary reproducer.

Do not fetch a mutable remote fixture or overwrite a checked-in generated file
to create the baseline.

## Locate the semantic owner

Trace the first incorrect representation through the actual pipeline:

1. loader/parser and source policy;
2. Swagger conversion;
3. reference resolver;
4. dialect-aware validator;
5. deterministic normalizer;
6. legacy OpenAPI context or operation accessor;
7. plugin collector or shared metadata producer;
8. plugin builder/template;
9. artifact materialization, formatter, comparison, ownership, or writer;
10. CLI presentation only when compiler output is correct but surfaced
    incorrectly;
11. downstream plugin metadata consumer.

Record the first stage where expected and actual behavior diverge. Fix that
owner once; do not add parallel patches to every plugin, reimplement Core
semantics in CLI/MCP, or mask the defect with type assertions.

For `$ref`, nullable, boolean schemas, `oneOf`/`anyOf`/`allOf`, media types,
parameters, request bodies, responses, discriminators, and recursive schemas,
name the source dialect. OpenAPI 3.0 Schema Objects and OpenAPI 3.1/3.2 JSON
Schema semantics are not interchangeable. Parser/dependency acceptance alone
does not prove generator support.

## Map affected plugins

Check the producer/consumer chain rather than testing only the reporter:

- `@openapi-to/plugin-ts-type`;
- `@openapi-to/plugin-zod`;
- `@openapi-to/plugin-ts-request`;
- `@openapi-to/plugin-swr`;
- `@openapi-to/plugin-vue-query`;
- `@openapi-to/plugin-msw`;
- any other package that actually imports the changed public type, helper, or
  accessor metadata.

Type/Zod changes can affect request and framework consumers even when their
templates do not change. Run at least one realistic declared-dependency
combination for shared metadata defects.

## Implement the narrow repair

- Preserve the input document and user configuration.
- Keep one semantic rule in its owning stage and diagnostics in their owning
  layer.
- Sort files, declarations, imports, exports, operations, schemas, and
  aggregate entries explicitly where source order is not contractual.
- Bound recursion, file count, size, and traversal; retain path, symlink,
  collision, ownership, and clean protections.
- Emit one aggregate file at the current safe lifecycle barrier rather than
  mutating shared output from concurrent operation Hooks.
- Change snapshots or checked-in generated examples only after the source fix
  and minimal fixture explain every semantic/file-set difference.
- Add a changeset only when the resulting user-visible package fix requires it
  under current project policy.

Prohibited shortcuts:

- directly editing generated output;
- mechanically updating snapshots;
- adding a type assertion that hides incorrect runtime behavior;
- replacing a focused fixture with Petstore;
- ignoring added, deleted, renamed, empty, or unexpectedly large files;
- validating only one plugin in an affected dependency chain;
- weakening diagnostics, assertions, determinism, or path safety.

## Verify the repair

First rerun the stable failing test. Then invoke `$run-codegen-tests`, or follow
the linked canonical Skill directly, selecting evidence based on impact:

- focused unit and integration tests;
- exact generated file-set and complete semantic diff;
- snapshot decision with source/fixture rationale;
- import paths, extension policy, and missing-file checks;
- temporary generated TypeScript consumer compilation;
- Zod/runtime schema behavior where applicable;
- declared plugin combinations and downstream metadata consumers;
- a second identical generation and formal `--check` stability.

Run target package test/typecheck/build commands only after confirming them in
its manifest. Shared Core/public API changes require Core plus affected plugin
validation and may require root typecheck/build. Preserve all failing evidence
until the cause is understood.

## Stop conditions

Stop and report when:

- the output root is unsafe or reproduction would overwrite unrelated files;
- the input dialect or expected semantics cannot be determined;
- many unrelated outputs change without an owning-source explanation;
- generated TypeScript still fails in the intended consumer;
- runtime validator behavior contradicts emitted types;
- the second generation changes bytes or file set;
- a remote input makes the result mutable;
- the required fix expands into unrelated CLI, release, or MCP protocol scope.

## Final report

Report:

1. Minimal fixture and stable failing reproducer.
2. Pipeline owner and first divergent representation.
3. Root cause and implementation change.
4. Affected packages/plugins and dependency-chain evidence.
5. Snapshot/generated example decision.
6. Generated file-set and semantic output review.
7. Consumer compile and runtime validation results.
8. Second-generation/idempotency result.
9. Exact commands, skipped checks, pre-existing failures, and remaining risk.

Never equate a green snapshot test with correct generated output.
