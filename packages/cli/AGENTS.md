# CLI agent guide

This file extends the root `AGENTS.md` for `packages/cli/`.

## Ownership and I/O

The CLI owns argument parsing, calls to public Core APIs, human/JSON
presentation, and centralized exit-code selection. It must not reimplement
loading, reference resolution, validation, diff semantics, artifact comparison,
or filesystem writing.

JSON mode writes exactly one directly `JSON.parse`-able document to stdout.
Diagnostics text, progress, debug output, logs, and plugin `console` output go
to stderr. Never add banners, colors, update notices, prose, or a second JSON
value to JSON stdout. Keep envelopes and array ordering deterministic, and do
not expose stacks, credentials, URL queries, or complete documents.

Use Core's `ExitCode` and diagnostic mapping. Library modules never call
`process.exit`; the awaited CLI entrypoint assigns `process.exitCode` after
output is flushed.

## Read and write boundaries

- `validate`, `inspect`, and `diff` are read-only.
- `generate --dry-run` executes compiler/plugins and compares artifacts without
  writing generated files, ownership state, or cleanup changes.
- `generate --check` is also read-only and returns the centralized outdated
  output status when disk differs.
- Plain `generate` is the only generation command that writes, and it delegates
  comparison, lock acquisition, transaction writing, clean ownership, and
  recovery to Core.
- `init` writes only the explicitly selected root configuration file under its
  existing collision policy.

The published aggregate must preserve both `openapi` and `openapi-to` aliases
through `packages/openapi/bin/openapi.js`.

## Validation

CLI changes must cover applicable cases for:

- human-readable and JSON modes, including global options before/after the
  command where supported;
- success, configuration, input/OpenAPI, plugin, outdated, and breaking-change
  exit statuses;
- exact stdout/stderr separation and `JSON.parse(stdout)`;
- help, invalid input, and no forced process termination;
- generate write, dry-run, check-current, check-outdated, and
  added/modified/deleted manifest entries;
- Windows and POSIX path forms when path parsing changes;
- both built aggregate aliases and the applicable CommonJS/ESM E2E project.

Confirm scripts in manifests, then normally run:

```sh
pnpm --filter @openapi-to/cli test
pnpm --filter @openapi-to/cli typecheck
pnpm --filter @openapi-to/cli build
```

Build the aggregate and run the applicable real E2E/built-bin smoke when the
binary surface or generation behavior changes. Use
`.agents/skills/add-cli-command/SKILL.md` for command work and
`.agents/skills/run-codegen-tests/SKILL.md` for changed generation output.
