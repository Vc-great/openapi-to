# MCP security boundary

`@openapi-to/mcp` is a local stdio adapter for one canonical Workspace. It does not provide an HTTP service, authentication service, SaaS boundary, or model runtime.

## Startup authority

The server operator—not a Tool caller—chooses the Workspace, optional trusted config, remote-host policy, timeouts, limits, and whether controlled write Tools exist. A TypeScript/JavaScript config is executable trusted project code. Tool arguments cannot replace the config, choose plugins or packages, change the Workspace/output roots, supply arbitrary paths/content, or relax remote-network policy.

Without config, three analysis Tools are available. Trusted config adds five read-only catalog/generation-check Tools. `--allow-write` requires config and adds only Prepare and Apply.

## Read-only means no writer

Validation, inspection, diff, target/operation discovery, generation dry-run, and generation check may read bounded Workspace state. Dry-run/check may execute trusted plugins, but they do not call the writer or create/update generated files, ownership manifests, selection state, plans on disk, locks, staging, backups, or journals.

## Prepare and Apply

`--allow-write` is an operator capability grant. It does not prove that a person approved a Tool call and does not allow an AI Host to bypass its own approval policy.

1. Prepare runs generation and stores a bounded, short-lived in-memory plan. It returns the added/modified/deleted summary, `planId`, one-time token, and exact plan hash, but writes no Workspace file.
2. The Host must present the reviewed plan and obtain approval according to its policy.
3. Apply accepts only the returned `planId`, token, and approved hash. It re-generates and rejects expired, replayed, tampered, or stale plans.
4. Before commit, Apply revalidates config/input/local and remote reference hashes, Workspace/output identity, ownership/current files, generated artifacts, and the prepared plan. It acquires the shared CLI/MCP output lock and uses Core's transaction journal, staging, verification, rollback, and recovery path.

There is no force flag, stale override, direct-write Tool, dynamic target/config/plugin selection, or caller-supplied output path/content.

## Host approval

The server can prove that Apply matches Prepare; it cannot prove who reviewed the plan. Keep Host approval enabled for `openapi_apply_generation`, especially when deletions are present. Do not enable blanket auto-run for the write-enabled server.

## Process streams

stdin and stdout are MCP JSON-RPC only. Operational logs and redirected incidental plugin output use stderr. Do not wrap the server in a command that prints banners or progress to stdout. `--log-format json` produces newline-delimited operational records on stderr, not MCP responses.

## Filesystem and network boundary

Local entries, transitive `$ref`, trusted config imports, output roots, manifests, and selection state are constrained to the real Workspace and checked against traversal and symlink escapes. Remote access is HTTP(S)-only, denies private/reserved networks by default, and applies allowed-host, redirect, timeout, DNS, and response-size policies.

Workspace-local native Windows absolute input paths are accepted without treating the drive letter as a URL scheme. Drive-relative Windows paths, UNC paths, and configured `file:` URLs are rejected. Every configured Target has an independent output root. Core rejects the Workspace root, absolute/drive/UNC output paths, Windows reserved device names/characters, trailing periods/spaces, `.git`, `node_modules`, Workspace output anywhere below the root `.openapi-to` state directory, symlinked ancestors, equal roots, and parent/child output overlap before generation. Managed output stays below `.openapi-to` but cannot use reserved control-state children; Workspace output remains generator-owned and keeps its ownership manifest in that output root. Selection stays in `.openapi-to/selections` and cannot overlap output.

Target remote config describes trusted access requirements. MCP startup policy is an operator-owned upper bound; the effective policy is the intersection. Private-network access requires explicit `true` in both layers, allowed-host patterns must overlap, and timeout/response-size/redirect limits use the smaller configured value. Target headers are preserved, but Tool schemas cannot supply or change them.

Remote URL validation is repeated for every redirect and remote `$ref`. DNS is checked both during policy validation and when connecting, including IPv4-mapped IPv6/private results. Redirects, duration, decompressed bytes, and cancellation are bounded. Origin identity includes scheme, hostname, and effective port. Same-Origin redirects retain configured request headers; the first cross-Origin hop removes all of them for the rest of the chain. HTTPS-to-HTTP redirects are rejected before the downgraded request. `Set-Cookie` is a response header and is never sent from configured request headers. Diagnostics, plans, state, manifests, journals, responses, and operational logs use sanitized data and never include configured header values.

See the detailed [threat model](./mcp-threat-model.md), [controlled-write architecture](./architecture/mcp-controlled-write.md), [recovery guide](./mcp-write-recovery.md), and [limitations](./mcp-limitations.md).
