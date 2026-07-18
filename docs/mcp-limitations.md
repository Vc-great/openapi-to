# MCP limitations

- Transport is stdio only. Streamable HTTP, OAuth, API keys, and multi-tenancy are not implemented.
- The five Tools are read-only. They do not write, repair, delete, overwrite, execute business APIs, or modify OpenAPI.
- OpenAPI 3.2 is compatible-read with diagnosed generator gaps, not complete generation support.
- Diff is a deterministic first-stage ruleset, not a complete compatibility proof or breaking-change oracle.
- Config and plugins are trusted operator-selected executable code. Tool callers cannot change them; edits require a Server restart because the load result is cached.
- Cancellation is cooperative. Remote I/O, compiler loops, plugin boundaries, formatting, comparison, and queue waits observe it; one long synchronous parser or non-cooperative plugin callback cannot be safely interrupted mid-instruction.
- Progress is optional, coarse, standard MCP progress only. There are no experimental Tasks or background jobs.
- Results are deliberately truncated and never include full OpenAPI documents, complete generated trees, or binary Base64.
- Local TOCTOU checks reduce and detect important races but are not a claim of complete protection against a hostile same-user process.
- No telemetry, Resources, Prompts, Sampling, Elicitation, MCP Apps UI, LLM call, or chat interface is included.
