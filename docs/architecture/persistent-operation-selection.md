# Persistent operation selection and Selective Prepare

Status: Phase 2 B2a transaction foundation implemented; selected Apply remains disabled.

## State meaning and identity

An operation selection is the complete set of operations that a project expects to retain for one trusted generation target. It is not the temporary list passed in the latest request. B1 supports only an additive mutation:

```text
previous selection ∪ requested additions = desired selection
```

Generating only the requested additions would drop prior per-operation files and would make tag/global aggregates, shared schemas, and the ownership manifest incomplete. Selective Prepare therefore projects and generates the complete desired selection on every request.

Each current config target already determines one input, plugin set, Workspace, output root, and ownership manifest. B1 consequently uses the target as the selection owner and does not add a destination abstraction. The owner binds the trusted config display identity, target name, and normalized Workspace-relative output root. Its bounded opaque hashes avoid machine paths. State lives at a fixed internally derived path:

```text
.OpenAPI/selections/<safe-target>-<owner-hash>.json
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

Operations are unique and sorted by code-point lexical order, independent of request order. Version, target, owner, and sorted operations form the semantic SHA-256 hash. Metadata, timestamps, PIDs, random values, and machine paths do not affect it. Unknown fields are rejected. Core exports creation, parsing, strict validation, normalization, additive merge, deterministic serialization, and semantic hashing helpers.

The file is limited to 1 MiB, 5,000 operations, and 500 UTF-8 bytes per key. Reads are bounded and stable, reject symlinks, hard links, and Workspace escape, and compare file identity before/after reading. Corrupt JSON, unsupported versions, duplicate/empty/invalid keys, target/owner mismatch, and concurrent read drift fail closed. Prepare never creates the directory or writes the file.

## Bootstrap and drift

Bootstrap is allowed only when selection is absent, ownership is absent, and the output root is absent or empty. The initial previous selection is then empty. The following states fail closed:

- ownership exists but selection does not: `SELECTION_BOOTSTRAP_REQUIRED`;
- selection is absent while the output is non-empty: `SELECTION_BOOTSTRAP_REQUIRED`;
- selection exists, ownership is absent, and output is non-empty: `SELECTION_STATE_INCONSISTENT`;
- manifest target/owner differs from trusted identity: `SELECTION_TARGET_MISMATCH` or `SELECTION_OWNER_MISMATCH`.

Selection with no ownership is allowed only beside an empty output, so a new desired artifact set can be reviewed without guessing ownership. B1 does not infer selection from a historical full ownership manifest because the current manifest records artifact path/hash/bytes/kind but has no unambiguous operationKey mapping.

Every historical and requested key is checked against the current cached Operation Catalog. Missing/renamed keys fail with `SELECTION_OPERATION_NOT_FOUND`; missing or currently duplicated `operationId` fails with `SELECTIVE_PREPARE_OPERATION_ID_REQUIRED` or `SELECTIVE_PREPARE_DUPLICATE_OPERATION_ID`. No operation is migrated, removed, or renamed automatically.

## Selective Prepare and plan binding

```text
trusted target
  -> bounded previous selection read
  -> exact requested additions
  -> normalized desired selection
  -> cached compilation
  -> projected compilation(desired selection)
  -> complete desired artifacts
  -> output/ownership comparison
  -> review-only selective plan
```

`openapi_prepare_generation` remains full generation when `selection` is omitted. With `selection: { type: "add", operationKeys: [...] }`, it requires one trusted target, reuses the Phase 1 compiled target cache, and invokes the Phase 2A projection with all desired keys. The trusted target's existing `output.clean` controls comparison; the caller cannot change it. Because add never shrinks desired selection, artifacts for prior operations remain expected and are not deleted merely because the latest request named one new operation.

The deterministic plan binds `kind=selective`, manifest version, selection owner/file identity, the prior physical snapshot and semantic hash, normalized requested/new/already-selected/desired keys, desired semantic hash, exact desired serialized-byte SHA-256/length, projection hash/stats, and the existing full plan's Workspace/config/source/reference/remote/output/ownership/file/generator/plugin/artifact/delete bindings. Equivalent request order produces the same plan for unchanged disk state. Audit metadata remains outside the semantic operation hash, but a physical-file or final-byte change now deliberately changes the transaction plan binding. External arrays return at most 50 keys per category with totals and explicit truncation; the internal plan remains complete.

## Apply boundary and lifecycle

Selective Prepare returns `kind: "selective"`, `applySupported: false`, and no token. The internal plan remains short-lived in the existing per-Server memory store so its complete binding can be tested and reviewed. If a valid internal selective plan reaches `openapi_apply_generation`, it returns `SELECTIVE_APPLY_NOT_ENABLED` before entering the generation queue, acquiring the output lock, creating staging/journal state, consuming the token, or calling the transaction writer.

Full Prepare still returns its token, and full Apply retains its existing revalidation, shared lock, atomic artifact/ownership transaction, rollback, recovery, cancellation, expiry, and replay behavior. Restart clears all plans and refreshes trusted config/catalog state. B1 adds no file watcher and no write permission.

## Current boundary and B2b

B2a adds the reusable Core transaction/journal/rollback/recovery foundation for generated artifacts, ownership, and controlled state files. It does not connect that writer to MCP selective plans. Add remains the only selection mutation; remove, replace, clear, prune, automatic full-output migration, selected Apply, and actual selection writes remain disabled. Generated output remains under the existing trusted `.OpenAPI/<output.dir>` location; nothing migrates to `src/api/generated`.

B2b is limited to:

```text
selected plan revalidation
  -> selection drift validation
  -> exact desired selection regeneration
  -> projection/artifact revalidation
  -> selected plan token
  -> invoke generation state transaction
  -> controlled selective Apply
```
