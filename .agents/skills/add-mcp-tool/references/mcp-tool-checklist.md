# MCP tool checklist

## Contract

- Stable `openapi_*` name, title, limitation-aware description.
- Bounded Zod input and output schemas visible in `tools/list`.
- `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true` only when truthful and supported by the installed stable SDK.
- Short `content` summary and non-duplicated, JSON-safe `structuredContent` matching `outputSchema`.
- `isError: true` for expected compilation, Workspace, config, plugin, stale-generation, remote-policy, and result-limit failures.
- Protocol error only for unknown tools, invalid arguments, lifecycle, or SDK/protocol failure.

## Security and limits

- Direct Core API call; no CLI subprocess.
- Workspace covers entry, transitive refs, config/imports, output/check/manifest, symlinks, traversal, Windows paths, and case folding.
- Tool cannot select config/plugins/Workspace/output, execute code/shell, set env, or relax remote/private-network policy.
- Stable sort before truncation; errors and breaking changes receive priority.
- Preserve totals/returned/omitted counts and add `MCP_RESULT_TRUNCATED` when bounded.
- No full document, full generated output by default, binary Base64, stack, secrets, URL credentials/query, environment dump, config source, or absolute machine paths.

## Runtime

- stdin/stdout contain JSON-RPC only; stderr contains bounded sanitized logs.
- Plugin `console.log/info/debug` cannot corrupt stdout.
- Analysis state is call-local; generation lock is per server and releases in `finally`.
- No resources, prompts, sampling, elicitation, Apps UI, LLM calls, background tasks, or HTTP half-implementation.

## Tests and release

- Unit: schemas, success/error, ordering, sanitization, limits, target/config/remote policy.
- Security: relative/absolute inside, traversal, transitive ref, symlink entry/ref/output/config, Windows drive/UNC, case conflict, missing file, URL redaction.
- stdio subprocess: initialize, list, schemas, annotations, call, structured content, error, stderr, clean close, no stdout pollution.
- Matrix: 3 tools without config; 5 with fixed trusted config.
- Determinism: repeat results byte-stably without time/random/temp paths.
- Run official Inspector using its current help; run Codex smoke with current official config fields.
- Check package exports/bin/files/engines, project references, package-surface script, tarball install smoke, fixed Changesets group, and SemVer.
- Never add a write tool without separate explicit user authorization.
