# Controlled-write MCP Inspector acceptance

Date: 2026-07-18  
Inspector: `@modelcontextprotocol/inspector` 0.22.0  
Node.js: 24.8.0 (local acceptance host; package engine remains `>=20`)  
Server package: `@openapi-to/mcp` 3.2.2

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
