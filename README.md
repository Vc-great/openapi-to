[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

The current version is not compatible with V2.[V2 document](https://github.com/Vc-great/openapi-to/tree/v2)



# At a glance

`openapi-to` is a TypeScript compiler, CLI, generator toolkit, and local stdio MCP server for Swagger/OpenAPI documents. The published aggregate includes TypeScript type and request generation, Zod schemas, SWR hooks, Vue Query hooks, MSW handlers, and the MCP runtime. Faker, NestJS, and React Query generators are not shipped.

See the single [capability matrix](docs/capability-matrix.md) for exact package, dialect, CLI, and MCP status. Start with the [getting-started guide](docs/getting-started.md); local AI Host setup is documented for [Codex](docs/codex-mcp.md), [Claude Code](docs/ai-hosts/claude-code.md), [Cursor](docs/ai-hosts/cursor.md), and [generic stdio Hosts](docs/ai-hosts/generic-stdio.md).

# Features

- Works with Node.js 20+.
- Supports local JSON/YAML/YML and policy-constrained HTTP(S) inputs for Swagger 2.0, OpenAPI 3.0, and OpenAPI 3.1.
- Reads OpenAPI 3.2 in compatibility mode with explicit diagnostics for generator gaps; this is not complete 3.2 generation support.
- Provides stable `validate`, `inspect`, `diff`, and `generate` CLI contracts with deterministic JSON output and centralized exit codes.
- Provides a local stdio MCP adapter with default read-only modes and operator-gated Prepare/Apply writes.

# Quick Start
## Install
```shell
pnpm add -D openapi-to
```

## Usage 
```json [package.json]
{
  "scripts": {
    "openapi:init": "openapi init",
    "openapi:generate": "openapi g"
  }
}
```

## Commands

`openapi` and `openapi-to` are CLI aliases; `openapi-to-mcp` starts the stdio MCP server. Validation and inspection do not require a generation config.

```shell
pnpm exec openapi init
pnpm exec openapi validate ./openapi.yaml
pnpm exec openapi inspect ./openapi.yaml --json
pnpm exec openapi diff ./old.yaml ./new.yaml --fail-on-breaking
pnpm exec openapi generate --dry-run --json
pnpm exec openapi generate --check --json
pnpm exec openapi-to-mcp --help
pnpm exec openapi-to-mcp --workspace-root .
```

`init` creates `openapi.config.ts` for ESM projects or
`openapi.config.js` for CommonJS projects in the Workspace root and adds only
`/.openapi-to/` to `.gitignore`. Generation searches upward for the nearest
`openapi.config.ts`, `.js`, `.cjs`, or `.mjs`. Multiple supported files in one
candidate directory fail before configuration code executes; use
`--config <path>` when an operator intentionally selects a specific file. The
selected configuration's directory is the generation Workspace, so nested
invocations keep relative inputs and outputs anchored to the project root.

`--json` writes one JSON document to stdout; diagnostics and incidental plugin logs use stderr. `--dry-run` executes plugins and reports the artifact manifest without writing. `--check` performs the same comparison and fails when output is outdated. With `output.clean`, deletion is ownership-based: only files recorded by the previous `.openapi-to-manifest.json` are removed, and unmanaged user files are preserved.

Exit codes are stable: `0` success, `1` general failure, `2` config failure, `3` OpenAPI parse/validation/ref failure, `4` input or remote load failure, `5` plugin failure, `6` outdated generated output, and `7` breaking changes with `diff --fail-on-breaking`.

Remote documents use safe defaults: only HTTP(S), bounded response size and redirects, timeouts, and private/local address blocking including DNS results. Trusted internal APIs must opt in explicitly:

```ts
input: {
  path: 'https://openapi.internal.example.com/api.yaml',
  remote: {
    allowPrivateNetwork: true,
    allowedHosts: ['openapi.internal.example.com'],
    headers: {
      Authorization: process.env.OPENAPI_AUTHORIZATION!,
    },
    timeoutMs: 10_000,
    maxResponseBytes: 10 * 1024 * 1024,
  },
}
```

Configured request headers are retained only across same-Origin redirects. A redirect to a different scheme, hostname, or effective port drops every configured header permanently for the remaining chain; HTTPS-to-HTTP redirects are rejected. JavaScript/TypeScript configuration is trusted executable project code, so operators must inject secrets through their environment or secret platform; `openapi-to` does not provide a general secret manager.

In MCP configured mode, the Target remote policy describes what that Target needs and startup flags describe the operator's maximum authority. The effective policy is their intersection: both layers must explicitly allow private-network access, host allowlists must overlap, and numeric limits use the smaller value. Tool arguments cannot add headers or expand this policy.

Compiler library APIs such as `compileOpenAPI`, `resolveOpenAPIReferences`, `validateOpenAPIDocument`, `inspectOpenAPIDocument`, `diffOpenAPIDocuments`, diagnostics, and `GeneratedArtifact` are exported from both `@openapi-to/core` and `openapi-to`. Existing plugins can keep using `ctx.setSourceFiles`; new plugins may use `ctx.addArtifact` and `ctx.addDiagnostic`.

## Microservices and multiple OpenAPI documents

A Target is one independently generated OpenAPI boundary: a stable name, one input, one output root, and one ownership manifest. An Operation is an endpoint inside that Target. Targets may therefore contain identical `operationId` or Schema names without sharing selection or catalog identity. If one microservice publishes public, admin, and internal documents, configure three Targets rather than merging them implicitly.

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
      name: 'payment-service',
      input: {
        path: 'https://api.example.com/openapi?service=payment',
      },
      output: { dir: 'payment' },
    },
  ],
})
```

`input.path` parsing uses response content and Content-Type as well as the URL/path suffix, so extensionless and query-bearing HTTP(S) URLs are supported. `output.base` defaults to `managed`: `dir: 'payment'` still writes to `.openapi-to/payment`. `base: 'workspace'` writes below the Workspace, keeps the ownership manifest in that generated root, and remains generator-managed. Keep hand-written extensions elsewhere, such as `src/api/custom`; generated source is not an eject/scaffold boundary.

Local `input.path` accepts Workspace-relative paths and absolute paths that remain inside the Workspace, including native Windows `C:\...` or `C:/...` paths. Windows drive-relative paths such as `C:openapi.yaml`, UNC paths, and `file:` URLs are rejected. `output.dir` must be portable across Linux, macOS, and Windows: reserved device names, reserved characters, control characters, and segments ending in a period or space are invalid.

`openapi generate` processes all Targets. Repeat `--target` to select services; duplicates are removed and configuration order is preserved. Unknown names and unsafe/overlapping configured outputs fail before any Target writes. Multi-Target CLI generation preflights all selected inputs, then commits each Target independently—it is not a cross-directory global transaction. Whether a generated directory is committed to Git is independent of whether its base is `managed` or `workspace`.

## Release verification

The repository and all published packages require Node.js 20 or newer and use pnpm 10.14.0. Maintainers verify release candidates with the tracked Changesets plan and real local installation smoke tests:

```shell
pnpm exec changeset status
pnpm lint:changed
pnpm build
pnpm test:release-scripts
pnpm test:consumer:codegen
pnpm verify:package-surface
pnpm release:smoke
```

`test:consumer:codegen` proves that the packed aggregate package can generate
and strictly compile real TypeScript, Zod, and request-client output in an
independent consumer. See the
[packed formal-plugin consumer guide](docs/testing/consumer-codegen.md) for
debugging, retained temporary workspaces, and the compact generated-code review
snapshot.

`release:smoke` packs every public workspace package and verifies ESM, CJS,
declarations, all three aggregate binaries, an aggregate-only installation,
real formal-plugin code generation, real MCP stdio startup, and
machine-readable CLI output in temporary consumers. It does not publish.

## MCP verification

The repository exposes stable, package-owned MCP gates instead of relying only
on indirect full-suite discovery:

```shell
pnpm test:mcp:all
pnpm mcp:check
pnpm mcp:inspect                 # safe read-only fixture
pnpm mcp:inspect -- --allow-write # explicit synthetic Prepare/Apply fixture
```

`mcp:check` runs the built stdio Server through the official MCP SDK and reports
the 3/8/10 Tool matrices plus controlled-write health. `mcp:inspect` is a
foreground, authenticated localhost launcher for manual review; it is never an
automated failpoint or crash-recovery gate. See the
[MCP test strategy](docs/testing/mcp-testing.md) and
[Inspector guide](docs/testing/mcp-inspector.md).

OpenAPI 3.2 support and the first-stage diff boundary are maintained in the [capability matrix](docs/capability-matrix.md), not duplicated here.
## Example
```typescript twoslash [single]
import { defineConfig, pluginTSRequest, pluginTSType, pluginZod } from 'openapi-to'


