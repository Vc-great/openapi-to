---
name: add-mcp-tool
description: Add or substantially change a read-only tool in the openapi-to stdio MCP server while preserving stable input/output schemas, structuredContent, bounded deterministic results, Workspace/config/remote security, protocol error separation, stdout integrity, official Client integration, Inspector/Codex smoke, and package release coverage. Use for changes under packages/mcp/src/tools or shared MCP result/security/server infrastructure; do not use to add write tools without separately explicit user authorization.
---

# Add an MCP tool

Read the root `AGENTS.md`, `packages/mcp/AGENTS.md`,
`packages/mcp/README.md`, and
[mcp-tool-checklist.md](references/mcp-tool-checklist.md). Follow the MCP Agent
guide for permanent stdio, startup-authority, Tool-matrix, result, cancellation,
and controlled-write invariants. Re-check the installed stable
`@modelcontextprotocol/sdk` API instead of copying beta examples.

## Workflow

1. Confirm the requested tool is read-only, synchronous, bounded, and within the existing stdio-only server. Stop for separate authorization and design review if it writes, deletes, repairs, changes configuration, executes arbitrary code, or adds HTTP/auth/LLM features.
2. Identify the public Core API the adapter will call and stop if new compiler
   semantics are needed outside the authorized scope.
3. Define the Tool name, title, limitation-aware description, Zod input/output
   schemas, stable annotations, result bounds, and expected-error mapping.
4. Map each input and returned field through Workspace, remote-policy,
   sanitization, ordering, truncation, cancellation, and no-mutation tests in
   the checklist.
5. Update the package-owned test layer, root route, and Doctor for registration
   or schema changes. Include a real official SDK
   `Client` + `StdioClientTransport` subprocess test against the built bin.
6. Check current Inspector help for user-visible discovery/schema/result
   review. Keep failpoint, SIGKILL, journal, lock, and commit-critical evidence
   in automated tests.
7. Update README/ADR/AGENTS/Changeset/release surfaces only when the public
   package impact requires them, then run the impact-selected matrix from the
   checklist and MCP Agent guide.

Do not create Claude Code files or mirror this Skill outside `.agents/skills`.
