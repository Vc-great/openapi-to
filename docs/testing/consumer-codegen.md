# Packed formal-plugin consumer code generation

Run the independent external-consumer smoke after building the repository:

```shell
pnpm build
pnpm test:consumer:codegen
```

The smoke packs every public workspace package, creates a project beneath the
operating system temporary directory, installs the `openapi-to` tarball with
tarball overrides for all aggregate dependencies, and invokes the installed
`node_modules/.bin/openapi` entry. The consumer pins the repository's exact
installed TypeScript and Zod versions while preferring the populated pnpm
store. Its local OpenAPI fixture exercises two
operations, path and query parameters, a JSON body and response, component
references, required and optional fields, enums, arrays, and nested schemas.
The aggregate package supplies `pluginTSType`, `pluginZod`, and
`pluginTSRequest`; the generated TypeScript and a consumer request stub are
then compiled in strict mode.

This is broader than a plugin unit or snapshot test because it validates the
packed aggregate export, installed CLI, config loading, cross-package plugin
dependency chain, and generated imports in an isolated project. CLI E2E tests
exercise repository workspaces rather than a newly installed tarball.
`release:smoke` reuses this exact scenario with its already packed tarballs,
alongside the package-surface, binary, and MCP checks.

There are three maintainer entry points:

```shell
pnpm test:consumer:codegen
pnpm test:consumer:codegen:keep
pnpm test:consumer:codegen:review
```

The default command is the automation-oriented validation and always cleans
its operating-system temporary workspace. `test:consumer:codegen:keep` runs
the same scenario but retains the complete temporary root, including installed
`node_modules` and packed tarballs, for command-level debugging.
`test:consumer:codegen:review` still installs and validates in the operating
system temporary directory. Only after validation, drift recovery, strict
compilation, the final current check, and byte-stable regeneration have all
passed does it atomically export a compact snapshot to
`.ci-artifacts/consumer-codegen-review/current`. The original temporary root is
then removed automatically.

The review snapshot contains the fixture, config, request stub, consumer usage,
TypeScript config, lockfile, all final generated files, the ownership manifest,
and `report.json`. It deliberately excludes `node_modules`, tarballs, pnpm
store data, transaction state, and the artificial drift used by the test.
`.ci-artifacts` is ignored by Git and review snapshots must not be committed.

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
The exported snapshot is intended for inspection and does not include
dependencies, so do not run `tsc` from it. Use the keep command when commands
must be rerun in the original installed consumer:

```shell
pnpm test:consumer:codegen:keep
```

The final output prints the absolute retained path. Inspect
`consumer/package.json`, `consumer/pnpm-lock.yaml`,
`consumer/.OpenAPI/openapi.config.ts`, `consumer/openapi.json`,
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
