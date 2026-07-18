# MCP controlled-write recovery

Normal Apply and CLI generation recover or clean their transaction state automatically while acquiring the shared output lock. Do not manually delete a lock, journal, staging directory, backup, or ownership manifest merely to make a new write proceed.

## Files and phases

Each configured output root may temporarily contain:

- `.openapi-to-write.lock/owner.json` — current writer PID and random nonce;
- `.openapi-to-transaction.json` — checksummed transaction phase and relative hash plan;
- `.openapi-to-transaction/<transaction-id>/stage/` — verified future bytes;
- `.openapi-to-transaction/<transaction-id>/backup/` — pre-Apply managed bytes and manifest.

Staging is pre-commit. Backup and committing may have moved managed files. Committed means the new files and manifest were switched, but cleanup may not have completed.

## Automatic behavior

The next CLI write or MCP Apply acquires the lock before recovery:

1. A live lock owner causes a bounded wait and then `MCP_WRITE_LOCKED`.
2. A dead/stale owner record can be removed safely; PID liveness is only a lock-retention signal, never a substitute for hashes.
3. A staging journal is cleaned without touching formal output.
4. A backup/committing journal is rolled back in reverse order after every backup/target hash is validated.
5. A committed journal is cleaned only after every target and ownership-manifest hash matches the committed state.
6. A missing, changed, symlinked, oversized, wrong-root, or invalid journal/backup fails with `MCP_WRITE_RECOVERY_REQUIRED`.

No new Apply proceeds while recovery is unproven.

## Operator procedure for recovery-required state

1. Stop every MCP Server, Codex session, CLI generate, editor generator, and CI job targeting the output root.
2. Preserve a byte-for-byte copy of the output root, including dotfiles, on the same trusted machine for investigation.
3. Inspect stderr for `generation_recovery_required`, `MCP_WRITE_RECOVERY_REQUIRED`, or `MCP_WRITE_ROLLBACK_FAILED`. Logs intentionally omit file bodies, tokens, config, and OpenAPI content.
4. Verify that the output root is the configured Workspace-local directory and has not become a symlink, mount replacement, or unexpected hard link.
5. Treat the journal's relative paths and hashes as evidence, not instructions to run arbitrary commands. Do not edit it to bypass validation.
6. Restore the whole output root from a known-good backup or version control if automatic hash-proven rollback cannot complete. Preserve unmanaged user files separately.
7. Remove transaction internals only after restoration has been independently verified and no writer is active.
8. Restart the Server, run `openapi_check_generation`, then create and explicitly review a new Prepare plan. Old tokens are invalid after restart.

If restoration cannot be proven byte-identical, do not report generation as current. Escalate the output root and saved transaction evidence for manual review.
