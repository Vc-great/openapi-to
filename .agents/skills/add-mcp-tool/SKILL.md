---
name: add-mcp-tool
description: Add or substantially change a read-only tool in the openapi-to stdio MCP server while preserving stable input/output schemas, structuredContent, bounded deterministic results, Workspace/config/remote security, protocol error separation, stdout integrity, official Client integration, Inspector/Codex smoke, and package release coverage. Use for changes under packages/mcp/src/tools or shared MCP result/security/server infrastructure; do not use to add write tools without separately explicit user authorization.
---

# Add an MCP tool

Read the root `AGENTS.md`, `packages/mcp/README.md`, and [mcp-tool-checklist.md](references/mcp-tool-checklist.md). Re-check the installed stable `@modelcontextprotocol/sdk` API instead of copying beta examples.

## Workflow

1. Confirm the requested tool is read-only, synchronous, bounded, and within the existing stdio-only server. Stop for separate authorization and design review if it writes, deletes, repairs, changes configuration, executes arbitrary code, or adds HTTP/auth/LLM features.
2. Put compiler semantics in `@openapi-to/core`; keep the MCP handler an adapter over public Core APIs. Never spawn the CLI or parse CLI stdout.
3. Define a stable snake_case name, human title, precise limitation-aware description, Zod input schema, Zod output schema, and supported stable tool annotations.
4. Keep startup authority out of Tool arguments: no Workspace root, config path, plugins, environment variables, shell commands, private-network override, output-root override, or executable code.
5. Return one short text summary plus schema-conforming `structuredContent`. Use `isError: true` for expected execution failures and reserve protocol errors for unknown tools, invalid schema input, and MCP lifecycle failures.
6. Reuse result helpers for diagnostic sanitization, stable ordering, totals, truncation, and text-size enforcement. Never return full OpenAPI documents, unbounded generated text, binary Base64, errors, stacks, cyclic values, or absolute machine paths.
7. Apply Workspace enforcement to entry files, transitive local `$ref`, config entry/imports, output/check paths, symlinks, traversal, Windows drive/UNC paths, and case-folded artifact collisions. Tool arguments must not loosen startup remote policy.
8. Keep analysis calls isolated and concurrent. Route generation through the per-server `GenerationLock`; prove failure releases the lock and separate server instances do not share it.
9. Accept the stable SDK handler cancellation signal, combine it with the bounded startup-owned Server timeout, propagate it to Core and queue waits, clear timers/listeners, and test cancellation/timeout as distinct outcomes. Use coarse standard progress only when the client supplies a progress token; never use Tasks.
10. Preserve stdio: stdin/stdout are MCP JSON-RPC only. Route logs and plugin incidental console output to stderr without replacing `process.stdout.write` or installing per-call console restore races.
11. Run focused unit/security tests and a real official SDK `Client` + `StdioClientTransport` subprocess test against the built bin. Include timeout, active/queued cancellation, disconnect/shutdown, TOCTOU, stress, bounded performance, schemas, stderr, determinism, and no filesystem mutation.
12. Check the current official MCP Inspector help and run a stdio smoke. Run a current Codex project-config and tool-selection smoke when the task requires it; document observed results, not assumptions.
13. Update README/ADR/AGENTS/Changeset/release scripts when public package behavior or surface changes. Run package test/typecheck/build, root tests/typecheck/build, changed-file lint, package-surface verification, pack-install smoke, and Changesets status as impact requires.

Do not create Claude Code files or mirror this Skill outside `.agents/skills`.
