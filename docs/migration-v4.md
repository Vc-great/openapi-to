# Migrating to openapi-to 4

Version 4 consolidates the compiler, CLI, official plugins, and MCP runtime into
one release line. The first release candidate is `4.0.0-rc.0`; it is intended
for migration testing and must not be treated as the stable 4.0 release.

## Installation entrypoints

Most projects need only the aggregate package:

```sh
pnpm add -D openapi-to
```

That installation provides three commands:

```text
openapi
openapi-to
openapi-to-mcp
```

`openapi` and `openapi-to` are aliases for the same CLI. `openapi-to-mcp`
starts the stdio MCP server. Advanced integrations may still install the
independent MCP package:

```sh
pnpm add -D @openapi-to/mcp
```

The independent package provides the `openapi-to-mcp` command, the
`@openapi-to/mcp` server API, and the `@openapi-to/mcp/cli` runner.
`openapi-to` intentionally does not re-export MCP server implementation APIs
from its top-level JavaScript API.

## Configure microservice targets

A Target is one independent OpenAPI input and generation boundary. Configure
separate Targets for separate microservices. If one service has multiple
documents that must remain independent, configure one Target per document.

Target names are used consistently by the CLI and MCP operation catalog. To
generate selected services, repeat `--target`:

```sh
openapi generate --target user-service
openapi generate \
  --target user-service \
  --target order-service
```

Omitting `--target` continues to generate all configured Targets. Selection is
Target-scoped, so equal operation IDs or schema names in different services do
not collide.

## Choose the output base

The default output remains managed:

```text
managed -> .OpenAPI/<output.dir>
```

An explicit Workspace output places the generated directory beneath the
configured Workspace:

```text
workspace -> <workspace>/<output.dir>
```

Both modes remain generator-managed. The writer confines paths, rejects
overlapping Target roots, and records owned files in
`.openapi-to-manifest.json`. Cleanup considers only files recorded by the prior
ownership manifest; unmanaged files are not swept on a first run.

## Review remote-input policy

Inputs may be local JSON, YAML, or YML files, or HTTP(S) documents. Remote
access is fail-closed:

- permitted hosts must match the configured `allowedHosts` policy;
- private-network destinations are denied unless trusted configuration and the
  server operator explicitly allow them;
- configured headers are retained only for the initial request and
  same-Origin redirects;
- cross-Origin redirects clear configured headers;
- HTTPS-to-HTTP redirect downgrades are rejected;
- timeout, redirect, and response-size limits remain bounded.

MCP Tool arguments cannot add headers, change the trusted configuration, or
relax remote/private-network policy.

## Make paths portable

Native Windows absolute input paths are supported. Drive-relative paths are
rejected because their meaning depends on process state. UNC and `file:`
configured inputs are also rejected.

`output.dir` must use portable relative segments that resolve safely on Linux,
macOS, and Windows. Avoid absolute paths, `..`, drive or UNC prefixes, reserved
Windows names, and segments that differ only by case. Existing output roots,
parents, and managed targets must not be symlinks.

## Configure MCP deliberately

The stdio server exposes three bounded analysis Tools without a project
configuration:

```text
openapi_validate
openapi_inspect
openapi_diff
```

A trusted Workspace-local `configPath` adds Target listing, operation
catalog/search/contract, dry-run, and check capabilities, for eight Tools total.
The configuration is executable trusted project code selected by the server
operator and cached for the server lifetime.

Supplying the trusted config and the operator-only `allow-write` grant adds the
existing Prepare/Apply pair, for ten Tools total:

```text
openapi_prepare_generation
openapi_apply_generation
```

Prepare writes nothing. It returns a bounded review plus a short-lived,
one-time token bound to the exact Target, inputs, output state, artifacts, and
plan hash. Apply accepts only the plan ID, token, and approved hash; it
re-generates, rejects stale state, and commits through the shared
lock/journal/rollback transaction writer. There is no direct-write, `force`, or
stale-plan bypass. The current boundary is one Target and one output root per
plan.

## Breaking changes to account for

- Private-network remote sources that were previously reachable implicitly are
  now blocked by default.
- Conflicting artifact paths fail deterministically instead of depending on
  plugin or filesystem write order. Case-only collisions fail on every
  platform.
- Managed cleanup is ownership-manifest based. It no longer treats an existing
  output directory as wholly generator-owned.
- CLI failures use classified non-zero exit codes. Scripts that assumed every
  failure returned the same code must be updated.
- Remote redirects no longer forward configured headers across origins, and
  HTTPS-to-HTTP downgrades fail.
- Unsafe or platform-dependent configured paths now fail validation instead of
  being interpreted differently across operating systems.

## Compatibility limits

OpenAPI 3.2 input is compatible-read with diagnosed generation gaps; this
release does not claim complete OpenAPI 3.2 support. Streamable HTTP MCP,
cross-Target Apply, operation-level CLI selective generation, automatic
service discovery, and OpenAPI document merging remain out of scope.

For MCP operating details, see [MCP operations](./mcp-operations.md), the
[security boundary](./mcp-security.md), and
[controlled-write recovery](./mcp-write-recovery.md).
