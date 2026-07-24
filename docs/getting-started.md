# Getting started

`openapi-to` has two local entrypoints:

- `openapi-to` installs the `openapi` and `openapi-to` CLI aliases and exports Core plus the official generator plugins.
- `@openapi-to/mcp` installs the independent `openapi-to-mcp` stdio server.

Both require Node.js 20 or newer. This repository is pinned to pnpm 10.14.0.

## CLI

Install the aggregate package:

```sh
pnpm add -D openapi-to
```

The binary names are aliases:

```sh
pnpm exec openapi --help
pnpm exec openapi-to --version
pnpm exec openapi validate ./openapi.yaml
pnpm exec openapi inspect ./openapi.yaml --json
pnpm exec openapi diff ./old.yaml ./new.yaml --json
pnpm exec openapi generate --dry-run --json
```

Run `pnpm exec openapi init` to create a starting configuration. Generation discovers `.OpenAPI/openapi.config.js`, `.cjs`, or `.ts`; validation, inspection, and diff do not require a generation config.

For microservices, give each OpenAPI document a stable Target name and independent output root. `pnpm exec openapi generate` generates all Targets; repeat `--target <name>` to select one or more. Local JSON/YAML/YML and policy-constrained HTTP(S) inputs use the same Core loader. Managed output remains below `.OpenAPI` by default, while `output.base: 'workspace'` places generator-managed code directly below the project root.

See the [CLI generation guide](./cli.md) for a complete multi-document example and ownership rules, and the [capability matrix](./capability-matrix.md) before choosing a plugin or dialect.

## MCP server

Install the MCP package in the Workspace that the Host will open:

```sh
pnpm add -D @openapi-to/mcp
pnpm exec openapi-to-mcp --help
```

The safe default is local stdio and no writes:

```sh
pnpm exec openapi-to-mcp --workspace-root .
```

A trusted project config adds read-only catalog and generation preview/check Tools:

```sh
pnpm exec openapi-to-mcp --workspace-root . --config ./.OpenAPI/openapi.config.ts
```

`--allow-write` additionally exposes the existing Prepare/Apply Tools. It does not bypass Host approval:

```sh
pnpm exec openapi-to-mcp --workspace-root . --config ./.OpenAPI/openapi.config.ts --allow-write
```

Choose the Host-specific configuration:

- [Codex](./codex-mcp.md)
- [Claude Code](./ai-hosts/claude-code.md)
- [Cursor](./ai-hosts/cursor.md)
- [Generic stdio Host](./ai-hosts/generic-stdio.md)

All Hosts share the same [security boundary](./mcp-security.md) and [troubleshooting guide](./troubleshooting.md).

## Repository development

From a checkout, install and build before launching the source bin:

```sh
pnpm install
pnpm build
node packages/mcp/bin/openapi-to-mcp.js --workspace-root .
```

Repository-only health and Inspector launchers are not published in the npm package:

```sh
pnpm mcp:check
pnpm --silent mcp:check -- --json
pnpm mcp:inspect
pnpm mcp:inspect -- --allow-write
```

Inspector is a foreground, authenticated localhost manual-review surface. It is not a CI gate and does not replace the automated stdio, controlled-write, recovery, or performance tests.
