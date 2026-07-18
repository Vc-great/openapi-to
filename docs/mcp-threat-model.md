# MCP threat model

The protected assets are Workspace confidentiality/integrity, stdio framing, model context budget, process availability, and deterministic compiler results. OpenAPI documents—including description, example, extensions, URL, and `$ref`—are untrusted data and never instructions or executable code. The startup config and installed plugins are trusted executable project code explicitly authorized by the operator; they can consume CPU/memory and access the operator's process authority, so they must be reviewed like build scripts.

| Threat | Control | Residual risk |
| --- | --- | --- |
| Traversal, absolute paths, symlink/case escapes | resolve/realpath/relative/lstat boundaries in MCP and transitive Core reads | Same-user TOCTOU cannot be eliminated completely |
| File/config replacement during read | Opened handles and pre/open/post identity checks; fail closed on change | Filesystems with weak identity/mtime semantics reduce detection |
| SSRF, redirects, DNS rebinding | HTTP(S) only, host policy, private/reserved IP denial at validation and connection lookup, redirect/size/time limits | Operator-enabled private network intentionally lowers isolation |
| Oversized/deep/recursive inputs | Source/response limits, cancellation checkpoints, cycle preservation, bounded synthetic pathological corpus | JSON/YAML parsing itself is synchronous and only cancellable before/after parsing |
| Context flooding | Diagnostic/change/artifact/operation/text/preview limits; totals and stable truncation; no full document/binary | A configured upper limit still consumes that much Host context |
| Prompt injection in document prose | Prose is neither logged nor returned wholesale and is never executed | A caller explicitly requesting previews can receive bounded generated text |
| Malicious trusted config/plugin | Startup-only fixed config; no Tool-supplied code/plugin/env/shell | Trusted code has normal Node.js authority; use OS isolation for hostile projects |
| Plugin console pollution | Bin redirects console log/info/debug to stderr without replacing stdout writes | A malicious plugin can deliberately write `process.stdout`; trusted-plugin review remains required |
| Concurrency/state leakage | Call-local compiler state; per-instance generation queue; cancellation-safe release | Legacy third-party plugins may maintain their own global state |
| Timeout/cancellation leaks | Invocation AbortSignal, abortable fetch/formatter/queue, `finally` timer/listener cleanup | Non-cooperative synchronous third-party plugin code cannot be preempted safely in-process |
| Check race on output/manifest | Path checks, stable file reads, and active-writer detection; inconsistency fails instead of returning current | Concurrent external writers can still force a safe failure |
| Plan tampering, replay, or confusion | Per-Server random HMAC key, constant-time verification, full plan/Workspace binding, TTL, exact approved hash, once-only consumption | Server cannot independently prove a human confirmation action |
| Cross-Server/Workspace token | Random process nonce/secret and Workspace hash; plans are per-instance memory only | Restart intentionally invalidates outstanding plans |
| Stale config/source/ref/remote/output | Apply re-generates under lock and compares complete deterministic plan plus fresh content/identity snapshots | Non-cooperative trusted plugins and hostile same-user races cannot be fully eliminated |
| Unexpected user-file overwrite | Added path must remain absent; modified path must match prepared hash; no caller-supplied paths/content/force | Same-user replacement after the last check can force failure/recovery |
| Managed deletion | Exact Prepare deletion set, current ownership membership, regular non-linked file, unchanged hash | A corrupted historical manifest causes safe failure and may need recovery |
| Concurrent CLI/MCP writers | Shared per-output filesystem lock plus under-lock hash validation | Network filesystems may not provide local lock/rename semantics |
| Crash during commit | Checksummed relative journal, same-root stage/backup, phase-aware startup recovery | Power-loss durability depends on OS/filesystem fsync and rename guarantees |
| Rollback failure | Byte/hash-verified reverse rollback and high-severity recovery-required diagnostic | Manual restore may be required if backups or roots were externally changed |
| Lock or journal hijack | Reject symlink/type/size/schema/root/hash/identity mismatch; never trust PID/journal alone | Same-user attackers can deny service; journal checksum is not a persistent MAC |
| Model calls Apply without approval | Tool absent without startup grant; Prepare/Apply split; exact token/hash; conservative annotations and Host approval guidance | Host policy is the final human-confirmation boundary |

There is no HTTP listener, authentication, multi-tenancy, Tasks, background work, API execution, dynamic plugin injection, direct-write Tool, OpenAPI/config modification, or arbitrary file-write surface in this release.