export default defineConfig({
  servers:[
    {
      input: {
        path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
      },
       output:{
         dir:'server'
      }
    }
  ],
  plugins: [
    pluginZod(),
    pluginTSType(),
    pluginTSRequest({
      parser: 'zod',
      requestClient: 'axios',
      requestImportDeclaration: {
        moduleSpecifier: '@/utils/request',
      },
      requestConfigTypeImportDeclaration: {
        namedImports: ['AxiosRequestConfig'],
        moduleSpecifier: 'axios',
      }
    })
  ]
})
```
# defineConfig
When using TypeScript/JavaScript you should consider using defineConfig.

# Options
By setting the following options you can override the default behavior of openapi-to and even extend it with your plugins.
## servers
An array of server configurations. Each configuration defines the input source and output destination for the generated code.

### input
You can use either input.path, depending on your specific needs.

**input.path**
Specify a local `.json`, `.yaml`, or `.yml` document inside the trusted local-file boundary, or an `http:`/`https:` URL. Format detection is content-aware and does not require a matching extension.

| Type     | string |
| -------- | ------ |
| Required | True   |

```ts
import { defineConfig } from 'openapi-to'
export default defineConfig({
  servers:[
    {
      input: {
        path:'https://petstore.swagger.io/v2/swagger.json'
      }
    }
  ]
})
```

### output

**output.dir**

The relative directory below `output.base`.

**output.base**

`'managed' | 'workspace'`, defaulting to `'managed'`. Managed output resolves below `.openapi-to`; Workspace output resolves below the project root. Both modes are generator-owned, reject traversal, absolute/UNC/drive paths, symlink escapes, protected state, and overlapping Target roots, and store `.openapi-to-manifest.json` inside the resolved output root.

Switching an existing Target from managed to workspace output does not move, copy, or remove the old `.openapi-to` directory. Verify the new output and remove the old managed output manually if it is no longer needed.

**output.clean**  

Clean the output directory before each build.

| Type: 类型：     | `boolean` |
| :--------------- | --------- |
| Required: 必填： | `false`   |

```ts
import { defineConfig } from 'openapi-to'
export default defineConfig({
  servers:[
    {
      input: {
        path:'https://petstore.swagger.io/v2/swagger.json'
      },
       output:{
         dir:'server'
      }
    }
  ]
})
```

#### output.format 

Specifies the formatting tool to be used.

| Type:     | ` 'biome'` |
| :-------- | :--------- |
| Required: | `false`    |
| Default:  |            |



# plugins

## pluginTSRequest

The  plugin enables you to generate API controllers, simplifying the process of handling API requests and improving integration between frontend and backend services.

By default, we are using [Axios](https://axios-http.com/docs/intro) but you can also add your own client.

**parser**

Which parser should be used before returning the data.

| Type     | Zod   |
| -------- | ----- |
| Required | false |
| Default  |       |

**requestClient**

Request the client

| Type     | axios\|common |
| -------- | ------------- |
| Required | false         |
| Default  | axios         |

axios

```ts
//...
export async function addPetService(data: AddPetMutationRequest, requestConfig?: Partial<AxiosRequestConfig<AddPetMutationRequest>>) {
  const res = await request<AddPetMutationResponse, AxiosResponse<AddPetMutationResponse, AddPetMutationRequest>, AddPetMutationRequest>({
    method: 'POST',
    url: '/pet',
    data: data,
    ...requestConfig
  });
  return res;
}
//...
```

common

```ts
export async function addPetService(data: AddPetMutationRequest, requestConfig?: Partial<AxiosRequestConfig>) {
  const res = await request<AddPetMutationResponse>({
    method: 'POST',
    url: '/pet',
    data: data,
    ...requestConfig
  });
  return res
}
```

**requestImportDeclaration**

Request the client Import

| Type     | String          |
| -------- | --------------- |
| Required | false           |
| Default  | @/utils/request |

**requestConfigTypeImportDeclaration**

Request Configuration Type Import

**requestConfigTypeImportDeclaration.namedImports**

Request Configuration Type name

| Type     | String               |
| -------- | -------------------- |
| Required | false                |
| Default  | [AxiosRequestConfig] |

**requestConfigTypeImportDeclaration.moduleSpecifier**

Request Configuration Type module

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | axios  |

```ts
 requestConfigTypeImportDeclaration: {
    namedImports: ['AxiosRequestConfig'],
    moduleSpecifier: 'axios',
  }
