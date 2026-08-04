# Packed formal-plugin consumer code generation

`pnpm test:consumer:codegen` is the packed formal-plugin consumer codegen
specialist test. It owns generated file, strict compile, runtime, drift, and
idempotence coverage; it is not the full packed consumer release acceptance
entry. See the
[consumer acceptance coverage matrix](./consumer-acceptance-matrix.md) for the
canonical owner of each adjacent capability.

Run the independent external-consumer smoke after building the repository:

```shell
pnpm build
pnpm test:consumer:codegen
```

The smoke packs every public workspace package, creates a project beneath the
operating system temporary directory, installs the `openapi-to` tarball with
tarball overrides for all aggregate dependencies, and invokes the installed
`node_modules/.bin/openapi` entry. The consumer pins the repository's installed
TypeScript version, explicitly requests `zod@^4`, and rejects any resolved Zod
major other than 4. It does not copy a Zod version from an e2e workspace. Its
local fixtures exercise base request generation, multiple success and error
responses, referenced component parameters/request bodies/responses, 204 and
default responses, OpenAPI 3.1 boolean/empty schemas, recursive schemas,
required/optional/nullable fields, RFC3339 offsets, numeric constraints, enums,
arrays, records, additional properties, unions, intersections, and nested
schemas. Escaped property names are covered by the plugin's focused generator
and runtime tests.

Seventeen focused fixtures under `scripts/fixtures/consumer-codegen/` keep the
remaining edge cases reviewable: referenced optional/required/path parameters
and boolean schemas; concrete plus `1XX`–`5XX` wildcard responses; operation
and component Media Type Objects without `schema`; a referenced no-content
component response; a response header reference isolated from its body schema;
schema `$ref` siblings and their deep imports at operation and component entry
points; nullable/composed object responses; and per-file component parameter
references without self-imports or unrelated imports. The
wildcard fixture is compiled with both Zod and TypeScript response generation.
The empty-media fixture runs all three formal plugins and statically rejects
`undefined.parse(` in request services. Runtime checks prove optional query,
required path/query, `schema:false`, wildcard aggregates, no-content,
`z.unknown()` media, response-body/header isolation, nullable refs, and sibling
`minLength`. Focused plugin tests also lock the established first-declared
selection when a request or response advertises multiple media types.

Four component-schema fixtures run TypeScript and Zod together for primitive,
array, enum, composition, nullable, type-array, and boolean components;
schema-valued `additionalProperties` with compatible and incompatible fixed
properties; direct/array/map recursion with an external reference; and
`$ref + enum/const` across component and operation entry points. The smoke
rejects empty component files, missing named exports, unresolved named imports,
self-imports, undeclared enum value types, and unstable second-generation
manifests. Strict assignments exercise the generated index signatures,
boolean-property types, recursive types, and scalar literal intersections;
Zod 4 executes the matching boolean, recursive, enum, and const schemas.

Seven cross-plugin fixtures additionally run `pluginTSType`, `pluginZod`, and
`pluginTSRequest` together for operation header/cookie parameters, mixed
schema/unknown-media/no-content success responses, Parameter Object `content`,
request-body schema `$ref` siblings, deep sibling imports, response object
semantics, and component parameter import isolation. Their generated files are strictly
compiled, Zod parsing checks optional and required header/cookie objects,
compile-time assignments distinguish `undefined` from `unknown` and prove
`$ref + anyOf/allOf` remains an intersection, every relative named import is
resolved, self-imports, duplicate exports, and `undefined.parse(` are rejected,
and a second generation must be byte-stable. Header/cookie generation remains
metadata-only for the request client signature: callers supply transport
values through request/client configuration.

The aggregate package supplies `pluginTSType`, `pluginZod`, and
`pluginTSRequest`; the generated TypeScript and a consumer request stub are
then compiled in strict mode with `skipLibCheck: false`. A separate runtime
entry executes the generated model, request body, query, path, response,
boolean/empty, and recursive schemas with Zod 4 and checks both accepted and
rejected values. Compile-time assertions lock precise inference for ordinary
model/response schemas and the documented `unknown` inference boundary for
recursive schemas.

This is broader than a plugin unit or snapshot test because it validates the
packed aggregate export, installed CLI, config loading, cross-package plugin
dependency chain, and generated imports in an isolated project. CLI E2E tests
exercise repository workspaces rather than a newly installed tarball.
`release:smoke` reuses this exact scenario with its already packed tarballs,
alongside the package-surface, binary, and MCP checks.

