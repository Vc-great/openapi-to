# Consumer acceptance coverage matrix

This matrix assigns one canonical owner to each consumer-facing acceptance
capability. Secondary coverage is corroborating evidence, not a second source
of truth. The commands intentionally share the existing pack/install harness:
no separate consumer golden path exists.

Owner names used below:

- `openapi-to-setup.node-test` means
  `node --test scripts/openapi-to-setup.node-test.mjs`.
- `test:consumer:codegen` means `pnpm test:consumer:codegen`.
- `consumer-codegen review export` means
  `pnpm test:consumer:codegen:review`; it is an artifact export after the same
  specialist test passes, not another test layer.
- `release:smoke` means `pnpm release:smoke`, the canonical full packed
  consumer acceptance entry.
- `MCP tests` means the unit, integration, stdio, write, recovery, and E2E
  groups classified by `packages/mcp/scripts/run-test-group.mjs`.
- `repository contract` means `pnpm verify:repository-contract`.
- `A1 cross-platform` means `.github/workflows/a1-cross-platform.yml`.

| Capability | Canonical owner | Secondary coverage | Packed artifact? | External consumer? | Cross-platform? | Notes / intentional gap |
| --- | --- | --- | --- | --- | --- | --- |
| Setup package detection | `openapi-to-setup.node-test` | repository contract | No | Temporary project | Yes: A1 | Distinguishes aggregate, MCP-only, missing, and version-conflict states. |
| Setup package-manager detection | `openapi-to-setup.node-test` | A1 cross-platform | No | Temporary project | Yes: A1 | Covers declared manager, unique lockfile evidence, unknown managers, and conflicting/multiple lockfiles. |
| Setup config detection | `openapi-to-setup.node-test` | repository contract | No | Temporary project | Yes: A1 | Reads supported config bytes without executing the config; multiple candidates block. |
| Setup Codex Host detection | `openapi-to-setup.node-test` | `release:smoke` bridge | No | Temporary project | Yes: A1 | Conservative text inspection owns state inference; the bridge verifies packed runtime agreement only. |
| Setup observedStateHash | `openapi-to-setup.node-test` | `release:smoke` bridge | No | Temporary project | Yes: A1 | Binds manifest, lockfile, generation config, ignore file, Codex config, and relevant states. |
| Setup portable verified reads | `openapi-to-setup.node-test` | A1 cross-platform | No | Temporary project | Yes: A1 | `O_NOFOLLOW` where available; verified `O_RDONLY` fallback elsewhere. |
| Setup symlink/root boundary | `openapi-to-setup.node-test` | A1 cross-platform | No | Temporary project | Yes: A1 | Symlink capability may be skipped only when Windows denies symlink creation. |
| Public package pack | `release:smoke` | `test:consumer:codegen` | Yes | Yes | Linux CI | Both call the same `packReleasePackages`; release smoke owns the complete packed acceptance claim. |
| Packed dependency override | `release:smoke` | `test:consumer:codegen` | Yes | Yes | Linux CI | Both reuse `createPackedOverrides`; there is no second override implementation. |
| Aggregate-only install | `release:smoke` | publication-manifest smoke | Yes | Yes | Linux CI | Installs only `openapi-to` while forcing all transitive workspace packages to the same tarball set. |
| Installed CLI bins | `release:smoke` | `test:consumer:codegen`, A1 binary checks | Yes | Yes | Linux packed; A1 source builds on all OSes | Verifies installed `openapi` and `openapi-to`; A1 is portability evidence, not packed acceptance. |
| Installed MCP bin | `release:smoke` | MCP stdio E2E, A1 binary checks | Yes | Yes | Linux packed; MCP/A1 smoke on all OSes | Covers aggregate wrapper and independently installed MCP package path. |
| ESM/CJS exports | `release:smoke` | package unit tests | Yes | Yes | Linux CI | Tests aggregate and direct package exports from installed tarballs. |
| TypeScript package surface | `release:smoke` | package typechecks | Yes | Yes | Linux CI | Strictly compiles public imports from the installed package set. |
| Formal-plugin generation | `test:consumer:codegen` | `release:smoke` | Yes | Yes | Local/CI host | Release smoke reuses `runConsumerCodegenScenario`; it does not own a duplicate fixture suite. |
| Generated TypeScript compile | `test:consumer:codegen` | `release:smoke` | Yes | Yes | Local/CI host | Strict compile with `skipLibCheck: false` owns generated-consumer validity. |
| Generated Zod runtime | `test:consumer:codegen` | plugin tests, `release:smoke` | Yes | Yes | Local/CI host | Executes generated schemas with Zod 4. |
| Idempotent regeneration | `test:consumer:codegen` | plugin fixtures | Yes | Yes | Local/CI host | Compares the complete generated file set and bytes. |
| Drift detection and recovery | `test:consumer:codegen` | Core/CLI generation tests | Yes | Yes | Local/CI host | Injects managed-file drift, requires exit 6, regenerates, recompiles, and checks original bytes. |
| Review snapshot export | `consumer-codegen review export` | `consumer-codegen-smoke.node-test` | Derived from packed run | Yes | Local maintainer workflow | Human-review artifact only; intentionally not a separately authoritative E2E. |
| MCP stdio startup | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Yes: MCP cross-platform smoke | MCP lifecycle and protocol stdout integrity remain owned by MCP tests. |
| Tool name matrix | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Yes: MCP cross-platform smoke | Names and mode semantics matter; a count by itself is not capability evidence. |
| Tool input/output Schema | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Schema unit tests own production contracts; packed smoke verifies installed metadata. |
| Tool annotations | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Packed smoke checks read-only, destructive, and idempotent hints. |
| Target listing | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Release smoke verifies target order from installed tarballs. |
| Operation search | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Target-scoped same-operation-name isolation is covered. |
| Operation contract retrieval | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Bounded target-scoped contract retrieval is verified. |
| Dry Run | `MCP tests` | `release:smoke`, `test:consumer:codegen` CLI dry-run | Yes in secondary | Yes in secondary | Linux packed | MCP tests own Tool semantics; specialist codegen separately owns CLI no-write behavior. |
| Prepare | `release:smoke` | MCP integration/E2E | Yes | Yes | Linux packed | Canonical packed-consumer proof; MCP tests retain deeper protocol and failure-path coverage. Prepare remains write-free and separately approval-bound. |
| Apply | `release:smoke` | MCP integration/E2E | Yes | Yes | Linux packed | Canonical packed-consumer proof; MCP tests retain deeper protocol and failure-path coverage. `--allow-write` exposes capability but is not Apply approval. |
| Token replay rejection | `MCP tests` | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | The bridge does not repeat token protocol coverage. |
| planHash drift rejection | `MCP tests` | `release:smoke` current-plan binding | Yes in secondary | Yes in secondary | Linux packed | Source/config/ownership/selection drift belongs to controlled-write tests; the bridge checks only Setup evidence drift. |
| Three-state commit | MCP write/recovery tests | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Generated output, ownership, and selection state commit or roll back together. |
| Output ownership | MCP write/recovery tests | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Preserves unmanaged files and rejects stale/unsafe ownership. |
| Remote document policy | MCP integration/E2E | `release:smoke` | Yes in secondary | Yes in secondary | Linux packed | Covers operator ceilings, private hosts, redirect headers, and redaction. |
| Setup Inspector ↔ packed MCP read-only agreement | `release:smoke` bridge | `openapi-to-setup.node-test`, MCP tests | Yes | Yes | Release-smoke platform | Repository-Skill Inspector must infer read-only while the equivalent packed MCP command omits Prepare and Apply. |
| Setup Inspector ↔ packed MCP write-enabled agreement | `release:smoke` bridge | `openapi-to-setup.node-test`, MCP tests | Yes | Yes | Release-smoke platform | Repository-Skill Inspector must infer write-enabled while the equivalent packed MCP command exposes Prepare and Apply with current Schemas. |
| Consumer acceptance entrypoint and no-duplication contract | `repository contract` | bridge Node tests | No | No | Platform-neutral Node | Guards the matrix, three canonical commands, one release-smoke pack call, bridge wiring/check IDs, and forbidden duplicate golden-path patterns. |

## Boundaries and intentional gaps

`release:smoke` creates the tarballs once, reuses them for the formal-plugin
scenario and all packed package/MCP checks, and runs the Setup-to-MCP bridge in
the already installed external consumer. The bridge uses the Setup Inspector
from the exact repository checkout and the MCP runtime installed from that
checkout's tarballs. The Inspector is not claimed to ship in an npm package.

The bridge proves only:

```text
Inspector inferred mode ↔ packed MCP actual named Tool capability
```

It does not repeat formal-plugin edge cases, CLI coverage, remote policy,
Prepare/Apply transaction contents, replay, or recovery. Those remain with
their canonical owners above.

Real Agent natural-language behavior, Host trust prompts, Host restart/UI
interaction, and human review of generated code are intentionally not modeled
as deterministic automated tests. Static Skill contracts and Tool counts do
not substitute for those behaviors.
