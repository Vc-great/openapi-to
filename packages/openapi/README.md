# openapi-to

`openapi-to` is the aggregate package for the OpenAPI compiler, CLI, official TypeScript generator plugins, and local stdio MCP server.

```sh
pnpm add -D openapi-to
pnpm exec openapi --help
pnpm exec openapi-to-mcp --help
```

The package installs `openapi` and `openapi-to` as aliases of the same CLI entrypoint and installs the separate `openapi-to-mcp` stdio command. It exports Core plus:

- `pluginTSType`
- `pluginTSRequest`
- `pluginZod`
- `pluginSWR`
- `pluginVueQuery`
- `pluginMSW`

Faker, NestJS, and React Query generators are not included.

The aggregate depends on `@openapi-to/mcp` at runtime only to provide the shared command. MCP server APIs remain available from `@openapi-to/mcp` and `@openapi-to/mcp/cli`; they are intentionally not re-exported from the `openapi-to` top-level JavaScript API.

See the repository [getting-started guide](../../docs/getting-started.md) and [capability matrix](../../docs/capability-matrix.md).
