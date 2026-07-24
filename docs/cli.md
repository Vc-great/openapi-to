# CLI generation guide

The `openapi` and `openapi-to` binaries are aliases over the same Core compiler, Target selector, output resolver, artifact comparison, ownership writer, and output lock. MCP is an additional entrypoint; it does not replace the manual CLI.

## Targets

A Target is a stable, independently generated boundary with one OpenAPI input, one output root, and one ownership manifest. An Operation is an endpoint inside a Target. The same `operationId`, path, tag, or Schema name may exist in different Targets.

```ts
export default defineConfig({
  servers: [
    {
      name: 'user-service',
      input: { path: './openapi/user.json' },
      output: {
        base: 'workspace',
        dir: 'src/api/generated/user',
        clean: true,
      },
    },
    {
      name: 'order-service',
      input: { path: './openapi/order.yaml' },
      output: {
        base: 'workspace',
        dir: 'src/api/generated/order',
        clean: true,
      },
    },
    {
      name: 'legacy-service',
      input: { path: './openapi/legacy.yml' },
      output: { dir: 'legacy' },
    },
  ],
})
```

Names must be non-empty, normalized, and unique. Legacy unnamed entries retain `server1`, `server2`, and so on, but explicit stable names are recommended for microservices because target selection, catalog identity, diagnostics, plans, selection state, and ownership all bind to the name.

If one service provides multiple documents, configure multiple Targets such as `user-public`, `user-admin`, and `user-internal`. The CLI does not scan, glob, merge, or dynamically aggregate documents.

## Commands

```sh
# Generate every configured Target
openapi generate

# Generate one Target
openapi generate --target user-service

# Generate two Targets in configuration order
openapi generate \
  --target user-service \
  --target order-service

# Preview selected Targets without writing
openapi generate \
  --target user-service \
  --dry-run \
  --json

# Check only the selected Target
openapi generate \
  --target payment-service \
  --check \
  --json
```

Repeated names are deduplicated. An unknown name, including a mixture of valid and unknown names, fails before generation writes. An unselected Target is not generated, cleaned, checked, or used to determine the check exit code. Output order follows configuration order.

Before writing, Core validates all configured Target names and output roots, validates every requested name, and compiles every selected input. This prevents a later invalid selected input or output from appearing only after an earlier Target has written. Once plugin execution and commit begin, each Target has an independent ownership/transaction boundary; multi-Target CLI generation does not promise a global rollback across output roots.

## Inputs

`input.path` accepts Workspace-confined local JSON, YAML, and YML files plus HTTP(S) URLs. Parsing considers actual content, Content-Type, and then the extension, so extensionless URLs, query strings, JSON returned from a YAML-looking URL, YAML returned as `text/plain`, and external remote `$ref` documents use the same loader.

Only `http:` and `https:` are remote protocols. Remote loading applies bounded redirects, per-hop protocol/host/private-network checks, connection-time DNS checks, timeout, decompressed response-size limits, cancellation, status diagnostics, and URL credential/query redaction. Authentication headers, tokens, cookies, and output paths are not CLI/MCP per-call arguments; any existing remote settings live in trusted project/server configuration.

## Output bases and ownership

```ts
output: {
  dir: 'generated',
}
```

remains equivalent to:

```ts
output: {
  base: 'managed',
  dir: 'generated',
}
```

and resolves to `.OpenAPI/generated`. `base: 'workspace'` resolves `dir` below the Workspace, for example `src/api/generated/user-service`. Both are generator-managed and place `.openapi-to-manifest.json` inside the resolved output root. Operation selection stays in `.OpenAPI/selections`.

Workspace output is suitable for direct project imports and may be committed to Git, but it is not user-owned: future generation may update or remove owned files. Put hand-written extensions in a separate directory such as `src/api/custom`. Output roots may not be the Workspace root, `.git`, `node_modules`, reserved `.OpenAPI` control state, an escaping/symlinked path, or equal to/inside/above another Target output.

Changing an existing Target from managed output to workspace output never migrates or deletes the old directory. Generate and verify the new output, then clean the old `.OpenAPI` output manually if appropriate.
