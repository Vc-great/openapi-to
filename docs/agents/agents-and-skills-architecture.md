# AGENTS and Skills architecture

This document records the repository's Agent-rule and Skill architecture. It is
an audit aid, not an instruction source: current `AGENTS.md`, selected
`SKILL.md`, manifests, code, and tests remain authoritative.

## Responsibility split

`AGENTS.md` stores stable constraints for a directory tree: ownership,
architecture, compatibility, safety, allowed scope, and durable validation
requirements. A child file adds or explicitly overrides rules for its subtree.
Unmodified ancestor rules remain in force.

`SKILL.md` stores a repeatable task workflow: inputs, investigation sequence,
implementation decisions, test selection, failure handling, stop conditions,
and reporting. A Skill may point back to stable Agent rules but must not copy
their complete architecture.

Use one primary workflow for a task. General repository changes use
`implement-and-review`; domain Skills assist it. Existing Actions failures and
release preparation use their specialized primary Skills. Pure analysis does
not load a write-oriented workflow.

## Rule discovery boundary

Agent discovery starts at the current repository root and uses
`git ls-files '*AGENTS.md'`, or an equivalent Git-tracked repository-scoped
query. It does not scan a parent directory, sibling repository, other worktree,
dependency tree, or untracked file. An untracked `AGENTS.md` is not a formal
repository rule source. Failure of Git discovery is a blocker, not permission
to fall back to a filesystem scan.

## Rule inheritance graph

```text
AGENTS.md
├── .github/AGENTS.md
├── packages/cli/AGENTS.md
├── packages/core/AGENTS.md
└── packages/mcp/AGENTS.md
```

Files outside those four subtrees inherit only root `AGENTS.md`. For a file
under a governed subtree, read root and the closest child. A deeper rule wins
only when it states an explicit override. An irreconcilable conflict blocks
the affected edit.

## AGENTS audit

### `AGENTS.md`

- Scope: the complete repository.
- Adds: product purpose, package ownership, evidence precedence, runtime,
  deterministic generation, worktree/scope safety, global input and path
  security, release/external-write authority, multi-agent ownership, Skill
  routing, and truthful completion.
- Override: none; it is the root.
- Allowed changes: the smallest task-authorized source, tests, fixtures,
  documentation, exports, and release metadata.
- Prohibited changes: unrelated refactors/upgrades, unsafe input execution,
  generated-output masking, and unauthorized external writes.
- Validation/reporting: narrowest sufficient checks, complete diff review,
  P0/P1 closure, fresh final Git state, and explicit
  `PASS`/`FAIL`/`SKIPPED`.
- Audit result: retained stable policy; added explicit inheritance, unique
  routing, multi-agent write ownership, and completion truthfulness. Detailed
  implementation/review steps live in `implement-and-review`.

### `packages/core/AGENTS.md`

- Scope: Core compiler, diagnostics, plugin orchestration, artifacts,
  comparison, and writer.
- Inherits: all root rules.
- Adds: pipeline and representation ownership, diagnostic ownership, plugin
  scheduling/state isolation, artifact/writer invariants, Core validation
  gates, and generator-related Skill routing.
- Override: none.
- Product boundary: CLI, MCP, and plugins call Core instead of reimplementing
  semantics or writing.
- Audit result: retained. Its pipeline, concurrency, artifact, and transaction
  constraints are stable subsystem facts rather than a one-off workflow.

### `packages/cli/AGENTS.md`

- Scope: CLI parsing, Core invocation, presentation, and exit selection.
- Inherits: all root rules.
- Adds: JSON stdout purity, stderr diagnostics, centralized exit codes,
  read/write command boundaries, binary aliases, and CLI validation gates.
- Override: none.
- Product boundary: the CLI does not own compilation, comparison, or writing.
- Audit result: retained. It is concise and does not duplicate root policy.

### `packages/mcp/AGENTS.md`

- Scope: the independently published stdio MCP adapter.
- Inherits: all root rules.
- Adds: protocol framing, stable schemas/results, startup authority, Tool
  matrix, cancellation, Prepare/Apply security, transaction integration, test
  layers, and explicit feature exclusions.
- Override: none.
- Product boundary: MCP calls public Core APIs and cannot broaden startup
  authority or add a parallel writer.
