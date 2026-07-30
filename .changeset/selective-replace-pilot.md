---
'@openapi-to/core': minor
'@openapi-to/mcp': minor
---

Add exact non-empty `replace` semantics to persistent operation selection while preserving the original add-only Core mutation, merge-result, and runtime return-shape contracts. The new generic mutation API lets Selective Prepare replace every legal persisted selection of up to 5,000 operations in one request while retaining per-key, manifest-byte, plan-memory, and bounded-summary limits. Approved Apply commits the complete frozen desired artifacts, ownership-constrained managed deletions, ownership manifest, and selection together while preserving unmanaged files, rollback, and recovery behavior.