There is one specialist test with an optional review-export mode:

```shell
pnpm test:consumer:codegen
pnpm test:consumer:codegen:review
```

`test:consumer:codegen` is the automation-oriented specialist validation and
always cleans its operating-system temporary workspace. For day-to-day human
review of generated code, use `test:consumer:codegen:review`. The latter is not
a different consumer E2E or a second test layer: it invokes the same specialist
test and, only after
validation, drift recovery, strict compilation, the final current check, and
byte-stable regeneration have passed, atomically exports a compact snapshot to
`.ci-artifacts/consumer-codegen-review/current`. The original temporary root is
then removed automatically.

`pnpm release:smoke` remains the canonical full packed consumer acceptance
entry. It packs once, reuses the same tarballs for this exact codegen scenario,
then verifies package surfaces, bins, MCP stdio/capabilities, controlled
Prepare/Apply, and the narrow Setup Inspector-to-packed-MCP handoff bridge.

The review snapshot contains `report.json`, the OpenAPI fixture and config,
request stub, consumer usage, TypeScript config, `pnpm-lock.yaml`, all final
generated files, and the ownership manifest. It deliberately excludes
`node_modules`, tarballs, and pnpm store data (as well as transaction state and
the artificial drift used by the test). `.ci-artifacts` is ignored by Git and
review snapshots must not be committed. The snapshot is for code review, not
for rerunning `tsc` or an installed CLI.

Open `.ci-artifacts/consumer-codegen-review/current` directly in WebStorm, or
use Finder's **Go to Folder** command and paste its absolute path. To keep two
reviewable runs, export explicit names beneath the same owned root:

```shell
pnpm test:consumer:codegen -- --export-review-dir .ci-artifacts/consumer-codegen-review/previous
pnpm test:consumer:codegen -- --export-review-dir .ci-artifacts/consumer-codegen-review/current
diff -ru .ci-artifacts/consumer-codegen-review/previous .ci-artifacts/consumer-codegen-review/current
```

Remove an individual review snapshot when it is no longer useful:

```shell
node --input-type=module -e "import { cleanupReviewExportDirectory as clean } from './scripts/consumer-codegen-smoke.mjs'; await clean('.ci-artifacts/consumer-codegen-review/current')"
```

The cleanup helper applies the same path and ownership checks as replacement;
deleting the `current` folder explicitly in WebStorm or Finder is also safe.
## Advanced troubleshooting

For infrequent command-level debugging, retain the complete temporary consumer,
including its `node_modules` and packed tarballs, with the underlying `--keep`
parameter:

```shell
pnpm test:consumer:codegen -- --keep
```

This is not the primary daily review workflow; use
`test:consumer:codegen:review` to inspect generated code. The final output
prints the absolute retained path. After debugging, manually remove that
printed temporary subdirectory. Do not delete the operating system temporary
directory that contains it (for example, do not remove macOS's `/var/folders`
parent directory). Inspect
`consumer/package.json`, `consumer/pnpm-lock.yaml`,
`consumer/openapi.config.ts`, `consumer/openapi.json`,
`consumer/request.ts`, `consumer/generated/`, and
`consumer/generated/.openapi-to-manifest.json`. From the retained `consumer`
directory, rerun:

```shell
./node_modules/.bin/openapi generate --target consumer --json
./node_modules/.bin/openapi generate --target consumer --check --json
./node_modules/.bin/tsc -p tsconfig.generated.json
```

On Windows use the corresponding `.cmd` binaries. Failures identify the stage,
command, exit code, and bounded stdout/stderr. Installation failures usually
point to tarball dependency resolution; generation or semantic failures point
to the retained config, fixture, and manifest; TypeScript failures point to the
generated import and request-client contract. For one stable summary document on
stdout with progress on stderr, suppress pnpm's lifecycle banner:

```shell
pnpm --silent test:consumer:codegen -- --json
```

JSON mode writes exactly one document to stdout and sends progress and retained
or exported paths to stderr. Combine review export and retention when both
artifacts are useful:

```shell
pnpm --silent test:consumer:codegen -- \
  --json \
  --keep \
  --export-review-dir .ci-artifacts/consumer-codegen-review/current
```
