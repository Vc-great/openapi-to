# Controlled MCP generation write architecture

Status: accepted for P3 (2026-07-18).

## Decision and authority

`@openapi-to/mcp` keeps its five read-only tools and adds exactly two operator-gated tools:

```text
openapi_prepare_generation -> review -> openapi_apply_generation
```

Both tools are registered only when startup includes a Workspace-local trusted config and `--allow-write`, after every configured output root has passed the Workspace boundary. A Tool argument can neither grant write authority nor select config, plugins, output roots, content, delete policy, environment, shell, `force`, or validation bypasses. Without `--allow-write`, a configured Server still exposes exactly the original five tools.

This release restricts each plan to one configured target and one output root. That makes the transaction boundary explainable and avoids claiming cross-filesystem atomicity. Multi-target Prepare fails with `MCP_WRITE_SINGLE_TARGET_REQUIRED`; it never applies only the first target.

## Prepare and plan binding

Prepare runs the normal Core compiler/plugin/artifact/comparison pipeline in dry-run mode and writes nothing, including no output directory, staging file, lock, journal, snapshot, or ownership manifest. Its internal deterministic payload binds:

- generator/package version and a semantic fingerprint of the loaded plugin/config object;
- Workspace real-path hash and filesystem identity;
- trusted config path plus every bundled local config source hash and identity;
- selected target and remote-policy hash;
- entry OpenAPI, every loaded local `$ref`, and remote response content hashes;
- output-root existence/identity, ownership manifest snapshot, and every planned managed-file snapshot;
- the complete sorted GenerationManifest and all materialized artifact path/kind/hash/byte tuples.

Artifact bodies are not copied into plan storage. Apply must re-run generation and reproduce the exact deterministic payload and artifact hashes. This bounds plan memory while detecting non-deterministic or changed plugin output.

The external response is only a bounded review summary. Its change list may be truncated; the internal plan never is. Preview is off by default, text-only, and bounded. Binary content is never returned.

## Token and in-memory store

Each Server instance creates a random 256-bit secret and process nonce. A token is the canonical Base64URL encoding of HMAC-SHA256 over the plan ID, complete deterministic plan hash, Workspace hash, expiry, and Server nonce. Verification compares the exact, Schema-bounded canonical encoding in constant time, so alternate encodings of the same MAC are rejected. `planId` is only a lookup key and has no authorization value.

Plans live only in a per-Server memory store. Defaults are a five-minute TTL, 20 plans, 4 MiB metadata per plan, and 32 MiB total metadata. The store has deterministic LRU eviction, periodic unref'ed cleanup, once-only consumption, and zeroes its secret on Server close. Restart, expiry, eviction, another Server, another Workspace, a changed plan hash, or a modified token invalidates Apply. Tokens and secrets never enter logs, generated files, manifests, or disk journals.

The Server can prove that Apply uses the same plan hash returned by Prepare. It cannot prove that a human performed the confirmation action. The security boundary is layered: startup operator grant, separate Prepare, exact one-time token/hash, immutable Apply schema, Tool description, and the MCP Host's approval UI/policy.

## Apply validation and regeneration

Apply accepts only `planId`, `token`, and `approvedPlanHash`. It verifies the plan, waits for the per-Server generation queue and output filesystem lock, then consumes the token. Under the lock it reloads current sources through the cached trusted config, re-runs full generation, and compares the complete deterministic payload. It also re-reads local source/config snapshots immediately before commit.

Config, source, `$ref`, output-root, ownership manifest, managed-file, artifact, generator, or plugin drift is a safe stale-plan failure requiring a new Prepare. An added target path must still be absent; modified/deleted paths must have the prepared hash; deleted files must still be regular, unchanged entries from the current ownership manifest. No automatic re-planning or force path exists.

## Shared transaction writer

Core owns the writer used by both CLI generate and MCP Apply. Its output-root lock is an atomically created directory containing a PID and random owner nonce. It validates lock/root filesystem identities and does not trust the owner record as a file-integrity proof; hashes are always rechecked under the lock. A live owner is never displaced. A dead owner can be cleared, after which any journal is recovered before a new writer proceeds. Network filesystems with weak rename/locking semantics remain a documented limitation.

The transaction stages every added/modified artifact and the version-2 ownership manifest within the output root's filesystem, fsyncs and verifies staged hashes, writes a checksummed relative-path journal, backs up changed managed files and the prior manifest, renames staged files into place, switches the manifest, and cleans backups. Only paths in the exact manifest change set participate. It never recursively cleans or scans for arbitrary user files.

Any ordinary failure after commit starts triggers reverse-order rollback. Successful return means all planned files and the ownership manifest match; a rollback-success error means the pre-Apply byte state was restored; `MCP_WRITE_ROLLBACK_FAILED` means restoration could not be proven and operators must stop writers and follow recovery guidance. This is filesystem transaction emulation, not database ACID.

The version-2 ownership manifest is stable and contains only generator name/version and sorted managed path/hash/bytes/kind records. It contains no machine path, config, plan ID, token, or input body. Version-1 manifests remain readable and are upgraded only by a successful write.

## Crash recovery and cancellation

The journal is `.openapi-to-transaction.json`; staged/backed-up bytes are under `.openapi-to-transaction/<transaction-id>`. It records only schema, transaction/output identity, phase, relative operations, before/after hashes, and created directories. Its checksum detects accidental or unsophisticated modification; because it is not MACed across restarts, same-user journal tampering is not considered cryptographically preventable. Recovery still validates schema, confinement, symlinks, target/backup hashes, and output-root identity before moving anything.

On lock acquisition, staging-only journals are cleaned, backup/committing journals are rolled back, and committed journals are verified then cleaned. Unsafe or unverifiable state returns `MCP_WRITE_RECOVERY_REQUIRED`; it is never ignored.

Prepare and Apply before commit are cooperatively cancellable. Once backup/commit starts, cancellation is recorded but deferred until successful commit or complete rollback, because throwing between renames would create a half-applied state. A separate bounded commit deadline continues to run and causes rollback. Generation and filesystem locks are released in `finally`; cancellation while waiting does not consume the plan.

## Residual limitations

Node.js cannot provide a database transaction across arbitrary files. Same-user TOCTOU races cannot be fully eliminated, abrupt power loss depends on filesystem durability semantics, malicious trusted plugins retain normal Node.js authority, and network filesystems may not honor local atomic-rename expectations. Identity and hash revalidation, same-filesystem staging, fsync, lock/journal recovery, and fail-closed behavior reduce these risks without claiming total elimination.

Streamable HTTP, OAuth, multi-tenancy, Tasks, background generation, OpenAPI/config modification, dynamic plugins, arbitrary file writes, and direct write-without-Prepare remain out of scope.
