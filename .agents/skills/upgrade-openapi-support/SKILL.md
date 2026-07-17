---
name: upgrade-openapi-support
description: Upgrade or repair openapi-to handling of Swagger/OpenAPI dialects and JSON Schema features across input loading, conversion, references, normalization behavior, plugin context, type/Zod/request/query generation, fixtures, and compatibility claims. Use for nullable, type arrays, composition keywords, references, media types, or a stated OpenAPI version gap; do not use for a generator-only presentation change unrelated to schema semantics.
---

# Upgrade OpenAPI support

Read root `AGENTS.md`, then read [openapi-compatibility-checklist.md](references/openapi-compatibility-checklist.md). Treat the checklist's repository evidence as a starting point and re-verify it at the current revision.

## Required inputs

Define:

- Exact source dialect: Swagger 2.0, OpenAPI 3.0, OpenAPI 3.1, OpenAPI 3.2, or a documented nonstandard compatibility case.
- Exact feature and location: schema, parameter, request body, response, callback, webhook, or reference.
- Expected normalized meaning and expected output for every affected official plugin.
- Whether the task promises complete support, compatible reading, preservation-only behavior, or a clear unsupported diagnostic.
- Network policy for remote documents/external `$ref` values.

If the requested semantics are ambiguous between dialects, stop and obtain a concrete example or cite the relevant primary specification. Do not guess from a similarly named keyword in another dialect.

## Workflow

### 1. Audit the real pipeline

Run `git status --short`, preserve unexplained user changes, and verify current manifests/configuration before editing. Do not overwrite fixtures or generated expectations automatically.

Map the implemented stages to current code:

1. Source loading and parsing: `openapi/sourceLoader.ts` plus Swagger conversion.
2. Reference resolution: `openapi/refResolver.ts`, including internal, relative-file, and policy-controlled remote references.
3. Dialect-aware validation: `openapi/validator.ts`.
4. Normalization and orchestration: `openapi/normalizer.ts` and `openapi/compiler.ts`.
5. Legacy-compatible access: `OpenAPIContext/OpenAPIHelper.ts` and `OperationAccessor.ts`; current official plugins receive `compilation.document`, not the resolved or normalized document.
6. Generation: official plugin collectors/builders/hooks.
7. Output: typed `GeneratedArtifact` collection, formatting, comparison, ownership-aware writing, dry-run, or check.

Record the installed dependency capabilities from manifests/lockfile and their actual usage. Do not equate a dependency's theoretical support with repository support.

### 2. Build minimal evidence

Add fixtures under an existing affected `mock/` convention or a focused test fixture directory established by the task:

- One smallest legal document that demonstrates the feature in the target dialect.
- One smallest illegal, unsupported, or compatibility-only document with an explicit expected error/warning/preservation behavior.
- One `$ref` variant when the feature can be referenced.
- A counterexample from another dialect when syntax or semantics differ, such as OpenAPI 3.0 `nullable: true` versus OpenAPI 3.1 `type: ["string", "null"]`.

Keep fixtures local and immutable. Do not base compatibility tests on a mutable remote URL. A broad Petstore fixture is only follow-up smoke coverage.

### 3. Trace the feature end to end

For the legal and illegal fixtures, inspect:

1. **Load/convert:** Is the dialect detected without erasing the feature? Does Swagger conversion preserve intended semantics?
2. **Reference handling:** Does an internal `$ref` reach the same semantic path? Is recursive traversal bounded? Treat external `$ref` separately and do not add network access without explicit policy.
3. **Validation:** Does the validator apply the source dialect rather than treating every Schema Object as one JSON Schema dialect?
4. **Normalization:** Does `normalizeOpenAPIDocument` preserve unknown fields, bound recursion, retain cycles as references, and sort object keys deterministically?
5. **Plugin context:** Does the legacy-compatible `compilation.document`/`OpenAPIDocument`, `Schema`, `ComponentsSchemas`, or accessor metadata represent the value without unsafe narrowing? Do not silently assume the resolved or normalized representation is supplied to plugins.
6. **Type output:** Check model properties, operations, requests, responses, optionality/nullability, unions/intersections, imports, and recursion.
7. **Validation output:** Check Zod runtime semantics, not just TypeScript compilation.
8. **Request output:** Check path/query/body/media-type behavior and dependency metadata.
9. **Query/mock output:** Check SWR, Vue Query, and MSW when they consume changed request/type metadata.
10. **Artifacts/check:** Check typed artifacts, diagnostics, dry-run manifest, and a successful second `--check`.

