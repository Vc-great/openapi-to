# @openapi-to/core

## 4.0.0-rc.0

### Major Changes

- e373f8c: Freeze the P0 compiler and P1 Codex governance baseline. This release adds the
  OpenAPI compiler pipeline, structured diagnostics, general generated artifacts,
  validation, inspection, contract diffing, deterministic dry-run/check modes,
  safe remote loading, and the expanded CLI surface.

  The major bump records compatibility-sensitive behavior changes: private-network
  remote sources are blocked by default, conflicting artifact paths fail instead of
  depending on write order, managed output cleanup is manifest-aware, and CLI
  failures now return classified non-zero exit codes.

### Minor Changes

- 4f10867: Add optional invocation-scoped cancellation to compiler, config, plugin, artifact, and comparison APIs, and harden the read-only stdio MCP server with bounded per-tool deadlines, cancellation-safe generation queuing, stable progress, structured stderr logging, fixed evaluation corpora, performance/stress gates, and operational security documentation. Existing Core and CLI calls remain source-compatible because every new execution option is optional. The repository fixed-version group coordinates the eventual public-package minor release; no versioning or publication is performed here.
- 3e1078b: Enable operator-gated controlled Selective Apply through the existing Prepare/Apply Tools. Selective plans now issue kind- and owner-bound one-time tokens, recompile and revalidate the frozen operation projection at Apply time, and atomically commit generated artifacts, ownership, and persistent selection through Core's generation-state transaction. Full generation and controlled full Apply semantics are unchanged.
- ce3f9f2: Add a deterministic Operation Catalog with bounded lexical search and single-operation contract summaries, plus trusted-target MCP discovery, search, and contract Tools with process-local compilation caching.
- 862f0ae: Add shared microservice Target selection and generator-managed Workspace output
  roots. The CLI now accepts repeatable `generate --target` options while Core,
  CLI, MCP, and packed-package smoke workflows share deterministic Target naming,
  output resolution, overlap protection, and write preflight.

  Preserve and verify JSON, YAML, YML, and HTTP(S) OpenAPI inputs across
  multi-target CLI and MCP workflows. Default output remains
  `.OpenAPI/<output.dir>`; opting into `output.base: "workspace"` keeps ownership
  inside the selected project output root while Operation selection remains in
  `.OpenAPI/selections`.

- b4130f7: Add a versioned deterministic operation Selection model and additive Selective Prepare. Prepare unions persisted and requested operations, binds selection/projection/artifacts into a review-only plan, and writes nothing. Selected plans cannot Apply in this phase, while full Prepare/Apply and existing write authority remain unchanged.
- f0a38b1: Add operator-gated, two-phase MCP generation writes through a short-lived HMAC-bound Prepare plan and an exact one-time Apply. Apply re-generates and rejects stale config, source, reference, output, manifest, or file state before committing only managed artifacts.

  Core gains public source/config fingerprints plus a shared cross-process output lock and transaction writer with same-filesystem staging, a stable ownership manifest, rollback, crash journal recovery, commit cancellation/deadline semantics, and fail-closed TOCTOU checks. The CLI keeps its command and output contract while using the same transaction/lock path, so its direct SemVer impact is patch; the fixed-version group will coordinate the eventual release version. No version or publication command is run by this change.

- b4130f7: Add deterministic projected OpenAPI compilations with exact operation selection, transitive named-component closure, and selective `openapi_generate_dry_run` previews. Omitted scope keeps full generation unchanged, and selective previews remain nonpersistent and add no write authority.
- ca8f1cb: Add the independent read-only stdio MCP server with bounded validate, inspect,
  diff, generation dry-run, and generation check Tools. Core gains opt-in local
  file-root confinement for entry and transitive reference reads plus the shared
  trusted configuration loader; the CLI now reuses that loader without changing
  its command contract.
- 235162c: Add a bounded controlled sidecar-state abstraction to the shared Core transaction writer, with checksummed journal v2 state operations, physical preconditions, same-parent staging and backup, three-state rollback, and lock-triggered crash recovery. Existing no-state full writes retain journal v1 and the existing full Prepare/Apply contract.

  Selective plan binding now includes the previous selection physical snapshot and exact desired serialized-byte hash and length. Selective Prepare remains review-only with no returned token, selective Apply remains disabled before locks and writes, and no new MCP write authority or Tool is added.

### Patch Changes

- 642c834: Align published package metadata, documented capabilities, CLI aliases, MCP Host setup, and release verification with the shipped package surfaces.
- 6aac98f: Harden remote loading by clearing trusted request headers on cross-Origin
  redirects and rejecting HTTPS-to-HTTP downgrades. Merge trusted Target remote
  requirements with MCP operator ceilings instead of replacing them; the MCP
  server API can now supply optional remote timeout, response-size, and redirect
  upper bounds while Tool schemas remain unchanged.

  Classify native Windows absolute inputs without treating drive letters as URL
  schemes, reject drive-relative and UNC configured inputs, and require portable
  output segments across Linux, macOS, and Windows. Extend cross-platform CI,
  stable lint coverage, package-surface checks, and real tarball consumers for the
  three aggregate binaries and shared MCP CLI subpath.

## 3.2.2

### Patch Changes

- fix bug

## 3.2.1

### Patch Changes

- fix bug

## 3.2.0

### Minor Changes

- feat msw

## 3.1.1

### Patch Changes

- fix bug

## 3.1.0

### Minor Changes

- feature: vue query

## 3.0.1

### Patch Changes

- fix bug

## 3.0.0

### Major Changes

- fix bug
- fix: bug
- update
- refactor

## 3.0.0-alpha.5

### Major Changes

- fix: bug

## 3.0.0-alpha.4

### Major Changes

- fix bug

## 3.0.0-alpha.3

### Major Changes

- refactor

## 3.0.0-alpha.2

### Major Changes

- fix

## 2.4.0-alpha.1

### Patch Changes

- fix bug

## 2.4.0-alpha.0

### Minor Changes

- update all

## 2.3.0

### Minor Changes

- generate swr

## 2.2.0

### Minor Changes

- fix bug

## 2.1.0

### Minor Changes

- optimize request type zod

## 2.0.0

### Major Changes

- [`e519466`](https://github.com/Vc-great/openapi-to/commit/e5194667c7416e817a498d592c357a7ae9c05f22) Thanks [@Vc-great](https://github.com/Vc-great)! - v2

- [`a39a900`](https://github.com/Vc-great/openapi-to/commit/a39a9002dda434d8a65768f55c69875ed8ad1eea) - fix bug

- 2.0

- [`367be25`](https://github.com/Vc-great/openapi-to/commit/367be252aa434487c09c4566e77792839867b509) - fix bug

- [`7fd9e58`](https://github.com/Vc-great/openapi-to/commit/7fd9e58417ef5563dedf945fbb030b70b8b09bd6) - rc

## 2.0.0-rc.5

### Major Changes

- rc

## 2.0.0-alpha.4

### Major Changes

- fix bug

## 2.0.0-alpha.3

### Major Changes

- fix bug

## 2.0.0-alpha.2

### Major Changes

- v2