- Audit result: retained. The detailed security constraints are durable
  protocol invariants; task sequencing remains in MCP Skills.

### `.github/AGENTS.md`

- Scope: workflows and local/reusable Actions.
- Inherits: all root rules.
- Adds: gate integrity, permissions, fork/secret boundaries, artifact
  sanitization, privileged-trigger safety, Version Packages meaning, and
  cross-platform shared-Action requirements.
- Override: none.
- Product boundary: repository automation cannot hide failures or acquire
  incidental AI/write authority.
- Audit result: simplified. Failure-classification and step-by-step workflow
  review moved to `fix-github-actions`; hypothetical AI analysis/write-back
  design was removed. Stable security and integrity constraints remain.

No AGENTS file changes product runtime behavior. No child duplicates the root
workflow lifecycle.

## Skill layers and audit

### Primary orchestration

| Skill | Trigger and responsibility | Audit action |
| --- | --- | --- |
| `implement-and-review` | An authorized feature, bug fix, refactor, CI/configuration change, documentation change, or cross-file implementation needing validation and review closure | Added as the only general primary. Defines discovery, classification, scope lock, implementation, focused validation, full diff review, P0/P1/P2 grading, a three-round repair limit, completion gate, and fresh Git reporting. Excludes pure/read-only and specialized release/review-comment work. |
| `fix-github-actions` | An existing failed Actions check or suspected workflow regression | Retained as a specialized primary. It owns run/log evidence and failure classification, not general product refactors, workflow redesign, release, or unauthorized reruns. |
| `release-monorepo` | Release planning or publication-readiness verification | Retained as a specialized primary. It prepares evidence and a plan; publication, push, and tags still require exact authorization. |

### Domain workflows

| Skill | Trigger and responsibility | Overlap decision |
| --- | --- | --- |
| `add-cli-command` | Add or substantially change a command/option under `packages/cli` | Supports `implement-and-review`; CLI ownership and stream invariants stay in CLI AGENTS. |
| `add-mcp-tool` | Add or substantially change a read-only MCP Tool | Supports `implement-and-review`; refuses write Tools and broader transports/auth/LLM scope. |
| `add-mcp-write-tool` | Extend or repair existing Prepare/Apply generation | Supports `implement-and-review`; composes `add-mcp-tool` protocol requirements without taking over arbitrary MCP work. |
| `add-openapi-plugin` | Add a plugin package or a substantial output mode | Supports `implement-and-review`; does not own parser-only, CLI, release-only, or documentation-only work. |
| `fix-codegen-regression` | Repair an observed generated-code/file-set/import/type/determinism defect | Supports `implement-and-review`; delegates output verification to `run-codegen-tests` instead of duplicating it. |
| `upgrade-openapi-support` | Change Swagger/OpenAPI dialect or JSON Schema semantics | Supports `implement-and-review`; excludes generator-only presentation changes. |

### Validation helper

| Skill | Trigger and responsibility | Overlap decision |
| --- | --- | --- |
| `run-codegen-tests` | Validate a change that may alter generated output or decide whether a fixture/snapshot change is correct | Retained as a helper. It validates output and idempotency but does not diagnose or implement the owning fix. |

All ten Skills have a unique directory-matching name, specific positive and
negative triggers, a required `agents/openai.yaml`, explicit inputs or
preconditions, bounded modification authority, validation guidance, failure or
stop handling, and a completion/report boundary. Domain Skills may mention
release classification, but only `release-monorepo` owns release readiness.
None grants commit, push, tagging, publication, reruns, or other external
writes without user authorization.

## Contract-verified Skill roles

Tracked Skill count: `10`.

This fixed table is the architecture document's machine-validated role
inventory. The contract compares it with both Git-tracked Skill entrypoints and
the root routing table; Skill prose does not assign a role.

| Skill | Contract role |
| --- | --- |
| `implement-and-review` | general-primary |
| `fix-github-actions` | specialized-primary |
| `release-monorepo` | specialized-primary |
| `add-cli-command` | domain-support |
| `add-mcp-tool` | domain-support |
| `add-mcp-write-tool` | domain-support |
| `add-openapi-plugin` | domain-support |
| `fix-codegen-regression` | domain-support |
| `upgrade-openapi-support` | domain-support |
| `run-codegen-tests` | validation-helper |

