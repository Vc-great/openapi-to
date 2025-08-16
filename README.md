[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

The current version is not compatible with V2.[V2 document](https://github.com/Vc-great/openapi-to/tree/v2)



# At Glance
openapi-to is a library and toolkit that transforms your Swagger/OpenAPI specification into various client libraries, including:
+ [x] ts request
+ [x] ts type
+ [x] zod
+ [x] SWR
+ [ ] Faker.js
+ [ ] MSW
+ [ ] nestjs
+ [x] vue-Query
+ [ ] react-Query

# Features
- Works with Node.js 20+.
- Supports Swagger 2.0, OpenAPI 3.0, and OpenAPI 3.1.

# Quick Start
## Install
```shell [npm]
npm i openapi-to --save-dev
```


## Usage 1
```js
  npx openapi init  // Generate openapi.config.ts file
  npx openapi g     // Generate code from the openapi.config.ts file
```

## Usage 2
```json [package.json]
{
  "scripts": {
    "openapi:init": "openapi init",
    "openapi:generate": "openapi g"
  }
}
```
## Example
```typescript twoslash [single]
import { defineConfig, pluginSWR, pluginTSRequest, pluginTSType, pluginZod } from 'openapi-to'


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
    pluginSWR(),
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
  ]
})
```

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

**Example**

```ts
pluginTSRequest({
  parser: 'zod',
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

**Example**

```ts
pluginVueQuery({
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
