# Persistent operation selection and Selective Prepare

Status: controlled additive and exact-replace Selective Apply implemented.

## State meaning and identity

An operation selection is the complete set of operations that a project expects to retain for one trusted generation target. It is not the temporary list passed in the latest request. Selective Prepare supports two mutations:

```text
add:     desired = previous ∪ requested
replace: desired = requested
```

Both mutations deduplicate and code-point-sort operation keys. Replace must name at least one operation; an empty replace is reserved for a future clear capability and is rejected. Generating only additions or only differences would make tag/global aggregates, shared schemas, and the ownership manifest incomplete. Selective Prepare therefore projects and generates the complete desired selection on every request.

Each current config target already determines one input, plugin set, Workspace, output root, and ownership manifest. B1 consequently uses the target as the selection owner and does not add a destination abstraction. The owner binds the trusted config display identity, target name, and normalized Workspace-relative output root. Its bounded opaque hashes avoid machine paths. State lives at a fixed internally derived path:

```text
.openapi-to/selections/<safe-target>-<owner-hash>.json
```

Callers may pass only a trusted target name. They cannot pass this path, an output path, config, source, plugin, content, cleanup policy, or destination.

## Manifest v1

```json
{
  "version": 1,
  "target": "backend",
  "selectionOwner": "target:backend|config:<hash>|output:<hash>",
  "operations": ["getUser", "updateUser"],
  "metadata": {
    "lastAppliedSpecHash": "optional audit value",
    "updatedAt": "optional audit value"
  }
}
```

Operations are unique and sorted by code-point lexical order, independent of request order. Version, target, owner, and sorted operations form the semantic SHA-256 hash. Metadata, timestamps, PIDs, random values, and machine paths do not affect it. Unknown fields are rejected. Core exports creation, parsing, strict validation, normalization, generic mutation application, the backward-compatible merge entry point, deterministic serialization, and semantic hashing helpers. Mutation results deterministically expose mutation type, previous, requested, newly added, already selected, retained, removed, and desired keys.

The file is limited to 1 MiB, 5,000 operations, and 500 UTF-8 bytes per key. Reads are bounded and stable, reject symlinks, hard links, and Workspace escape, and compare file identity before/after reading. Corrupt JSON, unsupported versions, duplicate/empty/invalid keys, target/owner mismatch, and concurrent read drift fail closed. Prepare never creates the directory or writes the file.

## Bootstrap and drift

Bootstrap is allowed only when selection is absent, ownership is absent, and the output root is absent or empty. The initial previous selection is then empty. The following states fail closed:

- ownership exists but selection does not: `SELECTION_BOOTSTRAP_REQUIRED`;
- selection is absent while the output is non-empty: `SELECTION_BOOTSTRAP_REQUIRED`;
- selection exists, ownership is absent, and output is non-empty: `SELECTION_STATE_INCONSISTENT`;
- manifest target/owner differs from trusted identity: `SELECTION_TARGET_MISMATCH` or `SELECTION_OWNER_MISMATCH`.

Selection with no ownership is allowed only beside an empty output, so a new desired artifact set can be reviewed without guessing ownership. Replace can bootstrap the first non-empty selection in an empty Workspace under the same rule. Selection is never inferred from a historical full ownership manifest because the current manifest records artifact path/hash/bytes/kind but has no unambiguous operationKey mapping.

Every historical and requested key is checked against the current cached Operation Catalog. Missing/renamed keys fail with `SELECTION_OPERATION_NOT_FOUND`; missing or currently duplicated `operationId` fails with `SELECTIVE_PREPARE_OPERATION_ID_REQUIRED` or `SELECTIVE_PREPARE_DUPLICATE_OPERATION_ID`. No operation is migrated, removed, or renamed automatically.

## Selective Prepare and plan binding

```text
trusted target
  -> bounded previous selection read
  -> exact requested mutation
  -> normalized desired selection
  -> cached compilation
  -> projected compilation(desired selection)
  -> complete desired artifacts
  -> output/ownership comparison
  -> applyable selective plan (Prepare still writes nothing)
```

`openapi_prepare_generation` remains full generation when `selection` is omitted. With `selection: { type: "add" | "replace", operationKeys: [...] }`, it requires one trusted target, reuses the compiled target cache, and projects all desired keys. Add preserves the trusted target's existing `output.clean` behavior because it never shrinks desired selection. Replace internally enables ownership-constrained managed cleanup so contraction remains exact even when the target normally preserves old generated files; this is derived by the Server and is not a caller-controlled cleanup policy. Unchanged ownership-managed artifacts outside the new desired projection appear as explicit managed deletions, while unmanaged files remain outside the delete set.

The deterministic plan binds `kind=selective`, mutation type, manifest version, selection owner/file identity, the prior physical snapshot and semantic hash, normalized previous/requested/new/already-selected/retained/removed/desired keys, desired semantic hash, exact desired serialized-byte SHA-256/length, projection hash/stats, and the existing full plan's Workspace/config/source/reference/remote/output/ownership/file/generator/plugin/artifact/delete bindings. Equivalent request order produces the same plan for unchanged disk state, while add and replace remain distinct plans even if they happen to produce the same desired set. Audit metadata remains outside the semantic operation hash, but a physical-file or final-byte change deliberately changes the transaction plan binding. External arrays return at most 50 keys per category with exact counts and explicit truncation; the internal plan remains complete.

## Apply boundary and lifecycle

Selective Prepare returns `kind: "selective"`, `applySupported: true`, and a one-time token bound to the selective kind, trusted target/output, selection owner, plan hash, expiry, Workspace, and Server process. The short-lived internal plan also retains the exact desired serialized selection bytes; callers receive only bounded summaries. Prepare still creates no selection, generated output, ownership, lock, stage, backup, or journal.

After explicit approval, Apply revalidates the previous physical snapshot and semantic hash before the output lock. Under the lock it consumes the token, compiles the trusted target afresh, projects exactly the frozen desired operation keys, compares the projection hash/statistics plus every artifact path/kind/order/hash/byte length, deletion, desired ownership bytes, and desired selection, then repeats selection validation. Apply never accepts operation keys. Only then does it call `commitGenerationStateTransaction()` with the frozen desired selection bytes. The transaction installs generated artifacts, performs approved safe managed deletions, installs ownership and then selection, and verifies all three before success. Rollback and crash recovery restore the prior artifact, ownership, and selection state together.

Full Prepare still returns its token, and full Apply retains its existing revalidation, shared lock, atomic artifact/ownership transaction, rollback, recovery, cancellation, expiry, and replay behavior. Restart clears all plans and refreshes trusted config/catalog state. B1 adds no file watcher and no write permission.

## Current boundary

Add and non-empty replace are the only selection mutations. Remove, clear, prune, automatic full-output migration, operation rename migration, and caller-selected destinations or cleanup policies remain disabled. Generated output remains under the existing trusted target output. Selection is written only by a successful approved selective Apply; Prepare writes no state, and full Prepare/Apply plus full CLI generation keep their established semantics.
