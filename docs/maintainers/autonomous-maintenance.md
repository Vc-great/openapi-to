# Autonomous maintenance governance

This document defines the governance contract for future autonomous repository
maintenance. Phase 3C1 remains the design authority. Phase 3C2A adds a
default-disabled, manually dispatched implementation foundation, but it does
not grant an active credential, prove a runtime canary, implement autonomous
authorization or a Policy Gate, enqueue a pull request, or change GitHub
repository settings. Current repository behavior remains authoritative until a
later phase validates and enables a narrower capability explicitly.

The governing principle is:

```text
AI understands intent.
Deterministic policy decides authority.
GitHub enforces integration.
```

Correctness and security take priority over maintainability, developer
experience, and Agent convenience, in that order.

## Status and current authority

| Capability | Current status |
| --- | --- |
| Authorization model | DEFINED |
| Trusted manual trigger foundation | IMPLEMENTED / DEFAULT DISABLED / RUNTIME UNPROVEN |
| Bounded Codex implementer foundation | IMPLEMENTED / DEFAULT DISABLED / RUNTIME UNPROVEN |
| Trusted autonomous trigger | PLANNED |
| Codex autonomous execution | PLANNED |
| Independent autonomous review | PLANNED |
| Automatic repair | PLANNED |
| Autonomous Policy Gate | PLANNED |
| Policy-authorized enqueue | PLANNED |
| Current user merge authority | IMPLEMENTED / UNCHANGED |

GitHub Issues remain durable task identity. Branches, worktrees, and Codex
sessions remain replaceable execution contexts. Development may run in
parallel, integration is serialized, and the lifecycle in
[parallel development](./parallel-development.md) remains authoritative.

The active repository Ruleset protects `main`; stable aggregate checks provide
required CI evidence; native GitHub Merge Queue provides serialized
integration and `merge_group` validation. Repository auto-merge is disabled.
The user remains enqueue and merge authority, and CI or review success does not
grant Codex merge authority. Phase 3C1 changes none of these facts.

## Phase 3C2A manual runtime foundation

`.github/workflows/codex-implementer.yml` is the only implementer entry point.
It accepts `workflow_dispatch` with one Issue number and a JSON array of exact
repository-relative paths. It independently binds the repository full name and
numeric ID, `refs/heads/main`, current main SHA, and the single trusted
maintainer `Vc-great`. Reruns fail closed: the original and triggering actors
must match the allowlist and the run attempt must be exactly one at every job,
including partial failed-job reruns. The repository variable
`CODEX_IMPLEMENTER_ENABLED` must equal the exact lowercase value `true`;
absence or every other value disables the run. Phase 3C2A does not create or
change that variable and does not dispatch the workflow.

The initial runtime accepts only Development Task Issues whose proposed mode is
`Manual`, risk is `Low` or `Medium`, and `Dependencies` is exactly `none`.
`Design Approved`, `Autonomous`, `High`, unresolved, malformed, closed, stale,
or oversized tasks fail closed. Issue comments are not read. The bounded
snapshot contains only normalized Issue Form fields and binds the Issue number,
`updated_at`, body hash, main/base SHA, dispatch actor, exact authorized paths,
and trigger/path policy versions into a deterministic SHA-256 hash. Issue text
remains untrusted data and cannot add a path or grant authority.

The versioned policy is `.github/codex/implementer-policy.json`. It permits at
most 12 exact paths and only registered non-authoritative Markdown,
`packages/*/src` source, and E2E text surfaces. It rejects absolute, traversal,
backslash, control-character, duplicate, case-ambiguous, `.git`, symlink,
submodule, and unknown paths. Root-of-Trust protection covers:

- `.github/`, `.agents/`, `.changeset/`, and `.codex/`;
- root and nested `AGENTS.md`, package manifests, dependency/lock/workspace and
  toolchain authority;
- `docs/maintainers/`, Agent/host/Skill authority documents, and the current
  autonomous-maintenance contract;
- implementer policy, prompt, schemas, scripts, tests, and repository-contract
  enforcement;
- release, publication, package-version, and supply-chain scripts.