Do not fix only a version string or public type union when collectors/builders still discard the feature.

### 4. Implement the narrow semantic change

- Preserve dialect-specific distinctions through shared types and helpers.
- Keep nonstandard compatibility branches explicit and tested; label them policy, not specification requirements.
- Prefer one semantic conversion point over repeated ad hoc checks across plugins, but do not refactor architecture beyond task scope.
- Bound recursion and detect cycles for recursive schemas/references.
- Keep output stable through explicit sorting and deterministic naming.
- Return actionable, bounded diagnostics for unsupported shapes. Do not print full documents or sensitive remote request context.
- Never execute examples, descriptions, extensions, or schema text.

### 5. State the support boundary

For every changed feature, record one of:

- **Complete support:** fixture-backed load/reference/context/generation/runtime validation across all promised outputs.
- **Compatible read:** accepted and preserved/normalized, with named downstream limitations.
- **Accepted-not-generated:** explicitly diagnosed or documented and covered by a test.
- **Unsupported:** rejected or warned with a tested message.

Do not use “OpenAPI 3.1 supported” or “OpenAPI 3.2 supported” based on one keyword or version check.

## Validation matrix

Run commands confirmed in manifests:

```sh
pnpm --filter @openapi-to/core test
pnpm --filter @openapi-to/core typecheck
pnpm --filter @openapi-to/plugin-ts-type test
pnpm --filter @openapi-to/plugin-zod test
```

Add the affected request/query/mock package tests, for example `pnpm --filter <plugin-package> test`, based on traced metadata impact. When shared types or emitted behavior change, also run:

```sh
pnpm typecheck
pnpm build
```

Use the Codex `$run-codegen-tests` Skill. If Skill invocation is unavailable, read `.agents/skills/run-codegen-tests/SKILL.md` and execute its applicable workflow directly.

Required scenario evidence:

- Target dialect + legal minimal fixture.
- Target dialect + illegal/unsupported fixture.
- Direct schema + internal `$ref` when applicable.
- Cross-dialect counterexample when semantics differ.
- All affected official output plugins, not only TypeScript types.
- Empty/unknown-field behavior and bounded diagnostics.

## Stop conditions and risks

Stop before claiming support when:

- The parser/dependency accepts the document but repository types or plugins lose the feature.
- Only a README claim, type cast, or version condition changed.
- External reference behavior was not separated from local references.
- Runtime validation semantics differ from generated TypeScript.
- A recursive input hangs, overflows, or grows output without a bound.
- Unknown fields or failed conversions disappear silently.
- Fixtures do not identify the dialect/version they exercise.

Treat remote input, external references, descriptions, examples, and extensions as untrusted. Enforce explicit network, size, timeout, path, and diagnostic limits if the authorized task adds such behavior.

## Diagnostics

Use the unified `Diagnostic` API. Compiler stages own Loader/Parser/Resolver/Validator/Normalizer findings; plugins add only downstream generation limitations through `ctx.addDiagnostic()`. Keep stable codes, severity, source/path location, and bounded messages. Do not duplicate a compiler diagnostic in every plugin or expose documents, tokens, headers, cookies, credentials, or URL queries.

OpenAPI 3.0 Schema Objects are not JSON Schema 2020-12. OpenAPI 3.1/3.2 dialect semantics require an explicit dialect decision; never mechanically translate 3.0 `nullable` to or from a `type` array. Validator acceptance does not prove plugin support. Test unknown-field preservation separately from accepted-not-generated diagnostics.

## Completion standard

Confirm that:

- The exact dialect feature and expected semantics are stated.
- Legal, illegal/unsupported, referenced, and cross-dialect cases are covered as applicable.
- Loading, references, implicit normalization, context, and every affected plugin were traced.
- Support is classified without overclaiming.
- Generated output is valid and idempotent.
- Documentation claims match fixture evidence.

## Final response

Report:

1. Target dialect/feature and support classification.
2. Pipeline stages and plugins changed.
3. Fixtures added and why each is minimal.
4. Exact validation commands/results and generated-output evidence.
5. Unsupported or preservation-only boundaries.
6. Security/network decisions, compatibility risks, skipped checks, and remaining work.

Never claim complete dialect support without fixture-backed end-to-end evidence.
Never report unexecuted validation as passing. Do not perform unrequested network writes, publication, tagging, pushing, or automatic user-file replacement.
