---
'@openapi-to/core': minor
'@openapi-to/mcp': patch
---

Add a bounded controlled sidecar-state abstraction to the shared Core transaction writer, with checksummed journal v2 state operations, physical preconditions, same-parent staging and backup, three-state rollback, and lock-triggered crash recovery. Existing no-state full writes retain journal v1 and the existing full Prepare/Apply contract.

Selective plan binding now includes the previous selection physical snapshot and exact desired serialized-byte hash and length. Selective Prepare remains review-only with no returned token, selective Apply remains disabled before locks and writes, and no new MCP write authority or Tool is added.