The implementation job starts from the exact base without persisted checkout
credentials, installs the frozen trusted dependency baseline before the Agent,
and then invokes the official `openai/codex-action` v1.11 source pinned to full
commit `52fe01ec70a42f454c9d2ebd47598f9fd6893d56`. Codex CLI and proxy are fixed
at `0.147.0`; runtime configuration selects `gpt-5.6-terra` with `medium`
reasoning as the initial quality/cost-balanced canary posture. The Action uses
`drop-sudo` and a named permission profile derived from `:workspace`, makes
Root-of-Trust paths read-only, and disables command network access. The Agent
job has only `contents: read`, receives no GitHub write token or publishing
credential, and the Codex Action is its final Agent-controlled step. The only
following step is a full-SHA-pinned artifact Action that uploads the Action's
bounded result file from runner temporary storage; it runs no repository
command and holds no repository write authority.

The Agent returns the enforced `codex-implementation-result-v1` JSON shape.
Repository-owned code rejects results or text patches above their byte limits,
binary data, renames, symlinks, submodules, mode surprises, excessive or
unlisted files, Root-of-Trust changes, mismatched claims, and stale task/base
hashes. The structured result and validated bundle cross job boundaries as
bounded files, not single environment variables. A fresh validation job applies
the patch to the exact base, recomputes and seals the actual Git diff, and binds
the validated patch hash and paths into versioned evidence before candidate
execution. It then runs only the fixed repository-owned command set inside an
immutable Node 24.15.0 Bookworm container with no network, a read-only root,
dropped Linux capabilities, no-new-privileges, no credentials, an unprivileged
UID, and a private temporary workspace. Candidate code therefore cannot mutate
the host checkout, sealed bundle, or runner state used by later jobs.

A fresh read-only publisher preflight and then a separate minimal publisher
repeat the Issue, main, collision, patch, path, mode, and drift checks. The
write-capable publisher installs no dependencies and runs no candidate package,
build, test, or lifecycle code. It may create only the deterministic
`codex/<issue-number>-implementer` branch and one Draft pull request; an
existing branch or open pull request fails closed. Immediately before the first
external write it reads the repository variable through the live GitHub API and
rechecks the bound Issue and authoritative `main`, then
atomically reserves the previously absent branch at the authorized base before
an ordinary fast-forward push. It reads the live feature gate again and rechecks
the Issue, `main`, and exact remote head before Draft creation, then verifies the
created Draft's head matches the validated commit. It cannot force-push, mark
Ready, rerun Actions, enqueue, merge, use admin bypass, or update an existing
Agent pull request.