```

**importWithExtension**

Whether to add an extension (such as .ts) in the import path

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | true   |

**dataReturnType**

ReturnType that will be used when calling the client.Use dataReturnType only in get method

| Type     | String |
| -------- |--------|
| Required | false  |
| Default  |        |

**Example**

```ts
pluginTSRequest({
  parser: 'zod',
  dataReturnType:'data',
  requestClient: 'axios',
  requestImportDeclaration: {
    moduleSpecifier: '@/utils/request',
  },
  requestConfigTypeImportDeclaration: {
    namedImports: ['AxiosRequestConfig'],
    moduleSpecifier: 'axios',
  },
   importWithExtension:false
})
```



**pluginTSType**

With the TypeScript plugin you can create [TypeScript](https://www.typescriptlang.org/) types.

**importWithExtension**

Whether to add an extension (such as .ts) in the import path

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | true   |


## pluginZod
With the Zod plugin you can use [Zod](https://zod.dev/) to validate your schemas.

**importWithExtension**

Whether to add an extension (such as .ts) in the import path

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | true   |

## pluginSWR

With the SWR plugin you can create [SWR hooks](https://swr.vercel.app/) based on an operation.



**infinite**

useSWRInfinite Related configurations

**infinite.pageNumParam**

Generate useSWRInfinite based on pageNumParam

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  |        |

**importWithExtension**

Whether to add an extension (such as .ts) in the import path

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | true   |



**Example**

```ts
    pluginSWR({
      infinite: {
        pageNumParam: 'pageNum'
      },
      importWithExtension:false
    })
