---
name: add-cli-command
description: Add or substantially change an openapi-to CLI command while preserving text and JSON contracts, structured diagnostics, centralized exit codes, safe stdout/stderr separation, binary aliases, and integration coverage. Use for commands or options in packages/cli; do not use for compiler-only or plugin-only changes.
---

# Add an openapi-to CLI command

Read root `AGENTS.md`, `packages/cli/AGENTS.md`, `packages/cli/src/index.ts`, its
integration tests, `packages/core/src/diagnostics.ts`, and
`packages/core/src/exitCodes.ts` before editing. Follow the CLI Agent guide for
the permanent ownership, stdout/stderr, read/write, exit-code, binary-alias, and
validation invariants; this Skill adds the command-specific workflow.

## Required contract

Define before editing:

- Command name, positional inputs, option defaults, aliases, and whether a config is required.
- Text-mode audience and stable JSON envelope.
- Owning compiler/library API and any new presentation adapter.
- Diagnostics and exit-code cases, including precedence when multiple failures exist.
- Sensitive input, remote-source, output-write, and path boundaries.

## Workflow

1. Establish `git status --short` and preserve unrelated changes.
2. Register the command/options in `packages/cli/src/index.ts`; reuse Core APIs
   and the shared `CLIIO`/JSON helpers.
3. Define focused text/JSON assertions, reachable diagnostic/exit precedence,
   and before/after global-option placement before broad integration coverage.
4. Check `packages/openapi/package.json` and `bin/openapi.js` after a CLI build
   when the aggregate binary surface is affected.

## Tests

Add integration evidence for:

- `--help`, missing/invalid input, and valid text mode.
- JSON before and after the command; `JSON.parse(stdout)` without trimming banners or colors; expected stderr.
- Success plus every reachable failure class and precedence.
- Windows separators/drive-like paths where path parsing is relevant, plus macOS/Linux case behavior.
- No writes for read-only commands, dry-run, or check; no `process.exit` in libraries.
- Real built-bin smoke through both aliases when the aggregate/CLI surface changes.

Run commands that exist in manifests:

```sh
pnpm --filter @openapi-to/cli test
pnpm --filter @openapi-to/cli typecheck
pnpm --filter @openapi-to/cli build
pnpm --filter openapi-to build
```

Then run the built bin for representative success/failure/JSON cases. For generate changes, use the Codex `$run-codegen-tests` Skill; if Skill invocation is unavailable, read `.agents/skills/run-codegen-tests/SKILL.md` directly.

## Stop conditions

- JSON stdout includes logs, colors, banners, multiple documents, raw stacks, or secrets.
- A read-only/check command writes files or a clean operation deletes an unmanaged file.
- The command invents a new exit code outside the centralized map.
- A library path calls `process.exit`, or forced exit can truncate output.
- Binary aliases or built declaration/export targets disagree.

## Final report

Report command/API changes, exact text/JSON schemas, exit-code behavior, safety decisions, tests/built-bin results, binary alias results, compatibility risk, and every skipped check. Never report an unexecuted scenario as passing.
