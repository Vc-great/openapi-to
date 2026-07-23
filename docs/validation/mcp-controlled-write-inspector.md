# Controlled-write MCP Inspector acceptance

Date: 2026-07-18  
Inspector: `@modelcontextprotocol/inspector` 0.22.0  
Node.js: 24.8.0 (local acceptance host; package engine remains `>=20`)  
Server package: `@openapi-to/mcp` 3.2.2

Historical note: this acceptance record predates the three Phase 1 catalog Tools. The current configured/write matrices are eight and ten; the seven-Tool observation below records the 2026-07-18 run and is not the current registry contract.

## Method

The Inspector Web UI was started with its authenticated local Proxy enabled and
bound to localhost. `DANGEROUSLY_OMIT_AUTH` was not set. The UI connected to a
single continuing stdio Server process configured with a synthetic, isolated
fixture Workspace, trusted fixture config, and `--allow-write`. The recorded
command uses placeholders only:

```text
mcp-inspector --config <sanitized-config> --server openapi-to-controlled-write
```

No production repository was used as a write target. This record deliberately
omits absolute paths, Proxy/session credentials, plan identifiers, plan tokens,
full artifacts, and environment values.

## Observed interactive cases

| Case | Result | Evidence |
| --- | --- | --- |
| Tool registration | PASS | Exactly seven tools appeared: the five existing read-only tools plus Prepare and Apply. Prepare was read-only/non-destructive/non-idempotent; Apply was non-read-only/destructive/non-idempotent. Input and output schemas were visible. |
| Prepare has no Workspace side effect | PASS | Before/after normalized Workspace hashes were identical; no output root or manifest existed. The structured result contained plan identity fields, bounded changes, and text stating that no files or ownership manifest were written. |
| Same-session Apply | PASS | The plan returned by Prepare was submitted without reconnecting or restarting the Server. Two planned files and a v2 ownership manifest appeared, with no journal, staging directory, or lock left behind. |
| Post-Apply current state | PASS | `openapi_check_generation` returned `outdated: false`; a subsequent Prepare reported two unchanged files. |
| Replay | PASS | Reusing the consumed plan returned `MCP_PLAN_ALREADY_USED` and did not alter the fixture. |
| Token, plan hash, and plan id tampering | PASS | Altering a token (including a non-canonical Base64URL final character), hash, or identifier returned `MCP_PLAN_TOKEN_INVALID`, `MCP_PLAN_HASH_MISMATCH`, or `MCP_PLAN_NOT_FOUND` respectively; the fixture stayed unchanged. |
| Source drift | PASS | Editing the OpenAPI source after Prepare returned `MCP_PLAN_SOURCE_CHANGED`, with no Apply side effect. |
| Local `$ref` drift | PASS | Editing a synthetic external local reference after Prepare returned `MCP_PLAN_REFERENCE_CHANGED`, with no Apply side effect. |
| Trusted config drift | PASS | Editing the trusted config after Prepare returned `MCP_PLAN_CONFIG_CHANGED`, with no Apply side effect. |
| Invalid ownership manifest | PASS (safe failure) | Replacing the manifest schema version with an invalid value made Apply fail with structured `MCP_TOOL_EXECUTION_FAILED`; it did not write. The focused automated matrix verifies the valid-but-changed manifest path returns `MCP_PLAN_MANIFEST_CHANGED`. |

The UI showed coarse progress notifications on the Inspector notification pane;
these were protocol notifications rather than stdout logs. Operational logging
was configured at `error`; no plan token was observed in stderr. The acceptance
fixture had no network inputs.

## Matrix not interactive in this record

The following cases remain covered by the official SDK stdio integration and
transaction tests, but were **not rerun through the Inspector Web UI in this
session**: managed deletion plus unmanaged-file preservation, failpoint
rollback, Prepare cancellation, pre-commit Apply cancellation, commit-critical
section cancellation, and crash recovery. They therefore cannot be promoted to
a complete Inspector interactive matrix from this record alone.

## Gate

`Inspector Interactive Gate: NOT_RUN` for the full required matrix. The
interactive evidence above is positive but intentionally does not substitute
automated test evidence for the missing UI cases.

## P3.2 attempt — remaining matrix

Date: 2026-07-18
Inspector: `@modelcontextprotocol/inspector` 0.22.0
Node.js: 24.8.0
Server package: `@openapi-to/mcp` 3.2.2

The planned acceptance setup again used a synthetic isolated Workspace,
startup-trusted config, `--allow-write`, an authenticated Proxy, and localhost
ports only. Authentication was not disabled. Its sanitized launch shape was:

```text
mcp-inspector --config <sanitized-config> --server openapi-to-controlled-write
```

The current managed execution environment did not preserve the new Inspector
Proxy/Server child process: after it reported a localhost listener, the listener
had exited and the UI received a connection-reset failure before any Tool call.
The pre-existing Inspector instance could not be reused because its authenticated
session was unavailable. This is an **environment blocker before Server Tool
execution**, not a Server failure and not evidence of a passing UI scenario.

