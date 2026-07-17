# Release facts to re-verify

These facts route an investigation. Re-read the files because release configuration changes frequently.

## Current repository surfaces

- Root `package.json` is private, declares pnpm as the package manager, and provides `build`, `typecheck`, `test:vitest`, Changesets-related scripts, and release scripts.
- Published/runtime packages are under `packages/`; `packages/config-ts` and `packages/config-tsup` are marked private at the authored revision.
- Published packages commonly declare ESM/CJS entrypoints and declarations under `dist`, built with tsup.
- The `openapi-to` aggregate package depends on CLI, core, and official plugins through workspace ranges and exposes the `openapi` bin.
- Package manifests use `workspace:*` for internal edges; never replace those values or lockfile entries manually as a release workaround.
- Package `CHANGELOG.md` files exist. Root and some packages have README files, but plugin packages do not all have package-local READMEs at this revision.
- Root Changesets dependencies/scripts exist, but no tracked `.changeset/config.json` was found at the authored revision. This blocks a normal Changesets release until explicitly resolved.
- CI builds, typechecks, tests, and lints; e2e builds then generates in `e2e/common` and `e2e/module` on multiple operating systems.

## Files to inspect

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
turbo.json
tsconfig.json
packages/*/package.json
packages/*/tsup.config.ts
packages/*/CHANGELOG.md
packages/*/README.md (where present)
packages/openapi/src/index.ts
packages/openapi/bin/openapi.js
.changeset/config.json (only if it exists)
.github/workflows/quality.yml
.github/workflows/e2e.yaml
```

## Evidence table template

| Package | Published? | Change | Public impact | Dependents | Bump | Exports/build verified | Pack verified | Changeset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<name>` | yes/no | `<summary>` | `<contract>` | `<names>` | major/minor/patch/none | pass/fail | pass/fail | added/missing/not-needed |

## Authorization boundary

Read-only status, diff, local build/test/typecheck, and dry-run packing are preparation. Version-file mutation, lockfile mutation, changelog generation, tag creation, registry login, publication, and any push are separate state-changing steps. Perform only the subset the user explicitly authorized.
