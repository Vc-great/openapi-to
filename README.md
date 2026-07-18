[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

The current version is not compatible with V2.[V2 document](https://github.com/Vc-great/openapi-to/tree/v2)



# At Glance
openapi-to is a library and toolkit that transforms your Swagger/OpenAPI specification into various client libraries, including:
+ [x] ts request
+ [x] ts type
+ [x] zod
+ [x] SWR
+ [x] MSW
+ [ ] Faker.js
+ [ ] nestjs
+ [x] vue-Query
+ [ ] react-Query

# Features
- Works with Node.js 20+.
- Supports JSON and YAML inputs for Swagger 2.0, OpenAPI 3.0, and OpenAPI 3.1.
- Recognizes OpenAPI 3.2 in compatibility mode. 3.2-only fields are preserved and reported when existing generators do not consume them.

# Quick Start
## Install
```shell [npm]
npm i openapi-to --save-dev
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

## Compiler commands

The `openapi` and `openapi-to` binaries are aliases. Validation and inspection do not require a generation config.

```shell
openapi validate ./openapi.yaml
openapi inspect ./openapi.yaml --json
openapi diff ./old.yaml ./new.yaml --fail-on-breaking
openapi generate --dry-run --json
openapi generate --check --json
```

`--json` writes one JSON document to stdout; diagnostics and incidental plugin logs use stderr. `--dry-run` executes plugins and reports the artifact manifest without writing. `--check` performs the same comparison and fails when output is outdated. With `output.clean`, deletion is ownership-based: only files recorded by the previous `.openapi-to-manifest.json` are removed, and unmanaged user files are preserved.

Exit codes are stable: `0` success, `1` general failure, `2` config failure, `3` OpenAPI parse/validation/ref failure, `4` input or remote load failure, `5` plugin failure, `6` outdated generated output, and `7` breaking changes with `diff --fail-on-breaking`.

Remote documents use safe defaults: only HTTP(S), bounded response size and redirects, timeouts, and private/local address blocking including DNS results. Trusted internal APIs must opt in explicitly:

```ts
input: {
  path: 'https://openapi.internal.example.com/api.yaml',
  remote: {
    allowPrivateNetwork: true,
    allowedHosts: ['openapi.internal.example.com'],
    timeoutMs: 10_000,
    maxResponseBytes: 10 * 1024 * 1024,
  },
}
```

Compiler library APIs such as `compileOpenAPI`, `resolveOpenAPIReferences`, `validateOpenAPIDocument`, `inspectOpenAPIDocument`, `diffOpenAPIDocuments`, diagnostics, and `GeneratedArtifact` are exported from both `@openapi-to/core` and `openapi-to`. Existing plugins can keep using `ctx.setSourceFiles`; new plugins may use `ctx.addArtifact` and `ctx.addDiagnostic`.

## Release verification

The repository and all published packages require Node.js 20 or newer and use pnpm 10.14.0. Maintainers verify release candidates with the tracked Changesets plan and real local installation smoke tests:

```shell
pnpm exec changeset status
pnpm lint:changed
pnpm build
pnpm verify:package-surface
pnpm release:smoke
```

`release:smoke` packs every public workspace package and verifies ESM, CJS, declarations, the `openapi`/`openapi-to` aliases, and machine-readable CLI output in a temporary consumer. It does not publish.

OpenAPI 3.2 support is intentionally incremental. `$self` participates in reference base resolution and the document, info, paths, components, and standard operations remain readable. New 3.2 fields such as `query`, `additionalOperations`, `querystring`, streaming `itemSchema`/encoding fields, and tag hierarchy are inspected and diagnosed, but existing TypeScript generators do not yet emit code from them. The first-stage diff engine covers paths, operations, parameters, request/response schemas, component properties, required state, enums, and types; less certain schema-composition changes are reported as warnings rather than claimed as definitive compatibility results.
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
Specify your Swagger/OpenAPI file, either as an absolute path or a path relative to the root.

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

The dir where all generated files will be exported. Directory is in the .OpenAPI folder

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
