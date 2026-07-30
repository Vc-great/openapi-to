---
'@openapi-to/core': minor
'@openapi-to/mcp': minor
---

Add exact non-empty `replace` semantics to persistent operation selection while preserving the existing additive API. Selective Prepare now binds and reports mutation type plus previous, requested, added, retained, removed, and desired operation sets; approved Apply safely commits the frozen desired artifacts, managed deletions, ownership, and selection together.