## Routing table

| Request | Primary | Supporting |
| --- | --- | --- |
| General implementation or bug fix | `implement-and-review` | Only the matching domain/validation Skill |
| CLI command/option | `implement-and-review` | `add-cli-command`; add `run-codegen-tests` only if output changes |
| Read-only MCP Tool | `implement-and-review` | `add-mcp-tool` |
| MCP Prepare/Apply | `implement-and-review` | `add-mcp-write-tool` and its declared MCP/Core references |
| New/substantial plugin | `implement-and-review` | `add-openapi-plugin`, then `run-codegen-tests` |
| Generated-output regression | `implement-and-review` | `fix-codegen-regression`, then `run-codegen-tests` |
| Dialect/schema semantics | `implement-and-review` | `upgrade-openapi-support`, then `run-codegen-tests` |
| Existing Actions failure | `fix-github-actions` | Owning package Skill only when evidence identifies product code |
| Release preparation | `release-monorepo` | `run-codegen-tests` only for affected generator output |
| Pure explanation/analysis/status | none | Read applicable AGENTS and source only |
| Commit/push/Draft PR | Current implementation primary remains unchanged | Use the host publication workflow after explicit authorization |

This prevents a validation helper, release workflow, or publication workflow
from taking over implementation.

The root `AGENTS.md` `## Skill routing` table is the unique machine-validated
routing source. Its lightweight parser accepts only the repository's two-column
Markdown subset; it is not a general Markdown parser. Every Git-tracked Skill
must occur in that table exactly once, with the role above. Duplicate, missing,
unknown, untracked, malformed, multi-path, or role-mismatched rows fail the
repository contract. A Skill mentioned elsewhere in prose does not count as a
route.

## `implement-and-review` lifecycle

```text
discover Git-tracked repository rules
  -> require a clean worktree or establish an authorized isolation boundary
  -> classify one primary domain
  -> record task base SHA, initial Git state, scope, and authority
  -> plan
  -> implement
  -> focused validation
  -> discover and fully review task-created untracked text files
  -> review unstaged/staged and task-base-to-current-tree diff
  -> review task-base-to-HEAD and untracked files again after commit
  -> grade P0/P1/P2
  -> repair in-scope P0/P1
  -> rerun affected validation and complete review (maximum three rounds)
  -> re-read final Git state
  -> READY, or NOT READY with blockers
```

P0 covers security, data corruption/loss, release blockers, and severe
regressions. P1 covers definite bugs, important compatibility defects,
critical test gaps, and incorrect safety/error boundaries. P2 is a
non-blocking quality improvement. The workflow repairs all P0 and in-scope P1.
It handles only low-risk, tightly scoped P2 findings.

The three-round cap prevents unproductive churn; it never converts unresolved
P0/P1 into success. Each round must produce a new finding or validation result.
Unrelated P2 and broad architectural follow-ups remain outside the diff.

The task base is the immutable `git rev-parse HEAD` recorded before editing; it
is not automatically `origin/main`. Complete review includes unstaged and
staged changes, the task base to the current working tree, and the two-dot task
base to `HEAD` tree change. After a commit, an empty ordinary `git diff` cannot
hide the task: the task-base-to-HEAD diff is reviewed again together with fresh
status, branch, HEAD, log, and untracked-file evidence.

A clean worktree is the ordinary write-task default. Pre-existing changes are
recorded and preserved, not assumed to be agent work. Unrelated changes favor a
clean isolated worktree; overlapping targets block editing without explicit
authorization. If isolation is unavailable, the task-base-to-current-tree view
is a combined diff and cannot be wholly attributed to the agent. This is a
conservative ownership boundary, not arbitrary patch attribution.

Untracked discovery uses `git ls-files --others --exclude-standard`. Every
task-created text file is size-checked and read in full; unexpected or
unreviewed files prevent readiness. Staging uses explicit authorized paths,
followed by a complete cached stat, whitespace, and content review.

Completion gates differ by authority. All tasks re-check the request, separate
fact from inference, report limitations and external operations, and avoid
unauthorized writes. Read-only analysis inspects only necessary evidence and
does not require build, test, or diff ceremony unless needed for the answer.
Write tasks record the task base, validate the change, close in-scope P0/P1,
and review the complete task diff. Discovering a P1 during a read-only task
does not automatically authorize a repair.

