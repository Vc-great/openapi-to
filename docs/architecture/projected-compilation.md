# Projected OpenAPI compilation and selective dry-run

Phase 2A adds an in-memory generation scope for previewing one or more operations. Phase 2 B2b reuses that projection in controlled Selective Prepare/Apply while keeping Prepare side-effect free and the default full-target generation path unchanged. See [persistent operation selection](./persistent-operation-selection.md).

```text
startup-trusted target
  -> process-local cached OpenAPICompilation + Operation Catalog
  -> exact operationKey selection
  -> component reference graph and closure
  -> projected OpenAPICompilation
  -> existing PluginManager and generators
  -> bounded GeneratedArtifact summaries
  -> MCP dry-run only
```

`GenerationScope` has two forms. An omitted scope and `{ type: 'full' }` retain the existing full generation behavior. `{ type: 'operations', operationKeys: [...] }` deduplicates and sorts exact keys, permits exactly one trusted target in the MCP Tool, and never performs fuzzy search during generation. Search fallback keys remain valid catalog identities, but selective generation blocks operations whose `operationId` is missing or duplicated because the current generators use `operationId` for stable public names.

OpenAPI 3.2 documents containing standard HTTP operations can be projected through the existing compatible-read adapter. The 3.2 `query` method and `additionalOperations` remain diagnosed generation gaps; selecting one fails with `SELECTIVE_GENERATION_UNSUPPORTED_OPERATION` instead of silently producing no operation artifact.

## Projection rules

The projected document keeps OpenAPI version, `info`, relevant root servers and extensions, inherited root security when selected operations do not override it, selected tags, selected paths/methods, path-level parameters/metadata, and the selected operation objects. Other methods on the same path are removed.

Core builds an explicit graph for named `schemas`, `parameters`, `requestBodies`, `responses`, `headers`, `securitySchemes`, `callbacks`, `links`, and `examples`. Generic object traversal covers `$ref` plus Schema composition and container keywords including properties, items, prefixItems, allOf/oneOf/anyOf/not, additionalProperties, contains, dependentSchemas, propertyNames, and discriminator mappings. Operation roots also add inherited security scheme names. A visited/active traversal computes the transitive component closure, preserves named local `$ref` values, and terminates cycles without inlining the complete graph.

Projection never loads a source. A non-local reference is replaced only from the already-resolved node in the cached compilation. If that compiled value cannot be reused, projection fails with a structured reference diagnostic instead of fetching or returning a partial document. The projected compilation retains source identity, reference snapshots, compiler diagnostics, and version metadata, while replacing `document`, `resolvedDocument`, and `normalizedDocument` with their projected forms.

`projectionHash` is SHA-256 over the projection format version, target identity, root source content hash, OpenAPI version, sorted operation keys, and normalized projected document. It excludes paths, process IDs, time, and randomness. Target compilation is cached for the MCP Server lifetime; projection is deliberately recomputed per request and has no disk or process-level projection cache.

## Artifact granularity

Projection is the common selection boundary; plugins do not receive separate selection branches.

| Plugin | Operation | Tag | Component/schema | Global |
| --- | --- | --- | --- | --- |
| TypeScript types | one operation file | none | schemas, parameters, request bodies, responses | enum model |
| TypeScript request/client | one operation file | none | consumes type metadata | none |
| SWR | one operation file | none | consumes operation/type metadata | none |
| Vue Query | one operation file | none | consumes operation/type metadata | none |
| Zod | one operation file | none | schemas, parameters, request bodies, responses | none |
| MSW | one operation file | none | consumes operation/type metadata | none |

There is no React Query plugin or generated index/barrel plugin in this repository revision. Operation files therefore naturally follow the selected operation set, component files follow the reference closure, and the TypeScript enum model is rebuilt from the projected document. Plugin build state remains invocation-scoped; `OperationAccessor` now caches by operation object identity in a `WeakMap`, preventing equal method/path pairs in different targets from sharing metadata.

## MCP workflow and safety boundary

```text
User asks for a user-detail page
  -> openapi_search_operations(target="backend", query="user detail")
  -> openapi_get_operation(target="backend", operationKey="getUserDetail")
  -> openapi_generate_dry_run(
       targets=["backend"],
       scope={ type: "operations", operationKeys: ["getUserDetail"] }
     )
  -> bounded projection statistics and artifact summaries
  -> Phase 2A ends without writing files
```

Selective dry-run uses only startup-trusted config, plugins, targets, Workspace, remote policy, and output root. It does not accept a source, config path, plugin, output path, content, clean/delete policy, or write authority. It does not create a plan, take the write lock, update an ownership manifest, stage files, or invoke Prepare/Apply. Artifact counts and previews remain under the existing MCP limits, and neither the projected document nor complete components are returned.

Phase 2 B1 defines the project selection manifest, additive union, and selection/projection/artifact plan binding. It still writes nothing. Phase 2 B2 may revalidate and atomically commit the selected artifacts plus ownership and selection manifests.