```



## pluginVueQuery

With the VueQuery plugin you can create [VueQuery hooks](https://tanstack.com/query/latest/docs/framework/vue/overview) based on an operation.

**requestConfigTypeImportDeclaration**

Request Configuration Type Import

**requestConfigTypeImportDeclaration.namedImports**

Request Configuration Type name

| Type     | String               |
| -------- | -------------------- |
| Required | false                |
| Default  | [AxiosRequestConfig] |

**requestConfigTypeImportDeclaration.moduleSpecifier**

Request Configuration Type module

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | axios  |


**responseErrorTypeImportDeclaration**

响应错误类型的 import 声明

**responseErrorTypeImportDeclaration.namedImports**

响应错误类型名称

| Type     | Array\<string> |
| -------- | -------------- |
| Required | false          |
| Default  | [AxiosError]   |

**responseErrorTypeImportDeclaration.moduleSpecifier**

响应错误类型的模块

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | Axios  |

**importWithExtension**

Whether to add an extension (such as .ts) in the import path

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | true   |

**placeholderData**

Placeholder data configuration when generating hooks

**placeholderData.value**

The value of the placeholder data,When there is no pathInclude attribute, it will be added to all get methods.

| Type     | any    |
| -------- | ------ |
| Required | false  |
| Default  |        |

**placeholderData.pathInclude**

Which paths contain placeholder data (string or regular)

| Type     | Array\<string\|RegExp> |
| -------- | ---------------------- |
| Required | false                  |
| Default  | []                     |

**dataReturnType**

ReturnType that will be used when calling the client.Use dataReturnType only in get method

| Type     | String |
| -------- |--------|
| Required | false  |
| Default  |        |


**Example**

```ts
pluginVueQuery({
  dataReturnType:'data',
  requestConfigTypeImportDeclaration: {
    namedImports: ['AxiosRequestConfig'],
    moduleSpecifier: 'axios',
  },
  responseErrorTypeImportDeclaration: {
    namedImports: ['AxiosError'],
    moduleSpecifier: 'axios',
  },
  importWithExtension: false,
  placeholderData: {
    value: 'keepPreviousData',
    pathInclude: ['/pet', /^\/user/]
  }
})
```



## pluginMSW

With the MSW plugin you can create [mswjs hooks](https://mswjs.io/docs/) based on an operation.

**importWithExtension**

Whether to add an extension (such as .ts) in the import path

| Type     | String |
| -------- | ------ |
| Required | false  |
| Default  | true   |



**Example**

```ts
    pluginMSW({
      importWithExtension:false
    })
```
