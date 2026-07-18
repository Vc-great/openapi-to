# Controlled-write MCP release decision

Date: 2026-07-18

| Gate | Status | Basis |
| --- | --- | --- |
| Implementation Gate | PASS | P3 implementation, deterministic writer, transaction, plan binding, and package build/type surfaces pass their focused and repository regression suites. |
| Automated Safety Gate | PASS | Official SDK stdio integration, controlled-write token/stale/lock/cancellation coverage, failpoint rollback, crash recovery, stress, and benchmark regression checks pass. |
| Inspector Interactive Gate | NOT_RUN | The authenticated persistent UI session passed the recorded core Prepare/Apply, replay, tamper, source/reference/config drift cases, but did not complete every required UI case. See the Inspector record. |
| Codex Agent-Behavior Gate | UPSTREAM_BLOCKED | Tenant policy rejected external Codex evaluation before any controlled data was disclosed. See the Codex record. |
| Release Gate | NOT_RUN | The decision rule requires both Inspector and real Codex Agent-Behavior gates to pass. |

No release exception has been approved. In particular, `UPSTREAM_BLOCKED` is not
a passing Codex evaluation, and positive SDK/Inspector protocol tests are not a
substitute for real Agent selection evidence.

## Decision

`MCP CONTROLLED WRITE NOT READY`

Before a release decision can be reconsidered, complete the remaining Inspector
UI matrix in a persistent Server session and run the 28-case Codex safety
evaluation in an explicitly approved synthetic-fixture environment. No `force`,
dynamic write scope, token persistence, or security-policy relaxation is an
acceptable substitute.