| Scenario | Interactive status | Execution classification | Result |
| --- | --- | --- | --- |
| Managed deletion and unmanaged preservation | NOT_RUN | ENVIRONMENT_BLOCKED | No connected P3.2 Inspector Server session was available. Existing SDK test remains PASS. |
| Failpoint rollback | NOT_RUN | ENVIRONMENT_BLOCKED | No connected P3.2 Inspector Server session was available. Existing Core failpoint matrix remains PASS. |
| Prepare cancellation | NOT_RUN | ENVIRONMENT_BLOCKED | No Tool request could be created. Inspector cancellation capability was therefore not evaluated. |
| Apply pre-commit cancellation | NOT_RUN | ENVIRONMENT_BLOCKED | No Tool request could be created. |
| Apply commit-critical cancellation | NOT_RUN | ENVIRONMENT_BLOCKED | No Tool request could be created. |
| Inspector-assisted crash recovery | NOT_RUN | ENVIRONMENT_BLOCKED | No connected Server process was available for an Inspector-assisted recovery call. Existing subprocess recovery test remains PASS. |

No Proxy/session token, plan token, absolute path, generated content, or
environment value is retained in this record. The P3.1 same-Server Prepare/Apply
evidence remains valid; this P3.2 attempt did not restart or alter that prior
acceptance Server.

## P3.3 lifecycle diagnosis and continued UI matrix

Date: 2026-07-18
Inspector: `@modelcontextprotocol/inspector` 0.22.0
Node.js: 24.8.0
Server package: `@openapi-to/mcp` 3.2.2

### Lifecycle result

`INSPECTOR_LIFECYCLE_READY`

The diagnostic used fresh localhost-only high ports, an authenticated Proxy, a
synthetic Workspace/config, and `--allow-write`. A temporary foreground PTY
wrapper, not `nohup` or an unobserved background shell, launched Inspector.
The wrapper redacted Inspector's generated Proxy token before forwarding logs.
The sanitized shape was:

```text
CLIENT_PORT=<high-ui-port> SERVER_PORT=<high-proxy-port>
run-inspector-lifecycle.sh <sanitized-config>
```

For more than three minutes, and after separate shell and browser actions, the
following process relationship and both listeners remained live:

```text
foreground wrapper
  -> npm/npx launcher
     -> Inspector starter
        -> Inspector Proxy (stdio bridge)
        -> Inspector Web UI
           -> openapi-to-mcp stdio child (after UI connect)
```

The wrapper, launcher, Inspector starter, Proxy, UI, and stdio Server shared
one foreground process group. The parent process relationship remained stable;
the macOS `ps` session field was `0` for this foreground PTY group. There was
no port conflict, listener loss, connection reset, exit signal, or nonzero
exit during the observation. UI HTTP returned success and an unauthenticated
Proxy probe returned an HTTP response rather than a refused connection. The
browser connected and displayed `@openapi-to/mcp` 3.2.2. Browser and Inspector
shared the same host localhost namespace.

This isolates the P3.2 failure as an unsuitable non-persistent launch method,
not an MCP Server lifecycle failure.

### Continued Inspector UI evidence

| Scenario | Interactive status | Result |
| --- | --- | --- |
| Managed deletion and unmanaged preservation | NOT_RUN | In the same persistent Server session, Prepare reported one managed deletion; Apply removed the managed file, retained the unmanaged file byte-identically, wrote a v2 manifest, and left no journal or lock. A replay attempt returned `MCP_PLAN_ALREADY_USED`. The required Inspector `check=current` and second Prepare=`unchanged` calls were not completed before teardown, so this is deliberately not marked PASS. |
| Failpoint rollback | NOT_RUN | The existing failpoint is an internal Core test option and has no startup-only fixture/environment injection in the released MCP Server. It was not exposed through a Tool or Schema. |
| Prepare cancellation | NOT_RUN | Inspector 0.22.0 presented no manual in-flight Tool cancellation control in the UI. Its client-timeout facility was not used as a substitute without a bounded long-running fixture. |
| Apply pre-commit cancellation | NOT_RUN | Same Inspector cancellation limitation; no unsafe synthetic Tool or production hook was added. |
| Apply commit-critical cancellation | NOT_RUN | Same Inspector cancellation limitation; existing SDK coverage remains supplemental only. |
| Inspector-assisted crash recovery | NOT_RUN | The existing crash failpoint is internal to Core transaction tests and cannot be armed through the released MCP Server without adding a new test injection surface. |

No plan token, Proxy/session token, absolute path, generated body, or fixture
content is retained in this record. The focused automated SDK/Core suites remain
the evidence for the NOT_RUN rollback, cancellation, and crash cases; they are
not represented as Inspector UI passes.

`Inspector Interactive Gate: NOT_RUN` remains unchanged because five required
interactive cases are still not complete.
