# GitHub automation agent guide

This file extends the root `AGENTS.md` for `.github/`.

GitHub Actions must run reproducible repository gates and retain useful failure
evidence. Never obtain a green check by hiding, skipping, or downgrading an
error.

## Workflow review

Before changing a workflow or local/reusable Action, inspect:

- event triggers, branch and path filters;
- least-privilege permissions and fork/secret safety;
- concurrency and cancellation behavior;
- OS/Node/package-manager matrices;
- job/step timeouts and resource assumptions;
- build prerequisites and cache inputs;
- artifacts, retention, and `if` conditions;
- every caller of a reusable/local Action and cross-platform shell behavior;
- the exact repository/package script that reproduces each job locally.

Classify a failure before editing: product source regression, test regression,
workflow/configuration defect, missing build prerequisite, platform-specific
behavior, dependency/registry/network transient, permissions/secrets failure,
timeout/resource exhaustion, cache contamination, or pre-existing failure.
Find the first meaningful error in complete logs rather than repairing the
final exit-code line.

## Integrity rules

Do not “fix” CI by:

- adding `continue-on-error`;
- deleting tests, skipping assertions, or catching errors and returning zero;
- increasing a timeout without evidence that valid work needs it;
- making a failing required job non-required or removing its trigger;
- accepting new lint diagnostics because the repository has historical
  backlog;
- changing unrelated dependencies;
- treating a rerun success as proof of a code fix.

For a transient registry, network, or runner failure, preserve the evidence,
explain why a rerun is appropriate, and avoid speculative product changes.
Every code/workflow fix needs a focused local reproduction when the environment
permits one, followed by the affected CI-equivalent command and relevant matrix
coverage.

## Diagnostic artifacts and secrets

Prefer bounded, sanitized evidence that survives failure: Job Summary, focused
logs, test reports, machine-readable JSON, and failure-only artifacts. Artifact
collection must not mask the gate's exit status.

Never upload tokens, full environments, `Authorization` or Cookie values,
private URLs, credential-bearing configuration, unredacted request data,
complete OpenAPI documents, or generated trees containing secrets.

## Version automation

`.github/workflows/version-packages.yml` uses Changesets Action only to create
or update the Version Packages PR and maintain version files. It does not
publish npm packages, create tags, or create GitHub Releases.

If an automation commit must bypass Husky, scope `HUSKY=0` to the explicit
automation step. Do not weaken normal developer commit hooks.

This phase must not add OpenAI/Codex API workflows, automated CI triage
comments, code modifications, Issues, or repair pull requests. Do not rerun or
cancel a workflow, push a change, or modify repository settings without
explicit user authorization.

Use `.agents/skills/fix-github-actions/SKILL.md` to investigate and repair an
existing failing check. Keep `.github/setup/action.yml` callers and Linux,
Windows, and macOS behavior in scope when changing the shared setup Action.
