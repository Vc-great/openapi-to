# Operation Catalog and bounded contract discovery

Phase 1 adds read-only, on-demand operation discovery for large OpenAPI documents. It does not change generation, artifact ownership, or the controlled Prepare/Apply writer.

```text
startup-trusted target
  -> compile / resolve / normalize
  -> Operation Catalog
  -> lexical search
  -> one operation contract
  -> bounded MCP structured output
```

`@openapi-to/core` builds the catalog from one existing compiler result. Catalog entries contain stable identity, method/path, tags, bounded text, parameter names, referenced request/response Schema names, response property names, deprecation, and a JSON Pointer. They do not expose an Operation Object or the complete document. Search is deterministic local lexical matching; it uses no embedding service, vector database, or network dependency.

## Stable operation identity

Within one target, a non-empty unique `operationId` is the `operationKey`. A missing or duplicated `operationId` falls back to normalized `METHOD + path`, such as `GET /users/{id}`. Core emits `MISSING_OPERATION_ID`, `DUPLICATE_OPERATION_ID`, and `OPERATION_KEY_FALLBACK_USED`; fallback operations remain searchable. Target identity is outside the key, so registries must always partition catalogs by target.

## Two-stage MCP workflow

Catalog Tools exist only when the operator supplied a startup-trusted config:

1. `openapi_list_targets` discovers safe target names and counts without exposing source locations, URLs, headers, environment values, or config bodies.
2. `openapi_search_operations` returns at most eight lightweight candidates by default. Results contain no request/response Schema bodies.
3. `openapi_get_operation` reads one selected `operationKey` at `summary` or `contract` detail.

Example:

```text
User asks for a user-resource trend page
  -> openapi_search_operations(target="backend", query="用户资源趋势")
  -> AI compares the bounded candidates
  -> openapi_get_operation(target="backend", operationKey="getUserResourceTrend")
  -> AI confirms request and response shapes
  -> Phase 1 still uses the existing full-generation workflow when generation is requested
```

One-interface-per-Tool is intentionally rejected: Tool metadata would grow with the document, inflate every model context, and turn operation identity changes into protocol surface changes. The three fixed catalog Tool descriptions do not grow with operation count.

## Contract and Schema limits

The Core defaults are `schemaDepth=2`, `maxSchemas=20`, `maxPropertiesPerSchema=50`, `includeExamples=false`, and a 128 KiB contract budget. MCP search defaults to eight candidates and caps a request at 50. MCP also applies its configured diagnostic and total structured-result byte budgets. `$ref`, object properties, required, arrays/items, enum, `allOf`, `oneOf`, `anyOf`, `additionalProperties`, nullable, discriminator, and cycles are summarized only within these limits. Cycles terminate with a `circular` marker.

Limit hits set `truncated=true`, add stable reasons, and report unresolved references; they are never silent. Neither Tool returns the complete OpenAPI document, complete `components.schemas`, all operation details, or an unbounded dereference closure.

## Trusted target cache

The MCP registry extends the existing process-lifetime trusted-config state. Its cache key binds the trusted config display identity, target name, and configured source identity. Concurrent first loads share one Promise. Failed compilation is removed so a later call can retry; successful targets remain isolated and cached until Server shutdown. There is no watcher or automatic refresh. Restart the MCP Server after changing config or OpenAPI input.

## Phase boundary

Phase 1 remains read-only discovery. It does not implement operation selection for generation, OpenAPI projection, a complete Schema dependency closure, selective dry-run, selection manifests, or generated-file writes. Existing code generation remains full-target generation. Search and contract reading never generate, repair, delete, or write code.
