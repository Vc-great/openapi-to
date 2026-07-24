# openapi-to

`openapi-to` is the aggregate package for the OpenAPI compiler, CLI, and official TypeScript generator plugins.

```sh
pnpm add -D openapi-to
pnpm exec openapi --help
```

The package installs `openapi` and `openapi-to` as aliases of the same CLI entrypoint. It exports Core plus:

- `pluginTSType`
- `pluginTSRequest`
- `pluginZod`
- `pluginSWR`
- `pluginVueQuery`
- `pluginMSW`

Faker, NestJS, and React Query generators are not included.

See the repository [getting-started guide](../../docs/getting-started.md) and [capability matrix](../../docs/capability-matrix.md).
