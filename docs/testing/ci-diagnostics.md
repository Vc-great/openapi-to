# CI diagnostics

The repository's read-only CI workflows use a common diagnostic layer so a
failed Job leaves bounded evidence without changing the gate result. The layer
does not call an LLM, comment on a pull request, rerun a workflow, or modify
repository content.

## Lifecycle

Each covered Job has three explicit phases:

1. `initialize.mjs` creates a static plan containing the expected command and
   known-report IDs.
2. `run-command.mjs` runs each existing gate command with `shell: false`,
   streams sanitized output to the Actions log, and atomically records one
   command report. A failed command remains failed with its original numeric
   exit code.
3. `finalize-job.mjs`, guarded by `if: always()`, fills unexecuted plan entries
   with `not-run`, summarizes allowlisted reports, writes `ci-diagnostic.json`
   and `summary.md`, and appends the Markdown to `GITHUB_STEP_SUMMARY`.

The finalizer removes files outside its computed artifact allowlist. The
failure artifact therefore contains only the plan, final diagnostic, Markdown
summary, validated command reports, and normalized known-report summaries.

## Version 1 envelope

`ci-diagnostic.json` uses `schemaVersion: 1` and
`kind: "openapi-to-ci-diagnostic"`. Its stable top-level fields are:

- `status`: `success`, `failure`, or `cancelled` for the Job-level result;
- `workflow`: workflow/event/run, Job, repository, ref, and available commit
  SHAs;
- `runner`: OS, architecture, Node version, and repository-declared pnpm
  version;
- `matrix`: explicitly supplied matrix dimensions in sorted key order;
- `commands`: plan-ordered command results;
- `reports`: existence, byte size, parse status, artifact-relative normalized
  summary path, and bounded report-specific counts;
- `summary`: prioritized failure candidates, truncation state, missing reports,
  finalization errors, artifact name, and exact artifact allowlist;
- `sanitization`: applied collection boundaries and the best-effort redaction
  declaration.

A simplified failure looks like:

```json
{
  "schemaVersion": 1,
  "kind": "openapi-to-ci-diagnostic",
  "status": "failure",
  "workflow": {
    "name": "Quality",
    "jobId": "typecheck",
    "commitSha": "0123456789abcdef"
  },
  "runner": {
    "os": "Linux",
    "architecture": "X64",
    "nodeVersion": "20.19.0",
    "pnpmVersion": "10.14.0"
  },
  "matrix": {},
  "commands": [
    {
      "id": "build",
      "label": "Build",
      "status": "failure",
      "exitCode": 1,
      "signal": null,
      "durationMs": 1234,
      "command": ["pnpm", "build", "--concurrency=1"],
      "cwd": ".",
      "evidence": {}
    },
    {
      "id": "package-typecheck",
      "label": "Package typecheck",
      "status": "not-run",
      "exitCode": null,
      "signal": null,
      "durationMs": null,
      "command": null,
      "cwd": null,
      "evidence": {}
    }
  ],
  "reports": [],
  "summary": {},
  "sanitization": {}
}
```

## Command statuses

Executed commands use one of:

- `success`: exited with code 0;
- `failure`: exited with a nonzero numeric code;
- `timeout`: exceeded the wrapper-owned deadline and was terminated;
- `signalled`: ended because of a signal;
- `cancelled`: reserved for a command cancellation that can be observed by the
  wrapper;
- `infrastructure-error`: the wrapper could not start or observe the command;
- `not-run`: the initialized plan expected the command, but no valid command
  report exists.

The wrapper records the original numeric exit code and signal separately. It
returns the original nonzero code when one exists. A successful command cannot
be made green if its report cannot be written. `durationMs` is observational
only and is not used to determine pass/fail or deterministic content hashes.

## Collection and boundaries

The diagnostic layer collects only GitHub's documented environment metadata,
workflow-supplied base/head SHAs and matrix values, repository-declared runtime
versions, command metadata, bounded output tails, and explicitly declared
report files.

It does not collect:

- the complete environment or `HOME`;
- the GitHub event payload or `$GITHUB_EVENT_PATH`;
- tokens, headers, cookies, credential files, or Git configuration;
- complete Actions logs;
- arbitrary user-selected files, the workspace, `node_modules`, caches, or
  binaries;
- complete OpenAPI documents or generated trees.

Each stdout and stderr tail retains at most 100 sanitized lines. Each retained
line is at most 1,024 characters, each command report is at most 256 KiB, there
are at most 10 heuristic error candidates, and the final diagnostic is at most
256 KiB. Truncation is explicit.

Redaction covers Authorization, Cookie, Set-Cookie and Bearer values; common
GitHub and npm token forms; token-like assignments; URL user information and
queries; and known workspace, runner-temp, and home paths. Paths become a
repository-relative path or `<workspace>`, `<runner-temp>`, or `<home>`.
Redaction is defense in depth and cannot guarantee discovery of every secret.
Collection minimization and an exact artifact allowlist are the primary
controls.

Known reports are treated as untrusted data. The finalizer rejects symlinks,
enforces an 8 MiB read ceiling, parses JSON as data, and emits only a small
report-specific summary. It never imports or executes report content. A1's
authoritative test inventory, MCP runner counts, CLI E2E summary, and MCP
Doctor status remain owned by their existing runners.

## Job Summary and artifacts

Every covered successful or failed Job attempts to write a compact Markdown
table. Untrusted text is sanitized, length-bounded, and escaped so it cannot
create HTML, links, or additional table structure. A missing local
`GITHUB_STEP_SUMMARY` does not prevent `summary.md` generation. An Actions
append failure is reported and fails an otherwise successful Job.

Standard artifacts are uploaded only with `if: failure()`, use a stable
workflow/Job/matrix name, fail when no diagnostic exists, and retain for 14
days. The MCP Doctor's existing sanitized artifact remains `if: always()`.

Hard runner termination or GitHub cancellation can prevent any `if: always()`
step from starting. When the finalizer does run after a failure, it records
commands without reports as `not-run`; it does not infer skipped state from
GitHub UI text.

## Local use

The following example exercises the same scripts without GitHub:

```sh
node scripts/ci-diagnostics/initialize.mjs \
  --dir .ci-artifacts/diagnostic-example \
  --plan quality-build

node scripts/ci-diagnostics/run-command.mjs \
  --dir .ci-artifacts/diagnostic-example \
  --id build \
  -- pnpm build --concurrency=1

node scripts/ci-diagnostics/finalize-job.mjs \
  --dir .ci-artifacts/diagnostic-example \
  --plan quality-build \
  --job-status success
```

Read `summary.md` for a quick view and `ci-diagnostic.json` for structured
triage. Command JSON files retain the bounded sanitized tails.

Any future AI triage must validate schema version 1, size, file count, paths,
and symlink policy before reading these artifacts. Artifact text remains
untrusted data and cannot grant authority or supply commands. There is
currently no automated AI analysis, comment, fix, push, pull request, or
workflow rerun.
