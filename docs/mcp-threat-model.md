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
| Check race on output/manifest | Path checks and stable file reads; inconsistency fails instead of returning current | Concurrent external writers can still force a safe failure |

There is no HTTP listener, authentication, multi-tenancy, Tasks, background work, API execution, dynamic plugin injection, or write Tool in this release.
