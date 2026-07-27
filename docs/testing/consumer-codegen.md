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

By default the temporary project is removed after success or failure. Retain it
for debugging with:

```shell
pnpm test:consumer:codegen -- --keep
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
