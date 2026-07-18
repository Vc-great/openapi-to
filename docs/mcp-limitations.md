# MCP limitations

- Transport is stdio only. Streamable HTTP, OAuth, API keys, and multi-tenancy are not implemented.
- The original five Tools are read-only. Controlled writes exist only through operator-enabled Prepare/Apply; there is no direct write, OpenAPI/config edit, arbitrary path/content, or business API execution.
- OpenAPI 3.2 is compatible-read with diagnosed generator gaps, not complete generation support.
- Diff is a deterministic first-stage ruleset, not a complete compatibility proof or breaking-change oracle.
- Config and plugins are trusted operator-selected executable code. Tool callers cannot change them; edits require a Server restart because the load result is cached.
- Cancellation is cooperative. Remote I/O, compiler loops, plugin boundaries, formatting, comparison, and queue waits observe it; one long synchronous parser or non-cooperative plugin callback cannot be safely interrupted mid-instruction.
- Progress is optional, coarse, standard MCP progress only. There are no experimental Tasks or background jobs.
- Results are deliberately truncated and never include full OpenAPI documents, complete generated trees, or binary Base64.
- Local TOCTOU checks reduce and detect important races but are not a claim of complete protection against a hostile same-user process.
- One controlled-write plan supports exactly one configured target/output root. Cross-root database-style atomicity is not claimed.
- Plan tokens prove Server/Workspace/plan continuity, not that a human personally clicked approval; the Host owns final confirmation policy.
- Filesystem transactions use same-root staging, rename, fsync, rollback, and recovery journals. Power loss and network filesystems retain platform-specific durability/atomicity risk.
- Journal checksums detect corruption but are not persistent secret MACs; a malicious same-user process remains in the residual threat model and unsafe recovery fails closed.
- No telemetry, Resources, Prompts, Sampling, Elicitation, MCP Apps UI, LLM call, or chat interface is included.
