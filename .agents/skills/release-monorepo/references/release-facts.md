# Release facts to re-verify

These facts route an investigation. Re-read the files because release configuration changes frequently.

## Current repository surfaces

- Root `package.json` is private, declares pnpm as the package manager, and provides `build`, `typecheck`, `test:vitest`, Changesets-related scripts, and release scripts.
- Published/runtime packages are under `packages/`; `packages/config-ts` and `packages/config-tsup` are marked private at the authored revision.
- Published packages commonly declare ESM/CJS entrypoints and declarations under `dist`, built with tsup.
- The `openapi-to` aggregate package depends on CLI, core, and official plugins through workspace ranges, re-exports core/official factories, and exposes both `openapi` and `openapi-to` bin aliases through `bin/openapi.js`.
- P0 adds public compiler, diagnostic, artifact/manifest/result, diff/inspect, and exit-code exports. Treat `@openapi-to/core`, `@openapi-to/cli`, and the aggregate package as direct release candidates; inspect official plugin declarations/dependency edges before deciding whether they need coordinated bumps.
- Root development policy, CI, bins, and package manifests require Node >=20. A lower runtime must not be claimed unless it has its own maintained CI and pack-install smoke lane.
- Package manifests use `workspace:*` for internal edges; never replace those values or lockfile entries manually as a release workaround.
- Package `CHANGELOG.md` files exist. Root and some packages have README files, but plugin packages do not all have package-local READMEs at this revision.
- `.changeset/config.json` is tracked. It uses public access, `main` as the base branch, workspace-protocol-aware internal dependency bumps, and one fixed-version group for all ten public packages. Private config packages are excluded by `private: true`, not `ignore`.
- Changesets are committed with feature work and may remain pending on feature branches and `main`. `verify:changeset-state:development` accepts only valid, non-empty pending changesets; the default `verify:changeset-state` and `release:check` remain strict release-candidate gates.
- `.github/workflows/version-packages.yml` uses `changesets/action@v1` after pushes to `main` to create or update one Version Packages PR through the root `version` script. It has no publish command or npm credential. The Version PR settles versions, changelogs, `.changeset/pre.json`, internal dependency metadata, and the lockfile without publishing, tagging, or creating a GitHub Release.
- `.github/workflows/version-readiness.yml` runs the strict Changesets state validator when version-state paths change in a PR. Ordinary Quality CI still runs build, typecheck, tests, changed-file lint, repository contracts, package-surface checks, and pack-install smoke while using the development Changesets gate.
- The tracked prerelease state remains in `rc` mode. Exiting prerelease mode, npm publication, dist-tag mutation, tags, and GitHub Releases require a separate explicitly authorized release operation.
- Root release readiness uses the full tracked-file `lint:ci` gate alongside `test:release-scripts`, `verify:repository-contract`, `verify:package-surface`, and `release:smoke`; local change preparation also uses `lint:changed`. The smoke script packs all public packages and installs them in a temporary consumer to verify ESM/CJS/types and both aggregate CLI aliases.
- CI on Node 20 builds, typechecks packages and root project references, runs Vitest, rejects changed-file lint warnings, verifies Changesets under the appropriate development or strict mode, and performs pack-install smoke. e2e generation runs on Linux, Windows, and macOS.

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
.changeset/*.md
.github/workflows/quality.yml
.github/workflows/e2e.yaml
scripts/lint-changed.mjs
scripts/release/verify-package-surface.mjs
scripts/release/pack-install-smoke.mjs
```

## Evidence table template

| Package | Published? | Change | Public impact | Dependents | Bump | Exports/build verified | Pack verified | Changeset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<name>` | yes/no | `<summary>` | `<contract>` | `<names>` | major/minor/patch/none | pass/fail | pass/fail | added/missing/not-needed |

## Authorization boundary

Read-only status, diff, local build/test/typecheck, and dry-run packing are preparation. Version-file mutation, lockfile mutation, changelog generation, tag creation, registry login, publication, and any push are separate state-changing steps. Perform only the subset the user explicitly authorized.