As verified before Phase 3C2A implementation, the repository had no
`OPENAI_API_KEY` secret, no `CODEX_IMPLEMENTER_ENABLED` variable, read-only
default workflow permissions, and the repository setting that allows Actions
to create and approve pull requests was disabled. Those are external Phase
3C2B prerequisites and remain unchanged. Current GitHub behavior also places
`pull_request` workflows caused by an Actions-created pull request using
`GITHUB_TOKEN` into an approval-required state; see GitHub's
[`GITHUB_TOKEN` event behavior](https://docs.github.com/en/actions/concepts/security/github_token).
No PAT, `ACCESS_TOKEN`, or GitHub App substitutes for that boundary.

The foundation is runtime-unproven until Phase 3C2B explicitly authorizes the
external prerequisites and one controlled canary after this workflow exists on
the default branch. It implements no independent autonomous review, repair
loop, autonomous Policy Gate, automatic Actions rerun, enqueue, merge, or
post-merge recovery.

## Trust and threat model

The repository is public. Issue titles and bodies, Issue comments, pull request
titles and bodies, review comments, branch names, commit messages, contributed
code, test output, logs, artifacts, OpenAPI documents, descriptions, examples,
extensions, URLs, `$ref` values, and uploaded or generated text are untrusted
data unless a separately defined trusted boundary proves otherwise.

Untrusted data may be summarized or inspected, but it never becomes Agent
policy, authorization, permission escalation, a secret source, a shell
instruction, an executable workflow instruction, or a reason to expand scope.
A public user creating or editing an Issue can never, by that act alone, start
a write-capable Agent or obtain a privileged credential.

Repository policy, system instructions, and explicit authorization from a
validated maintainer are trusted only through their defined channels. Text
that merely claims to be policy or maintainer authorization remains untrusted.

A future trusted trigger must prove all of the following from trusted,
machine-verifiable evidence:

```text
repository == openapi-to/openapi-to
repository id == 646310819
trusted execution marker is present
actor applying that marker is an explicitly trusted authority
authorization mode is valid
task contract is complete and immutable for the candidate
Root-of-Trust policy permits the requested scope
```

A marker such as `agent:run` may later be part of the interface, but its name or
presence alone is never authorization. The actor, repository, task state, mode,
policy version, and scope binding must also validate. Phase 3C1 creates no such
marker or trigger.

## Authorization modes

The future model has exactly three modes. Issue or pull request text records a
proposed mode; it does not activate the mode or grant runtime authority.

### `MANUAL`

`MANUAL` retains explicit human authorization for task execution and enqueue.
An Agent may analyze, and may implement only after the specific execution scope
is authorized. It may prepare review and CI evidence. A human must separately
authorize enqueue through native GitHub Merge Queue.

High-risk and Root-of-Trust work starts in `MANUAL`. A mode field cannot reduce
that requirement.

### `DESIGN_APPROVED`

`DESIGN_APPROVED` begins only after a validated human approves a concrete
contract containing the goal, scope, non-goals, risk, authorization boundary,
acceptance criteria, dependencies, and validation expectations. A later
implementation system may implement, review, perform bounded repair, obtain
exact-head CI, pass the deterministic Policy Gate, and request native Merge
Queue enqueue only while the candidate remains within that approved contract.

Material scope drift invalidates the approval. Ordinary design approval does
not cover Root-of-Trust changes: those require an explicit, separate
Root-of-Trust authorization and cannot affect the authorization chain used by
the same candidate.

### `AUTONOMOUS`

`AUTONOMOUS` is a future, conservative pre-authorization for tasks that a
versioned deterministic policy can prove are eligible. It never means that an
Agent considers its own work low risk. Missing, ambiguous, stale, or
unclassifiable evidence fails closed to `REQUIRE_HUMAN` or `BLOCKED`.

The initial policy should authorize only low-risk changed-surface classes that
an exact path/type allowlist can identify, such as non-authoritative Markdown
documentation outside the Root of Trust. Executable code, configuration,
dependencies, generated ownership, public APIs, permissions, security or
filesystem boundaries, release behavior, and every unregistered surface are
ineligible until a later Root-of-Trust-approved policy version adds a precise
machine-verifiable class. The repository currently implements no autonomous
eligibility allowlist.

## Risk and eligibility

The risk vocabulary is deliberately small:

- **Low**: narrowly scoped, reversible work without a public API, security,
  permission, persistence, release, or Root-of-Trust effect. Non-authoritative
  documentation corrections are a typical example.
- **Medium**: bounded product or test behavior whose ownership and validation
  are clear, but which can affect consumers or maintained behavior. Ordinary
  product-code changes may be Medium; they are not automatically High.
- **High**: compiler or OpenAPI/JSON Schema semantics, filesystem transaction or
  recovery, controlled write, MCP security boundaries, credentials and
  secrets, CI/Ruleset/Merge Queue authority, publication, major dependency or
  toolchain changes, destructive migrations, or Root-of-Trust changes.

Examples guide intake but do not decide authority. A future policy version must
map task facts and changed paths to machine-readable surface classes. Unknown
or conflicting classifications fail closed.

An initial `AUTONOMOUS` candidate is eligible only when all of these conditions
are proved:

- the trusted task contract requests `AUTONOMOUS` and the trusted trigger is
  valid;
- declared and policy-derived risk are both Low;
- every changed path belongs to the same explicit, pre-authorized allowlist
  class and no path is a symlink or untracked ownership surprise;
- the diff has no Root-of-Trust intersection;
- the candidate introduces no dependency, external write, network or
  filesystem authority, public API, generated ownership, release behavior, or
  security-boundary change;
- task dependencies are satisfied and the approved scope still matches the
  actual diff;
- exact-head independent review, CI, repair-budget, and integration-state
  evidence satisfy the pinned policy version.

Failure to prove any condition does not invite Agent judgment. It produces
`REQUIRE_HUMAN` or `BLOCKED`.

## Root of Trust

The Root of Trust contains every surface that can define, grant, review,
enforce, integrate, or publish with repository authority. A candidate is
evaluated against the trusted policy and files from its immutable authorized
baseline, never against replacements supplied by the candidate itself.

### Repository Root of Trust

The future machine policy must resolve these categories into exact paths for
each policy version:

- **Agent authority**: root and nested `AGENTS.md`, autonomous-maintenance
  policy and machine policy, authorization-mode definitions, trusted-trigger
  contracts, and Policy Gate logic or configuration.
- **Review authority**: the independent P0/P1 review Skill, implementer/reviewer
  separation rules, structured review schemas, and code that accepts review
  evidence.
- **CI and integration authority**: required workflows, their reusable or
  composite Actions, required-check aggregation, repository-contract logic and
  tests that protect required governance, and Merge Queue integration logic.
- **Task and evidence contracts**: trusted task schema, authorization metadata,
  pull request evidence schema, policy-version binding, and exact-head evidence
  verification.
- **Release and supply chain**: publication workflow and scripts, package and
  version authority, dependency and lockfile policy, provenance/signing rules,
  tag and GitHub Release creation, and credential-handling contracts.

The Version Packages workflow prepares versions and changelogs; it is not npm
publication. Publication remains a separate, high-risk authorization boundary.

The current governance files themselves—including this document,
`AGENTS.md`, `.github/AGENTS.md`, the Development Task Issue Form, the pull
request template, and their repository-contract enforcement—therefore belong
to the Root of Trust.

### External Root of Trust

Remote settings are modeled separately because they are not repository-file
changes: Rulesets and branch protection, required status-check configuration,
Merge Queue settings, bypass actors, repository auto-merge policy, GitHub App
and Actions token permissions, Environments, secrets and credentials, npm
Trusted Publishing, and repository/tag/release permissions.

An ordinary `AUTONOMOUS` task must not change any Root-of-Trust surface. Any
intersection invalidates autonomous eligibility and produces
`REQUIRE_HUMAN`. A `DESIGN_APPROVED` candidate also needs explicit
Root-of-Trust authorization; ordinary design approval is insufficient.

A Root-of-Trust change can take effect only for later candidates after human
review, protected integration, and post-merge validation. It cannot alter the
policy, reviewer, required CI, or remote settings used to authorize its own
current enqueue. There is no self-approval path.

## Deterministic Policy Gate

The future Policy Gate consumes bounded structured evidence. An Agent may
produce evidence, but an LLM does not make the final enqueue decision where
deterministic data is available.

Conceptually:

```text
task contract -> authorization mode -> risk -> changed surfaces
-> Root-of-Trust check -> dependencies -> review -> exact-head CI
-> repair/rerun budgets -> integration state -> decision
```

### Inputs

The minimum inputs are:

- repository full name and numeric identity;
- Issue/task identity and immutable task-contract hash;
- authorization mode and trusted-trigger evidence, including initiating actor;
- declared risk and policy-derived changed-surface classifications;
- exact changed paths and Root-of-Trust intersection;
- immutable task base, exact pull request head SHA, and immutable reviewed SHA;
- reviewer identity/context evidence, result, readiness, and unresolved P0,
  P1, and P2 counts;
- material repair count and exact-head CI rerun count;
- required-check names, conclusions, candidate SHAs, and exact-head
  relationship;
- task dependencies, current `main`/integration state, and invalidated
  assumptions;
- requested or observed external operations, including prohibited operations;
- exact, immutable policy version used for evaluation.

Natural-language claims are never substituted for available repository IDs,
actors, paths, hashes, status conclusions, counters, or policy versions.

### Outcomes and reason codes

The Gate returns exactly one decision:

- `ALLOW_ENQUEUE`: the pinned policy authorizes requesting native GitHub Merge
  Queue enqueue for the exact head. It grants neither direct merge nor `DONE`.
- `REQUIRE_HUMAN`: evidence is valid enough to route, but risk, scope, mode, or
  Root-of-Trust policy requires an explicit human decision.
- `BLOCKED`: required evidence or state is incomplete, stale, inconsistent, or
  failed and cannot currently proceed.

Stable reason categories include:

| Reason | Meaning |
| --- | --- |
| `REPOSITORY_MISMATCH` | Repository name or numeric identity is wrong. |
| `UNTRUSTED_TRIGGER` | Marker, actor, or trigger provenance is not trusted. |
| `AUTHORIZATION_INVALID` | Mode or task authorization is missing, stale, or invalid. |
| `RISK_REQUIRES_HUMAN` | Risk is outside the autonomous policy. |
| `ROOT_OF_TRUST_TOUCHED` | The diff intersects a protected surface. |
| `TASK_SCOPE_DRIFT` | Actual work materially exceeds or changes the authorized contract. |
| `DEPENDENCY_BLOCKED` | A declared dependency or integration order is unsatisfied. |
| `REVIEW_INCOMPLETE` | Independent exact-diff review evidence is absent or incomplete. |
| `P0_REMAINING` | At least one unresolved P0 remains. |
| `P1_REMAINING` | At least one unresolved P1 remains. |
| `CI_INCOMPLETE` | Required exact-head CI has not completed. |
| `CI_FAILED` | Required exact-head CI failed. |
| `REPAIR_BUDGET_EXCEEDED` | Material repair count exceeds policy. |
| `RERUN_BUDGET_EXCEEDED` | Exact-head CI rerun count exceeds policy. |
| `HEAD_CHANGED` | PR head differs from the reviewed or checked SHA. |
| `POLICY_VERSION_STALE` | Evidence was evaluated under a non-current policy. |
| `PROHIBITED_EXTERNAL_OPERATION` | The candidate requests or performed an unauthorized write. |

The decision and reasons are bound to the exact head and policy version. Any
head, task, dependency, trusted-trigger, policy, required-check, or remote
governance change makes prior `ALLOW_ENQUEUE` evidence stale. Ambiguity fails
closed; there is no `MAYBE_READY` or `AGENT_RECOMMENDS_MERGE` result.

## Independent review and bounded recovery

### Independent review

The implementer and independent reviewer must use different contexts. The
reviewer is fresh and read-only, and inspects the immutable task base, complete
task diff, task contract, actual changed surfaces, and relevant authority or
security boundary. The implementer cannot self-declare review success.

Future machine-consumable review evidence must bind the task and reviewed head,
identify the independent context, state `READY` or `NOT READY`, and report P0,
P1, and P2 findings/counts. Zero unresolved P0 and P1 is necessary but not
sufficient for `ALLOW_ENQUEUE`. Weakening the reviewer contract makes the
candidate Root-of-Trust-changing and human-required.

### Repair budget

The initial future autonomous budget is at most **two material repair rounds**.
A round is consumed only by review or CI evidence, a confirmed actionable
issue, an implementation change, affected revalidation, and a new complete
diff review. Read-only diagnosis does not consume a round.

Exhaustion produces `REQUIRE_HUMAN` or `BLOCKED`; repair never continues until
green. High-risk changes may receive a smaller budget or immediate human
escalation. This governance budget is distinct from the current maintainer-led
`implement-and-review` workflow and does not modify that Skill in Phase 3C1.

### CI rerun budget

CI reruns are separate from code repair. A future autonomous system may request
at most **one evidence-based failed-jobs rerun per exact head** when evidence
indicates an environmental or infrastructure failure, the head is unchanged,
the failed run belongs to the same candidate, and no product or test failure
evidence exists.

Recurrence of the same or related failure produces `REQUIRE_HUMAN` or
`BLOCKED`. There is no rerun-until-green policy and Phase 3C1 adds no retry
mechanism to required CI.

## Scope drift

Authorization is stale when the actual candidate materially changes the
approved goal, risk, authority, ownership, or dependency contract. Material
drift includes a new package outside scope; a new Root-of-Trust path,
dependency, network permission, filesystem authority, or external write; a
public API, security boundary, release behavior, or generated-file ownership
change; or a changed task dependency or integration order.

For `DESIGN_APPROVED`, material drift invalidates the approval and returns the
task to human review. For `AUTONOMOUS`, drift outside the pinned eligibility
policy produces `REQUIRE_HUMAN`. If deterministic comparison cannot prove that
the contract still holds, the Gate fails closed.

## Local and remote writes

Authority is granted by transition, never inferred from a broader-sounding
task instruction.

- **Local writes** include source, test, and documentation edits and local Git
  commits.
- **Remote writes** include pushes, pull request creation or updates, Issue
  updates, Actions reruns, enqueue, merge, Ruleset or secret changes, releases
  and tags, and npm publication.

Permission to analyze does not grant local edits. Permission to edit does not
grant commit. Commit does not grant push. Push does not grant pull request
mutation, rerun, enqueue, or merge. Enqueue authority does not grant direct
merge. Repository governance and publication operations remain separately
authorized high-risk capabilities.

## Merge Queue and completion

### Enqueue and integration

Native GitHub Merge Queue remains the only intended ordinary integration
queue. Future automation may produce `ALLOW_ENQUEUE`; it must not produce or
exercise `DIRECT_MERGE`. It must not create a custom queue, write directly to
`main`, force-push, use admin bypass, or replace Merge Queue with repository
auto-merge.

After a policy-authorized enqueue, GitHub creates the `merge_group` candidate,
runs required integration checks, and performs protected squash integration.
Phase 3C1 grants no enqueue capability, and the user remains the current
enqueue and merge authority.

### Post-merge failure

If Merge Queue integrates a pull request but post-merge `main` validation
fails, the task becomes `BLOCKED`, not `DONE`. Preserve the exact merge and
failure evidence, notify or escalate to maintainer authority, and create or
route to a repair/follow-up task. Do not force-push or rewrite `main`, weaken
CI, repeat merges, or assume automatic revert authority. A future revert policy
requires a separate design.

### Completion states

`LOCAL READY`, `REMOTE CI`, `MERGE READY`, `MERGED`, and `DONE` remain distinct.
`ALLOW_ENQUEUE` is only an exact-head authorization to request queue entry. It
is not `MERGE READY`, `MERGED`, or `DONE`. `DONE` still requires completed
integration, observed relevant post-merge validation, and closure of the task
lifecycle.

## Security review

| Question | Required answer |
| --- | --- |
| Can an untrusted public Issue start a write-capable Agent? | No. |
| Can a candidate change the rules used to authorize its own enqueue? | No. |
| Can it weaken and rely on its independent reviewer in one chain? | No. |
| Can it weaken and immediately rely on required CI? | No. |
| Can CI success alone authorize enqueue? | No. |
| Can ordinary `AUTONOMOUS` work touch the Root of Trust? | No. |
| Can public Issue text become executable instruction? | No. |
| Can repair continue indefinitely? | No. |
| Can repeated reruns be used to obtain green status? | No. |
| Can autonomous work force-push or directly update `main`? | No. |
| Does the final Gate use LLM judgment where deterministic evidence exists? | No. |
| Does Phase 3C1 grant new autonomous authority? | No. |

Any unexpected `Yes` is a blocking governance defect.

## Rollout roadmap

These stages are planned and do not claim implementation:

1. **Phase 3C1 — Autonomous Maintenance Governance Contract**: define this
   contract.
2. **Phase 3C2 — Trusted Task Trigger + Codex Implementer**: implement a
   bounded trusted trigger and implementation boundary.
3. **Phase 3C3 — Independent Review + Bounded Repair**: implement independent
   structured review and repair orchestration.
4. **Phase 3C4 — Deterministic Autonomous Policy Gate**: implement the pinned,
   fail-closed decision engine.
5. **Phase 3C5 — Policy-authorized Native Merge Queue Integration**: allow only
   Gate-authorized enqueue, never direct merge.
6. **Phase 3C6 — Post-merge Recovery / Operations / Telemetry**: add bounded
   observation and separately designed recovery operations.
