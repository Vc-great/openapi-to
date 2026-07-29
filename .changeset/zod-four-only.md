---
"@openapi-to/plugin-zod": major
"@openapi-to/core": major
"@openapi-to/plugin-ts-type": major
---

Generate Zod 4-only schemas, including top-level string formats, explicit key/value records, executable unions and intersections, safe enum literals and property names, additional-properties policies, and recursive references. Generated consumers now require `zod@^4`; Zod 3 is no longer supported.

Component schema, parameter, request-body, and response references now import the category's real named export. Operation responses use collision-free per-status declarations, success/error aggregates, and `z.undefined()` for documented no-body responses. OpenAPI 3.1 boolean and empty schemas retain their accept-all/reject-all semantics. Date-time schemas accept required-second RFC3339 values with `Z` or numeric offsets; `int32`, safe-integer, password, and validation-sibling boundaries are explicit and tested. Recursive runtime parsing remains supported while recursive `z.infer` is documented as `unknown`.

Referenced parameters now retain optional query/header/cookie and required path semantics, including resolved parameter objects that also carry `$ref`. Boolean and empty schemas are preserved at parameter entry points. Response generation includes case-insensitive `1XX` through `5XX` wildcard keys with stable unique names; informational responses use the current non-success aggregate, and `default` keeps its existing fallback behavior.

Every legal component response now has a real export, with responses lacking content represented by `z.undefined()`. Existing Media Type Objects without `schema` are distinct from absent bodies and generate `z.unknown()` for operation/component request and response entry points, so Zod-backed request services never call an undefined parser. Response header references are excluded from body-schema imports because response-header validation is not currently generated.

Schema-level `$ref` values with supported validation siblings now pass through the common renderer from operation and component parameter, request-body, and response builders. The renderer continues to apply one uniform intersection/nullable policy rather than dialect-specific OpenAPI 3.0 versus 3.1 behavior. Recursive inference, exact-one `oneOf`, the complete int64 domain, and RFC3339 leap seconds remain outside this change.

Core now exposes stable path/query/header/cookie parameter classification,
shared Parameter Object `schema`/`content` extraction, and response semantic
descriptors. TypeScript and Zod consume those semantics consistently:
request-header and cookie schemas/types are generated, a selected Media Type
without `schema` is `unknown`/`z.unknown()`, and a response without content is
`undefined`/`z.undefined()`. TypeScript retains every documented response
status member, including mixed `200 + 204` and only-204 operations, and routes
request-body schema `$ref` siblings such as `nullable` and composition through
the schema renderer.

Schema `$ref` siblings now retain one cross-plugin meaning at every parameter,
request-body, and response entry point: the referenced schema and sibling
schema both apply. TypeScript renders `$ref + anyOf/oneOf` as
`Ref & (A | B)`, `$ref + allOf` as intersections, and keeps nullable as
`Ref | null`; Zod emits the matching intersections/nullable schema. Deep
sibling refs are imported without duplicates, component response refs use
their real named export, nullable/composed object responses bypass the
plain-interface shortcut, and component parameters collect imports per file
without self-imports.

Core public Parameter Object types now include OpenAPI 3.1 parameters and keep
boolean schemas and type arrays valid at parameter entry points. Generated
header/cookie types and Zod schemas do not change the TypeScript request
client's public method signature: callers still provide transport values
through request/client configuration. Exact-one `oneOf`, dialect-specific
`$ref` sibling rules, recursive `z.infer`, complete int64, leap seconds,
response-header validation, intelligent multi-Media-Type selection, and
independent request-client header/cookie parameters remain outside this
change.
