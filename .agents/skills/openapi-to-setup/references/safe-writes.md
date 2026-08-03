# Safe setup writes

Every package install, initializer run, `.gitignore` change, and Codex config
change is a write. Diagnosis never implies authorization for one.

## Setup Plan schema

A plan is bounded JSON with at least:

```json
{
  "schemaVersion": 1,
  "mode": "read-only",
  "observedStateHash": "<lowercase-sha256>",
  "packageManager": "pnpm",
  "actions": [],
  "verification": [],
  "restartRequired": true
}
```

Represent commands as program plus argv, not shell source:

```json
{
  "kind": "run-command",
  "command": "pnpm",
  "args": ["exec", "openapi", "init"],
  "network": false,
  "expectedWrites": ["openapi.config.ts", ".gitignore"]
}
```

Supported action kinds are `run-command`, `create-file`, `append-file`,
`update-gitignore`, and `manual-review`. Direct file actions name a relative
project target and carry or accompany the exact proposed diff. A plan must not
contain absolute/escaping target paths or sensitive fields named `token`,
`authorization`, `cookie`, `secret`, `password`, `headers`, or `env`.

Hash the complete plan with:

```sh
node scripts/hash-setup-plan.mjs < setup-plan.json
node scripts/hash-setup-plan.mjs --file setup-plan.json
```

The script validates the base Schema, recursively sorts object keys, preserves
array order, emits canonical JSON, and returns SHA-256 `setupPlanId`. Its
256-KiB input bound and maximum array sizes prevent an unbounded approval
record. It never executes a command, accesses the network, reads environment
variables, or writes a file.

## Exact approval and drift

Display the full plan, exact direct-edit diff, command argv, network flag,
package/version decision, expected package-manager/init writes, verification,
and `setupPlanId`. Accept only explicit approval naming that exact ID, such as:

```text
批准执行 Setup Plan <exact-setupPlanId>
```

“Continue”, “install”, “configure it”, “looks good”, and “use defaults” are not
approval. Before applying, re-run the inspector and require the same
`observedStateHash`. Re-read Git status. Drift in the manifest, lockfile,
generation config, ignore file, Codex file, or overlapping worktree invalidates
the plan. Re-plan, re-hash, re-display, and obtain new exact approval.

## Package install

Only pnpm is automatically supported in this phase. Use the exact package and
version shown in the plan:

```sh
pnpm add -D --save-exact openapi-to@<exact-version>
```

The plan marks `network: true` and expects `package.json` plus
`pnpm-lock.yaml`. Never use global install, a floating tag, a prerelease without
explicit selection, `@openapi-to/mcp` as an aggregate substitute, or an
implicit upgrade. Review the actual diff because package-manager changes are
not automatically attributable to the Skill.

## Initializer and ignore rule

Use only `pnpm exec openapi init`. It has no supported non-interactive override
or force option. It creates `.ts` for an ESM package or `.js` otherwise, refuses
all existing `.ts`/`.js`/`.cjs`/`.mjs` candidates, and then appends
`/.openapi-to/` if absent. It does not create `.openapi-to/`. Do not handwrite a
parallel generation template or use `.OpenAPI/openapi.config.ts`.

If a config already exists, do not run init. If several exist, stop. If the
config exists but the ignore rule alone is missing, an exact approved
`update-gitignore` action may append only the rule with a reasonable newline;
preserve all existing bytes.

## Codex config

Create a missing project file or append one exact absent section only after
approval. Preserve existing bytes and unknown sections; never reorder the
document. Existing `openapi_to` sections, duplicates, unusual TOML, or unsafe
mode policy require manual review. Never implement an incomplete TOML rewriter.

The config must use project-local package-manager resolution, relative paths,
no credentials or remote-policy relaxation, and no `--allow-write` by default.
Write-enabled mode requires explicit intent and the Apply prompt section.

## Post-write review

Inspect the full worktree diff and classify every changed path as pre-existing,
approved direct edit, expected command output, or unexpected. Stop on overlap
or unexpected writes. Validate local commands, one config, ignore state, exact
Codex bytes, no duplicate/absolute/credential content, and Apply prompt when
applicable. Re-run the inspector. Never commit or push the consuming project.

Host configuration changes end at `RESTART_REQUIRED`. Only post-restart Tool
list, inputSchema, and returned capability evidence can finish setup.