## Real-task Pilot PR gate

```text
Draft PR
  -> local validation complete
  -> autonomous review complete
  -> repair P0/P1
  -> push the latest commit
  -> Ready for review
  -> wait for remote required checks
  -> human review of the PR diff
  -> user decides whether to merge
```

Local `PASS` is not remote CI `PASS`; name the successful remote workflow or
check and commit SHA before reporting remote success. `Draft` status is not
completed remote acceptance. Query checks after the PR becomes Ready for
review. If check evidence is absent, unavailable, or the repository has no
verified required-check policy, report `REMOTE CI UNVERIFIED`, not `PASS`.
Only the user may decide whether to merge; this Pilot never performs the merge.

## Real-task routing validation

### Small CLI exit-code bug

- Rules: root plus `packages/cli/AGENTS.md`.
- Primary: `implement-and-review`.
- Support: `add-cli-command`; `run-codegen-tests` only if generation changes.
- Skipped: MCP, plugin, release, and Actions Skills.
- Authority: CLI source/test writes only; no public API or external write
  unless separately requested.
- Gate: focused failing regression, CLI test/typecheck/build as applicable,
  complete diff review, no P0/P1.

### Optional filter on an existing read-only MCP Tool

- Rules: root plus `packages/mcp/AGENTS.md`; add Core rules only if a Core API
  must change.
- Primary: `implement-and-review`.
- Support: `add-mcp-tool`.
- Skipped: `add-mcp-write-tool`, because the request is read-only.
- Authority: schema/handler/tests/docs within the stable startup boundary.
- Gate: unit/integration/stdio and Doctor when registration/schema visibility
  changes, complete diff review, no P0/P1.

### Cross-platform GitHub Actions failure

- Rules: root plus `.github/AGENTS.md`, and the owner package rules if source is
  implicated.
- Primary: `fix-github-actions`.
- Support: an owning domain Skill only after log/reproduction evidence.
- Skipped: general `implement-and-review` as primary; release remains out.
- Authority: minimal owner fix; no rerun, push, or settings change without
  explicit authorization.
- Gate: focused reproduction, affected CI-equivalent command, relevant matrix
  conclusion, and truthful distinction between local and remote evidence.

### Prepare the next RC

- Rules: root and `.github/AGENTS.md`.
- Primary: `release-monorepo`.
- Support: generator validation only when the release diff requires it.
- Skipped: general implementation workflow unless a separate defect is
  explicitly brought into scope.
- Authority: read-only planning/verification by default; no publish, tag, or
  push without exact authorization.
- Gate: affected-package/semver graph, Changesets state, exports/declarations,
  pack/install evidence, and no skipped required release check.

### Analyze duplicate generated types

- Rules: root, Core rules, and the affected plugin source facts.
- Primary: none; this is read-only diagnosis.
- Support: none until the user asks for a fix. The codegen Skills may be read
  only as routing context when necessary.
- Authority: no writes.
- Gate: evidence-backed owning-stage explanation, uncertainty and unrun checks
  reported; no implementation claim.

## Adding or changing rule sources

Add an `AGENTS.md` only when a directory has durable constraints that cannot be
expressed by its nearest ancestor. State the inherited scope, add only local
rules, and avoid task commands or historical incidents.

Add a Skill only for a distinct repeatable workflow with a recognizable
trigger, inputs, authority, validation, stop/exit conditions, and reporting
contract. Prefer extending a domain Skill over creating another general
orchestrator. Keep frontmatter decisive and the body concise; put optional
detail in one-level references only when needed.

Before merging a rule change:

1. Check every AGENTS and Skill path in the routing tables.
2. Run the repository contract and its negative tests.
3. Apply the real-task scenarios above without changing product behavior.
4. Review the task-base-to-current-tree and task-base-to-HEAD diff twice: once
   for rule consistency and once from the executing Codex user's perspective.
5. After any commit, confirm the complete task diff, final Git state, and
   external operations from fresh evidence.

Commit, push, Draft PR creation, workflow reruns, versioning, tagging, and
publication are separate external capabilities. A local implementation or
passing validation does not authorize them.
