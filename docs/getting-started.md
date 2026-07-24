# Getting started

`openapi-to` is the single recommended installation entrypoint:

- It installs the `openapi` and `openapi-to` CLI aliases.
- It exports Core plus all official generator plugins.
- It installs the `openapi-to-mcp` stdio server command.

Node.js 20 or newer is required. This repository is pinned to pnpm 10.14.0.

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

Workspace-local absolute Windows input paths are supported. Drive-relative paths (`C:openapi.yaml`), UNC paths, and configured `file:` URLs are rejected. Output segments must also be portable across Linux, macOS, and Windows; Windows device names, reserved characters, control characters, and trailing periods/spaces are rejected before generation.

See the [CLI generation guide](./cli.md) for a complete multi-document example and ownership rules, and the [capability matrix](./capability-matrix.md) before choosing a plugin or dialect.

## MCP server

The same aggregate installation provides the MCP command; no additional MCP package installation is required:

```sh
pnpm exec openapi-to-mcp --help
```

Advanced users who intentionally want only the MCP package boundary may instead install `pnpm add -D @openapi-to/mcp`; it provides the same standalone `openapi-to-mcp` command plus the `@openapi-to/mcp` and `@openapi-to/mcp/cli` programming interfaces.

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

Target `input.remote` is trusted access configuration; MCP startup remote options are operator-owned upper bounds. The effective policy uses only permissions allowed by both layers. Configured headers remain available for the initial request and same-Origin redirects, are removed on cross-Origin redirects, and are never accepted as Tool arguments. HTTPS-to-HTTP redirects are blocked.

## Repository development

Repository maintainers can install and build a source checkout before launching the source bin. This is a development/debugging workflow, not the recommended user installation:

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
