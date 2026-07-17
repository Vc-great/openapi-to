# OpenAPI compatibility checklist

This document is an investigation matrix, not a declaration of support. Re-run repository searches and tests before updating any status. “Current evidence” describes the revision at which this Skill was authored and deliberately avoids marking unverified features as supported.

## Current repository evidence

| Area | Evidence currently present | Required next proof before a support claim |
| --- | --- | --- |
| Swagger 2.0 | `packages/core/mock/swagger2.0.json`, `packages/cli/mock/swagger.json`, conversion through `compileOpenAPI` | Minimal conversion assertions plus affected plugin generation |
| OpenAPI 3.0 | `packages/core/mock/openapiV3.json` and plugin `mock/petstore.json` files identify 3.0.x | Focused feature fixtures and output assertions; Petstore alone is insufficient |
| OpenAPI 3.1 | Compiler accepts 3.1 and focused CLI inspection exercises it | Prove each promised JSON Schema 2020-12 keyword through affected outputs |
| OpenAPI 3.2 | `openapi-3.2.yaml` proves compatible reading and tested warnings for accepted-not-generated additions | Keep claims at compatible-read/accepted-not-generated until plugin output fixtures exist |
| External `$ref` | Focused resolver and controlled local HTTP tests cover files, URLs, cycles, cache, and security policy | Add downstream plugin evidence for each feature whose schema is externally referenced |
| Changes to unknown fields | `normalizer.ts` preserves and deterministically sorts unknown object keys | Prove each unknown field is either generated, preserved-only, or diagnosed at its owning stage |

Do not convert the table above to “supported/not supported” without executing evidence. A type import or parser acceptance is not generation support.

## Dialect matrix

For each applicable row, record: fixture path, load result, reference result, context representation, type output, Zod output, request/query/mock impact, diagnostic, and idempotency result.

### Swagger 2.0

- `swagger: "2.0"` detection and conversion to the internal OpenAPI 3 shape.
- Body/formData parameters, consumes/produces, response schemas, definitions, security definitions.
- Local references before/after conversion.
- Conversion warnings and unsupported vendor extensions.
- Minimal invalid Swagger document and non-Swagger object behavior.

### OpenAPI 3.0

- `nullable` as an OpenAPI 3.0 schema keyword; do not replace it mechanically with JSON Schema type arrays.
- `requestBody`, content negotiation, multipart/form-data, component parameters/requestBodies/responses.
- Callbacks and discriminator behavior.
- Boolean schemas and keywords that are not part of the 3.0 Schema Object must not be assumed valid.

### OpenAPI 3.1

- JSON Schema dialect/base URI handling where dependencies expose it.
- `type` arrays including `"null"`; distinguish absent/optional from nullable.
- `const`, boolean schemas, composition, unevaluated/conditional keywords when promised.
- `$ref` sibling behavior and recursion.
- Webhooks and 3.1 request/response schema behavior.

### OpenAPI 3.2

- **Compatible-read evidence:** `openapi: "3.2.x"`, base `paths`/`components`, `$self`, and the implemented basic checks for `query`/`additionalOperations`.
- **Accepted-not-generated boundary:** `querystring`, `itemSchema`, `itemEncoding`, `prefixEncoding`, tag `parent`/hierarchy, `serializedValue`, `dataValue`, and other fields absent from the legacy plugin type model.
- Require every boundary warning to have stable code, field path, non-duplication, JSON serialization, and a focused test.
- Do not call this complete OpenAPI 3.2 support until official output plugins consume the promised constructs.

## Schema feature matrix

### `nullable` and JSON Schema type arrays

- OpenAPI 3.0 `nullable: true` with a concrete `type`.
- OpenAPI 3.0 nullable property that is optional versus required.
- OpenAPI 3.1 `type: ["string", "null"]`.
- More than two types, null-only, missing type, nested array items.
- TypeScript union and Zod runtime acceptance/rejection parity.

### `oneOf`, `anyOf`, `allOf`

- Inline members and referenced members.
- Required/optional property interactions.
- Conflicting `allOf` properties and empty member arrays.
- Nested compositions and discriminators.
- Runtime validator semantics, not only emitted union/intersection syntax.

### Discriminator

- Property name, explicit mapping, implicit schema names, missing mapping target.
- Mapping to local versus external references.
- Interaction with `oneOf`/`anyOf` and generated runtime validation.

### `enum` and `const`

- String/number/boolean/null values, mixed values only where the dialect permits them.
- Duplicate values, identifier collisions, referenced enums, optional/nullable enum.
- Stable emitted member ordering and collision-safe names.
- `const` in OpenAPI 3.1 and an explicit OpenAPI 3.0 invalid/compatibility policy.

### `additionalProperties`

- Missing keyword, `true`, `false`, and schema-valued forms.
- Named properties combined with an index signature.
- Referenced and recursive value schemas.
- TypeScript and Zod parity for unknown keys.

### Recursive schemas

- Direct self-reference, mutual recursion, recursive arrays/maps.
- Cycle detection/visited-set behavior in collectors.
- Stable imports and no infinite traversal or unbounded output.
- Lazy runtime validator construction where required.

### `$ref`

- Internal component reference and escaped JSON Pointer tokens.
- Missing target and wrong component kind.
- Circular reference and `$ref` siblings per target dialect.
- External relative file and URL references only under an explicit I/O/network policy.
- Path traversal, protocol/host redirects, credentials, size, timeout, and error redaction.

## Operation feature matrix

### `requestBody`

- Required/optional body, no schema, multiple media types, referenced request body.
- JSON, form URL encoded, multipart, binary/file shapes.
- Type, Zod, request client, and query/mutation parameter parity.

### Multipart

- File/binary, arrays, primitives, nested objects, optional values, content type.
- Generated `FormData` behavior and runtime availability assumptions.
- Do not infer complete multipart support from one Petstore endpoint.

### Callbacks

- Runtime expression keys, nested paths/operations, references, callback-local schemas.
- Explicitly classify whether callbacks participate in generation or are preserved only.

### Webhooks

- OpenAPI 3.1+ top-level webhooks, path item operations, references, shared components.
- Explicitly classify generated output, preservation, or unsupported diagnostics.

## Evidence template

For each implemented item, record every applicable field:

```text
Dialect/feature:
Support class: complete | compatible-read | accepted-not-generated | unsupported
Valid fixture:
Invalid/unsupported fixture:
Reference fixture:
Loader assertion:
Resolver assertion:
Validator assertion:
Normalizer assertion:
Inspect assertion:
Type output:
Zod output:
Request/query/mock output:
Diagnostic:
Dry-run/check result:
Known boundary:
```
