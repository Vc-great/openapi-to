# Generation state transaction

Status: Phase 2 B2b selective Apply uses the B2a transaction foundation.

## Why three states belong to one transaction

A selective generation commit makes three related facts durable:

```text
generated artifacts
+ ownership manifest
+ operation selection manifest
        -> one generation state transaction
```

Updating only generated files leaves cleanup ownership or future selection wrong. Updating ownership first can make old files appear managed by a new plan. Updating selection alone claims that projected code exists when it does not. Core therefore provides one transaction implementation that can stage, back up, install, verify, roll back, and recover generated artifacts, the ownership manifest, and bounded controlled sidecar state files together.

B2a exposes this as `commitGenerationStateTransaction()`. The existing `commitOutputTransaction()` is a compatibility wrapper that calls the same implementation with no state files. Full CLI generation and full MCP Apply consequently retain their existing behavior and write journal schema v1.

## Controlled state model

`TransactionStateFile` contains a bounded identifier, a POSIX Workspace-relative path, the complete `expectedBefore` physical snapshot, deterministic desired bytes and SHA-256, and a per-file byte limit. `TransactionRecoveryContext` supplies the trusted absolute Workspace plus one or more Workspace-relative controlled state roots. These objects are Core API inputs for trusted application code; no MCP Tool argument accepts a state path, state root, bytes, stage path, backup path, or journal path.

Core enforces:

- at most 16 state files, 1 MiB per file, and 4 MiB of state bytes per transaction;
- a maximum 512-character normalized relative path and a bounded unique id;
- no absolute paths, `..`, backslashes, duplicate ids/paths, output-root overlap, or transaction-directory collision;
- a real Workspace, a narrower controlled root, and targets beneath that root;
- no symlink segment, hard-linked target, directory, device, or other non-regular target;
- a complete before hash/byte/filesystem identity for an existing file and exact revalidation before backup;
- desired bytes that exactly match the declared hash and limit.

The B1 selection reader now rejects hard links as well as symlinks. Its selective plan binding includes the previous semantic hash, previous physical snapshot, desired semantic hash, desired serialized-byte SHA-256, and desired byte length. Serialization is deterministic; B2a does not add `updatedAt` or any Apply-time value.

## Journal versions and storage

Journal schema v1 remains the no-state format for generated artifacts plus ownership. Schema v2 adds a Workspace-root hash, state operations, and state-created directories. Each state operation records only its id, Workspace-relative target/stage/backup identities, before/after snapshots, and index. The journal never contains an absolute path, Workspace name, selection body, generated body, OpenAPI document, token, config, credential, or header.

Both versions use `.openapi-to-transaction.json` in the output root and a deterministic SHA-256 checksum over stable JSON. Output stage/backup bytes remain beneath `.openapi-to-transaction/<transaction-id>/`. Each controlled state file stages and backs up beneath its trusted target parent:

```text
.openapi-to/selections/
  <selection>.json
  .openapi-to-state-transaction/<transaction-id>/
    stage/<index>
    backup/<index>
```

This makes every individual state rename local to its target filesystem. Before journal v2 is accepted, recovery re-derives those paths from the target identity and transaction id and checks them again against the startup-trusted recovery context.

## Commit order

The implementation uses these recoverable phase boundaries:

1. Validate output preconditions and every controlled state before snapshot, hash, identity, path, and device.
2. Create the output transaction area and persist a checksummed `staging` journal before moving formal state.
3. Stage and fsync changed generated artifacts, the ownership manifest, and all desired state bytes; verify every staged hash.
4. Persist `backup`, then revalidate and move old generated files, ownership, and state files to their same-filesystem backups.
5. Persist `committing`.
6. Install generated artifacts, then ownership, then controlled state files. State is deliberately last so it never advertises the new selection before code and ownership are installed.
7. Verify all generated, ownership, and state after-snapshots.
8. Persist `committed`.
9. Remove known stage/backup storage and the journal.

Files and their parent directories are fsynced where the platform supports it. This is recoverable filesystem transaction emulation, not database ACID.

## Rollback and crash recovery

Before `committed`, an ordinary error restores state in reverse order: state targets, generated targets, ownership, then newly created empty directories. Existing files are restored from hash-matching backups; transaction additions are deleted only when they match the recorded after-snapshot; managed deletions are restored. Known transaction storage is then removed. Failure to prove any move retains the journal and reports a recovery-required error rather than claiming success.

Acquiring the output lock automatically invokes recovery. Journal v1 follows the established full-output path. For v2:

- `staging` rolls back untouched formal state and removes stage/created directories;
- `backup` and `committing` restore all three old states;
- `committed` verifies all three desired states and only then completes cleanup;
- a committed mismatch, missing trusted recovery context, invalid relative path, unknown journal version, bad checksum, unsafe link, or missing/changed backup fails closed and preserves evidence.

The state failpoints are `state-stage`, `state-after-stage`, `state-backup`, `state-after-backup`, `state-rename`, `state-after-rename`, `state-verify`, and `state-cleanup`. They support ordinary injected failures and subprocess crash recovery tests.

## Cross-device policy

The first implementation requires the output root and every controlled state target parent to report the same filesystem device identity. A mismatch returns `SELECTIVE_STATE_CROSS_DEVICE_UNSUPPORTED` before staging. It never falls back to copy-and-delete, because that would lose atomic-rename and recovery assumptions. Multi-output transactions remain out of scope.

## MCP selective Apply integration

Selective Prepare remains side-effect free but now issues a one-time token for a complete frozen plan. Selective Apply passes one internally derived `TransactionStateFile` containing the prior physical selection snapshot and exact desired bytes to `commitGenerationStateTransaction()`. It supplies the startup-trusted Workspace and `.openapi-to/selections` recovery root; no Tool argument can supply those values.

B2b does not add remove, replace, clear, prune, historical full-output bootstrap, output migration, or `src/api/generated` writes. Full plans continue to use journal v1 and `commitOutputTransaction()`; only selective plans with the controlled selection state use journal v2.
