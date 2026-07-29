---
"@openapi-to/plugin-zod": major
---

Generate Zod 4-only schemas, including top-level string formats, explicit key/value records, executable unions and intersections, safe enum literals and property names, additional-properties policies, and recursive references. Generated consumers now require `zod@^4`; Zod 3 is no longer supported.

Component schema, parameter, request-body, and response references now import the category's real named export. Operation responses use collision-free per-status declarations, success/error aggregates, and `z.undefined()` for documented no-body responses. OpenAPI 3.1 boolean and empty schemas retain their accept-all/reject-all semantics. Date-time schemas accept required-second RFC3339 values with `Z` or numeric offsets; `int32`, safe-integer, password, and validation-sibling boundaries are explicit and tested. Recursive runtime parsing remains supported while recursive `z.infer` is documented as `unknown`.
