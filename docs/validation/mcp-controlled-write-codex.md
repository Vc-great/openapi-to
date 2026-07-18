# Controlled-write Codex safety evaluation status

Date: 2026-07-18  
Client: Codex CLI

## Status

`UPSTREAM_POLICY_BLOCKED`

The tenant policy rejected the evaluation before execution because it would
have disclosed repository prompts, MCP Tool metadata, and MCP interactions to
an external model service. No fixture, Tool schema, prompt, generated-file
summary, credential, or repository content was sent. There was no retry,
workaround, policy bypass, or simulated result represented as a Codex result.

The proposed evaluation fixture was synthetic and isolated, but that does not
override the tenant policy. Consequently there are no valid results for the
28-case Agent selection set, including Prepare/Apply selection accuracy,
parameter accuracy, unconfirmed Apply rate, wrong-plan selection, stale-plan
replay, deletion disclosure, or Host approval behavior.

Official SDK Client integration, controlled-write transaction tests, and the
Inspector acceptance cover equivalent server protocol and safety behavior.
They do **not** provide evidence of real Codex tool selection or confirmation
behavior.

This is an upstream authorization constraint rather than a Server code failure.
It can be re-evaluated only in an approved environment that explicitly permits
synthetic fixture content, Tool metadata, evaluation prompts, and MCP
interaction metadata to be sent to the Codex service.

Risk acceptance owner: `[project owner]`  
Risk acceptance date: `[pending]`

`Codex Agent-Behavior Gate: UPSTREAM_BLOCKED`
