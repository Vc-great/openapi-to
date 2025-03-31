[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

The current version is not compatible with V1.[V1 document](https://github.com/Vc-great/openapi-to/tree/v1)


# At Glance
Generate SDKs,OpenAPI to:

+ [x] ts request
+ [x] ts type
+ [x] zod
+ [x] Faker.js
+ [x] MSW
+ [x] nestjs
+ [x] SWR
+ [ ] vue-Query
+ [ ] react-Query

OpenAPI Specifications are supported:
- swagger 2.0
- openapi 3.0

# Quick Start
## Install
```shell [npm]
npm i openapi-to -g
```


## Usage 1
```js
  openapi init  // Generate openapi.config.js file
  openapi g     // Generate code from the openapi.config.js file
```

## Usage 2
::: code-group
```json [package.json]
{
  "scripts": {
    "init": "openapi init",
    "openapi generate": "openapi g"
  }
}
```
:::
## Example
::: code-group
```typescript twoslash [single]
import {
  defineConfig,
  createTSRequest,
  createTSType,
  createZod,
  createFaker,
  createMSW,
  createNestjs,
} from "openapi-to";

export default defineConfig({
  servers: [
    {
      input: {
        path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
      },
      output:{
       dir:'server' //.OpenAPI/server
    }
    },
  ],
  plugins: [
    createTSRequest(),
    createTSType(),
    createZod(),
    createFaker(),
    createMSW(),
    createNestjs(),
  ]
});
```
```typescript twoslash [multiple]
import {
  defineConfig,
  createTSRequest,
  createTSType,
  createZod,
  createFaker,
  createMSW,
  createNestjs,
} from "openapi-to";

export default defineConfig({
  servers: [
    {
      input: {
        path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
      },
      output:{
       dir:'server' //.OpenAPI/server
    }
    },
    {
      input: {
        path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
      },
      output:{
        dir:'server2' //.OpenAPI/server2
      }
    }
  ],
  plugins: [
    createTSRequest(),
    createTSType(),
    createZod(),
    createFaker(),
    createMSW(),
    createNestjs(),
  ]
});
````
:::
# plugins
## createTSRequest


| Name                                          | Description                | Type    | Default |
| --------------------------------------------- |----------------------------| ------- |---------|
| createZodDecorator                            | create zod decorator       | boolean | false   |
| compare                                       | Experimental features      | boolean | false   |
| zodDecoratorImportDeclaration.moduleSpecifier | zod Ddecorator Import from | string  | -       |
| requestImportDeclaration.moduleSpecifier      | request Import from        | string  | -       |
| requestType                                   | axios,common               | enum    | axios   |

### example

```ts
createTSRequest({
    createZodDecorator: true,
    requestType:'axios',
    zodDecoratorImportDeclaration: {
        moduleSpecifier: "./test/zod",
    },
    requestImportDeclaration: {
        moduleSpecifier: "./test/request",
    },
})

```

### requestType

axios

```ts
//...
async create(data: Pet.CreateMutationRequest) {
    const res = await request<Pet.CreateMutationResponse, AxiosResponse<Pet.CreateMutationRequest>, Pet.CreateMutationRequest>({
        method: 'post',
        url: `/pet`,
        data
    })
    return res.data
}
//...
```

common

```ts
//...
create(data: Pet.CreateMutationRequest): Promise<Pet.CreateMutationResponse> {
    return request({
        method: 'post',
        url: `/pet`,
        data
    })
}
//...
```

commonWithArrayResponse

```ts
//...
async create(data: Pet.CreateMutationRequest): Promise<[Pet.CreateError, Pet.CreateMutationResponse]> {
    const res = await request({
        method: 'post',
        url: `/pet`,
        data
    })
    return res.data
}
//...
```






## Zod 
Adding zod is mainly used for end-to-end verification. ZodDecorator will add three methods to the request method. You need to implement the specific logic yourself. An example is given for your reference.

- paramsZodSchema

  Collect request parameters zodSchema

```ts
@paramsZodSchema(ZOD.uploadImagePostBodyRequest)
```
- responseZodSchema 

  Collect response parameters zodSchema

```ts
@responseZodSchema(ZOD.uploadImagePostResponse)
```
- zodValidate 

  Use  zodSchema for verification

@zodValidate
example 

```ts

import _ from "lodash";
export function zodValidate(target: object, propertyKey: string, descriptor) {
const fn = descriptor.value;
descriptor.value = async (...args) => {
args.forEach((item, index) => {
const zodSchema = _.get(target, `_zodSchema.${propertyKey}.${index}`);
if (!zodSchema) {
return "";
}
const safeParse = zodSchema.safeParse(item);
!safeParse.success &&
console.error(
`[${propertyKey}]request params error`,
safeParse.error
);
});
//
const result = await fn(...args);
//response 
const responseZodSchema = _.get(
target,
`_zodSchema.${propertyKey}.responseZodSchema`
);
const safeParse = responseZodSchema.safeParse(result[1]);
result[1] &&
!safeParse.success &&
console.error(`[${propertyKey}]response error`, safeParse.error);

    return result;
};
}

export const responseZodSchema =
(zodSchema) => (target: object, propertyKey: string, descriptor) => {
_.set(target, `_zodSchema.${propertyKey}.responseZodSchema`, zodSchema);
};

export const paramsZodSchema =
(zodSchema) => (target: object, propertyKey: string, index) => {
_.set(target, `_zodSchema.${propertyKey}.${index}`, zodSchema);
};
```



<details> 
<summary>ts request</summary>

```ts
import type { Pet } from "./pet.schema";
import type { AxiosResponse } from "axios";
import { request } from "@/utils/request";
import type { AxiosRequestConfig } from "axios";

/**
 * @tag pet
 * @description Everything about your Pets
 */
class PetService {
  /**
   * @summary Update an existing pet
   * @description Update an existing pet by Id
   */
  async update(data: Pet.UpdateMutationRequest, requestConfig?: Partial<AxiosRequestConfig<Pet.UpdateMutationRequest>>) {
    const res = await request<Pet.UpdateMutationResponse, AxiosResponse<Pet.UpdateMutationResponse>, Pet.UpdateMutationRequest>({
      method: 'PUT',
      url: `/pet`,
      data,
      ...requestConfig
    })
    return res.data
  }

  /**
   * @summary Add a new pet to the store
   * @description Add a new pet to the store
   */
  async create(data: Pet.CreateMutationRequest, requestConfig?: Partial<AxiosRequestConfig<Pet.CreateMutationRequest>>) {
    const res = await request<Pet.CreateMutationResponse, AxiosResponse<Pet.CreateMutationResponse>, Pet.CreateMutationRequest>({
      method: 'POST',
      url: `/pet`,
      data,
      ...requestConfig
    })
    return res.data
  }

  /**
   * @summary Finds Pets by status
   * @description Multiple status values can be provided with comma separated strings
   */
  async findByStatusGet(params?: Pet.FindByStatusGetQueryParams, requestConfig?: Partial<AxiosRequestConfig>) {
    const res = await request<Pet.FindByStatusGetQueryResponse, AxiosResponse<Pet.FindByStatusGetQueryResponse>, unknown>({
      method: 'GET',
      url: `/pet/findByStatus`,
      params,
      ...requestConfig
    })
    return res.data
  }

  /**
   * @summary Finds Pets by tags
   * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
   */
  async findByTagsGet(params?: Pet.FindByTagsGetQueryParams, requestConfig?: Partial<AxiosRequestConfig>) {
    const res = await request<Pet.FindByTagsGetQueryResponse, AxiosResponse<Pet.FindByTagsGetQueryResponse>, unknown>({
      method: 'GET',
      url: `/pet/findByTags`,
      params,
      ...requestConfig,
      paramsSerializer(params: Pet.FindByTagsGetQueryParams) {
        return qs.stringify(params)
      }
    })
    return res.data
  }

  /**
   * @summary Find pet by ID
   * @description Returns a single pet
   */
  async findByPetId(petId: Pet.FindByPetIdPathParams['petId'], requestConfig?: Partial<AxiosRequestConfig>) {
    const res = await request<Pet.FindByPetIdQueryResponse, AxiosResponse<Pet.FindByPetIdQueryResponse>, unknown>({
      method: 'GET',
      url: `/pet/${petId}`,
      ...requestConfig
    })
    return res.data
  }

  /**
   * @summary Updates a pet in the store with form data
   */
  async petIdPost(petId: Pet.PetIdPostPathParams['petId'], params?: Pet.PetIdPostQueryParams, requestConfig?: Partial<AxiosRequestConfig>) {
    const res = await request<Pet.PetIdPostMutationResponse, AxiosResponse<Pet.PetIdPostMutationResponse>, unknown>({
      method: 'POST',
      url: `/pet/${petId}`,
      params,
      ...requestConfig
    })
    return res.data
  }

  /**
   * @summary Deletes a pet
   * @description delete a pet
   */
  async delByPetId(petId: Pet.DelByPetIdPathParams['petId'], requestConfig?: Partial<AxiosRequestConfig>) {
    const res = await request<Pet.DelByPetIdMutationResponse, AxiosResponse<Pet.DelByPetIdMutationResponse>, unknown>({
      method: 'DELETE',
      url: `/pet/${petId}`,
      ...requestConfig
    })
    return res.data
  }

  /**
   * @summary uploads an image
   */
  async uploadImagePost(petId: Pet.UploadImagePostPathParams['petId'], data: Pet.UploadImagePostMutationRequest, params?: Pet.UploadImagePostQueryParams, requestConfig?: Partial<AxiosRequestConfig<Pet.UploadImagePostMutationRequest>>) {
    const res = await request<Pet.UploadImagePostMutationResponse, AxiosResponse<Pet.UploadImagePostMutationResponse>, Pet.UploadImagePostMutationRequest>({
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      url: `/pet/${petId}/uploadImage`,
      params,
      data,
      ...requestConfig
    })
    return res.data
  }
}

export const petService = new PetService;

```

</details>


<details> 
<summary>ts type</summary>

```ts
import type { Pet, ApiResponse } from "./typeModels";

/**
 * @tag pet
 * @description Everything about your Pets
 * @UUID type-pet
 */
export namespace Pet {
  export type UpdateMutationRequest = Pet;
  /**
   * @description Successful operation
   */
  export type UpdateMutationResponse = Pet;
  export type UpdateError = unknown;
  export type CreateMutationRequest = Pet;
  /**
   * @description Successful operation
   */
  export type CreateMutationResponse = Pet;
  export type CreateError = unknown;

  /**
   * @description queryParams
   */
  export interface FindByStatusGetQueryParams {
    /**
     * @description Status values that need to be considered for filter
     */
    pageNum?: unknown;
    /**
     * @description Status values that need to be considered for filter
     */
    pageSize?: unknown;
    /**
     * @description Status values that need to be considered for filter
     */
    status?: string;
  }

  /**
   * @description successful operation
   */
  export type FindByStatusGetQueryResponse = Pet[];
  export type FindByStatusGetError = unknown;

  /**
   * @description queryParams
   */
  export interface FindByTagsGetQueryParams {
    /**
     * @description Tags to filter by
     */
    tags?: Array<string>;
  }

  /**
   * @description successful operation
   */
  export type FindByTagsGetQueryResponse = Pet[];
  export type FindByTagsGetError = unknown;

  /**
   * @description pathParams
   */
  export interface FindByPetIdPathParams {
    /**
     * @description ID of pet to return
     */
    petId: number;
  }

  /**
   * @description successful operation
   */
  export type FindByPetIdQueryResponse = Pet;
  export type FindByPetIdError = unknown;

  /**
   * @description queryParams
   */
  export interface PetIdPostQueryParams {
    /**
     * @description Name of pet that needs to be updated
     */
    name?: string;
    /**
     * @description Status of pet that needs to be updated
     */
    status?: string;
  }

  /**
   * @description pathParams
   */
  export interface PetIdPostPathParams {
    /**
     * @description ID of pet that needs to be updated
     */
    petId: number;
  }

  export type PetIdPostError = unknown;
  export type PetIdPostMutationResponse = unknown;

  /**
   * @description pathParams
   */
  export interface DelByPetIdPathParams {
    /**
     * @description Pet id to delete
     */
    petId: number;
  }

  export type DelByPetIdError = unknown;
  export type DelByPetIdMutationResponse = unknown;

  /**
   * @description queryParams
   */
  export interface UploadImagePostQueryParams {
    /**
     * @description Additional Metadata
     */
    additionalMetadata?: string;
  }

  /**
   * @description pathParams
   */
  export interface UploadImagePostPathParams {
    /**
     * @description ID of pet to update
     */
    petId: number;
  }

  export interface UploadImagePostMutationRequest {
  }

  /**
   * @description successful operation
   */
  export type UploadImagePostMutationResponse = ApiResponse;
  export type UploadImagePostError = unknown;
}

```
</details>

<details> 
<summary>zod</summary>

```ts
import { z } from "zod";
import { pet, apiResponse } from "./zodModels";
const updateMutationRequest = z.lazy(() => pet);
/**
 * @description Successful operation
 */
const updateMutationResponse = z.lazy(() => pet);
const updateError = z.unknown();
const createMutationRequest = z.lazy(() => pet);
/**
 * @description Successful operation
 */
const createMutationResponse = z.lazy(() => pet);
const createError = z.unknown();
/**
 * @description queryParams
 */
const findByStatusGetQueryParams = z.object({
  /**
   *@description:Status values that need to be considered for filter
   */
  pageNum: z.unknown().optional(),
  /**
   *@description:Status values that need to be considered for filter
   */
  pageSize: z.unknown().optional(),
  /**
   *@description:Status values that need to be considered for filter
   */
  status: z.string().optional()
});
/** successful operation */
const findByStatusGetQueryResponse = z.lazy(() => pet.array());
const findByStatusGetError = z.unknown();
/**
 * @description queryParams
 */
const findByTagsGetQueryParams = z.object({
  /**
   *@description:Tags to filter by
   */
  tags: z.string().array().optional()
});
/** successful operation */
const findByTagsGetQueryResponse = z.lazy(() => pet.array());
const findByTagsGetError = z.unknown();
/**
 * @description pathParams
 */
export const findByPetIdPathParams = z.object({
  /**
   *@description:ID of pet to return
   */
  petId: z.number()
});
/**
 * @description successful operation
 */
const findByPetIdQueryResponse = z.lazy(() => pet);
const findByPetIdError = z.unknown();
/**
 * @description queryParams
 */
const petIdPostQueryParams = z.object({
  /**
   *@description:Name of pet that needs to be updated
   */
  name: z.string().optional(),
  /**
   *@description:Status of pet that needs to be updated
   */
  status: z.string().optional()
});
/**
 * @description pathParams
 */
export const petIdPostPathParams = z.object({
  /**
   *@description:ID of pet that needs to be updated
   */
  petId: z.number()
});
const petIdPostError = z.unknown();
const petIdPostMutationResponse = z.unknown();
/**
 * @description pathParams
 */
export const delByPetIdPathParams = z.object({
  /**
   *@description:Pet id to delete
   */
  petId: z.number()
});
const delByPetIdError = z.unknown();
const delByPetIdMutationResponse = z.unknown();
/**
 * @description queryParams
 */
const uploadImagePostQueryParams = z.object({
  /**
   *@description:Additional Metadata
   */
  additionalMetadata: z.string().optional()
});
/**
 * @description pathParams
 */
export const uploadImagePostPathParams = z.object({
  /**
   *@description:ID of pet to update
   */
  petId: z.number()
});
const uploadImagePostMutationRequest;
/**
 * @description successful operation
 */
const uploadImagePostMutationResponse = z.lazy(() => apiResponse);
const uploadImagePostError = z.unknown();
/**
 * @tag pet
 * @description Everything about your Pets
 * @UUID zod-pet
 */
export const petZod = {
  updateMutationRequest,
  /**
   *@description:Successful operation
   */
  updateMutationResponse,
  updateError,
  createMutationRequest,
  /**
   *@description:Successful operation
   */
  createMutationResponse,
  createError,
  /**
   *@description:queryParams
   */
  findByStatusGetQueryParams,
  /**successful operation*/
  findByStatusGetQueryResponse,
  findByStatusGetError,
  /**
   *@description:queryParams
   */
  findByTagsGetQueryParams,
  /**successful operation*/
  findByTagsGetQueryResponse,
  findByTagsGetError,
  /**
   *@description:pathParams
   */
  findByPetIdPathParams,
  /**
   *@description:successful operation
   */
  findByPetIdQueryResponse,
  findByPetIdError,
  /**
   *@description:queryParams
   */
  petIdPostQueryParams,
  /**
   *@description:pathParams
   */
  petIdPostPathParams,
  petIdPostError,
  petIdPostMutationResponse,
  /**
   *@description:pathParams
   */
  delByPetIdPathParams,
  delByPetIdError,
  delByPetIdMutationResponse,
  /**
   *@description:queryParams
   */
  uploadImagePostQueryParams,
  /**
   *@description:pathParams
   */
  uploadImagePostPathParams,
  uploadImagePostMutationRequest,
  /**
   *@description:successful operation
   */
  uploadImagePostMutationResponse,
  uploadImagePostError
};

/**
 * @tag pet
 * @description Everything about your Pets
 * @UUID zod-pet
 */
export namespace Pet {
  export type UpdateMutationRequest = z.infer<typeof updateMutationRequest>;
  /**
   * @description Successful operation
   */
  export type UpdateMutationResponse = z.infer<typeof updateMutationResponse>;
  export type UpdateError = z.infer<typeof updateError>;
  export type CreateMutationRequest = z.infer<typeof createMutationRequest>;
  /**
   * @description Successful operation
   */
  export type CreateMutationResponse = z.infer<typeof createMutationResponse>;
  export type CreateError = z.infer<typeof createError>;
  /**
   * @description queryParams
   */
  export type FindByStatusGetQueryParams = z.infer<typeof findByStatusGetQueryParams>;
  /** successful operation */
  export type FindByStatusGetQueryResponse = z.infer<typeof findByStatusGetQueryResponse>;
  export type FindByStatusGetError = z.infer<typeof findByStatusGetError>;
  /**
   * @description queryParams
   */
  export type FindByTagsGetQueryParams = z.infer<typeof findByTagsGetQueryParams>;
  /** successful operation */
  export type FindByTagsGetQueryResponse = z.infer<typeof findByTagsGetQueryResponse>;
  export type FindByTagsGetError = z.infer<typeof findByTagsGetError>;
  /**
   * @description pathParams
   */
  export type FindByPetIdPathParams = z.infer<typeof findByPetIdPathParams>;
  /**
   * @description successful operation
   */
  export type FindByPetIdQueryResponse = z.infer<typeof findByPetIdQueryResponse>;
  export type FindByPetIdError = z.infer<typeof findByPetIdError>;
  /**
   * @description queryParams
   */
  export type PetIdPostQueryParams = z.infer<typeof petIdPostQueryParams>;
  /**
   * @description pathParams
   */
  export type PetIdPostPathParams = z.infer<typeof petIdPostPathParams>;
  export type PetIdPostError = z.infer<typeof petIdPostError>;
  export type PetIdPostMutationResponse = z.infer<typeof petIdPostMutationResponse>;
  /**
   * @description pathParams
   */
  export type DelByPetIdPathParams = z.infer<typeof delByPetIdPathParams>;
  export type DelByPetIdError = z.infer<typeof delByPetIdError>;
  export type DelByPetIdMutationResponse = z.infer<typeof delByPetIdMutationResponse>;
  /**
   * @description queryParams
   */
  export type UploadImagePostQueryParams = z.infer<typeof uploadImagePostQueryParams>;
  /**
   * @description pathParams
   */
  export type UploadImagePostPathParams = z.infer<typeof uploadImagePostPathParams>;
  export type UploadImagePostMutationRequest = z.infer<typeof uploadImagePostMutationRequest>;
  /**
   * @description successful operation
   */
  export type UploadImagePostMutationResponse = z.infer<typeof uploadImagePostMutationResponse>;
  export type UploadImagePostError = z.infer<typeof uploadImagePostError>;
}

```


</details>


<details> 
<summary>MSW</summary>

```ts
import { HttpResponse, http, HttpHandler } from "msw";
import { petFaker } from "./petFaker";
/** */
const handlers = [{
    name: 'testPost',
    start: false,
    msw: http.post('/pet/test', (req) => {
        return HttpResponse.json(petFaker.testPost())
    })
}, {
    name: 'testPut',
    start: false,
    msw: http.put('/pet/test', (req) => {
        return HttpResponse.json(petFaker.testPut())
    })
}, {
    name: 'delByTest',
    start: false,
    msw: http.delete('/pet/test', (req) => {
        return HttpResponse.json(petFaker.delByTest())
    })
}, {
    name: 'testIdGet',
    start: false,
    msw: http.get('/pet/test/:testId', (req) => {
        return HttpResponse.json(petFaker.testIdGet())
    })
}, {
    name: 'uploadImagePost',
    start: false,
    msw: http.post('/pet/:petId/uploadImage', (req) => {
        return HttpResponse.json(petFaker.uploadImagePost())
    })
}, {
    name: 'create',
    start: false,
    msw: http.post('/pet', (req) => {
        return HttpResponse.json(petFaker.create())
    })
}, {
    name: 'update',
    start: false,
    msw: http.put('/pet', (req) => {
        return HttpResponse.json(petFaker.update())
    })
}, {
    name: 'findByStatusGet',
    start: false,
    msw: http.get('/pet/findByStatus', (req) => {
        return HttpResponse.json(petFaker.findByStatusGet())
    })
}, {
    name: 'findByTagsGet',
    start: false,
    msw: http.get('/pet/findByTags', (req) => {
        return HttpResponse.json(petFaker.findByTagsGet())
    })
}, {
    name: 'findByPetId',
    start: false,
    msw: http.get('/pet/:petId', (req) => {
        return HttpResponse.json(petFaker.findByPetId())
    })
}, {
    name: 'petIdPost',
    start: false,
    msw: http.post('/pet/:petId', (req) => {
        return HttpResponse.json(petFaker.petIdPost())
    })
}, {
    name: 'delByPetId',
    start: false,
    msw: http.delete('/pet/:petId', (req) => {
        return HttpResponse.json(petFaker.delByPetId())
    })
}];
export const petHandler: Array<HttpHandler> = handlers
    .filter(x => x.start)
    .map(x => x.msw);

```
</details>


<details> 
<summary>faker</summary>

```ts
import { faker } from "@faker-js/faker";
import { testDto2, test32145, apiResponse, pet } from "./fakerModels";
import type { Pet } from "./Pet";

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID Faker-pet
 */
class PetFaker {
    /**
     *
     * @summary summary
     * @description
     * @UUID operationId
     */
    testPost(): NonNullable<Pet.TestPostResponse> {
        return testDto2()
    }

    /**
     *
     * @summary summary
     * @description
     * @UUID operationId
     */
    testPut(): NonNullable<Pet.TestPutResponse> {
        return testDto2()
    }

    /**
     *
     * @summary summary
     * @description
     * @UUID operationId
     */
    delByTest(): NonNullable<Pet.DelByTestResponse> {
        return test32145()
    }

    /**
     *
     * @summary summary
     * @description
     * @UUID operationId
     */
    testIdGet(): NonNullable<Pet.TestIdGetResponse> {
        return testDto2()
    }

    /**
     *
     * @summary uploads an image
     * @description pet
     * @UUID uploadFile
     */
    uploadImagePost(): NonNullable<Pet.UploadImagePostResponse> {
        return apiResponse()
    }

    /**
     *
     * @summary Add a new pet to the store
     * @description
     * @UUID addPet
     */
    create(): NonNullable<Pet.CreateResponse> {
        return {}
    }

    /**
     *
     * @summary Update an existing pet
     * @description
     * @UUID updatePet
     */
    update(): NonNullable<Pet.UpdateResponse> {
        return {}
    }

    /**
     *
     * @summary Finds Pets by status
     * @description Multiple status values can be provided with comma separated strings
     * @UUID findPetsByStatus
     */
    findByStatusGet(): NonNullable<Pet.FindByStatusGetResponse> {
        return faker.helpers.multiple(() => pet(), {
            count: 10,
        })
    }

    /**
     *
     * @summary Finds Pets by tags
     * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
     * @UUID findPetsByTags
     */
    findByTagsGet(): NonNullable<Pet.FindByTagsGetResponse> {
        return faker.helpers.multiple(() => pet(), {
            count: 10,
        })
    }

    /**
     *
     * @summary Find pet by ID
     * @description Returns a single pet
     * @UUID getPetById
     */
    findByPetId(): NonNullable<Pet.FindByPetIdResponse> {
        return pet()
    }

    /**
     *
     * @summary Updates a pet in the store with form data
     * @description
     * @UUID updatePetWithForm
     */
    petIdPost(): NonNullable<Pet.PetIdPostResponse> {
        return {}
    }

    /**
     *
     * @summary Deletes a pet
     * @description
     * @UUID deletePet
     */
    delByPetId(): NonNullable<Pet.DelByPetIdResponse> {
        return {}
    }
}

export const petFaker = new PetFaker;

```
</details>

## nestjs
**ApiTag**

Since the ApiTags in @/common/swagger don't support the description attribute, we create an ApiTag method that supports it
```ts
// users.controller.ts
@ApiTag({
  name: 'users',
  description: 'Get all users',
})
@Controller('users')
export class UsersController {}


// ApiTag.decorator.ts
import { swaggerConfig } from '@/common/swagger';
import { TagObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ApiTags } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export const ApiTag = (tagObject: TagObject) => {
  swaggerConfig.tags.unshift(tagObject);
  return applyDecorators(ApiTags(tagObject.name));
};

//  common/swagger.ts
import { DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('title')
  .setDescription('api docs')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

export { swaggerConfig };

//main.ts
  const options: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  };
  const document = SwaggerModule.createDocument(app, swaggerConfig, options);
  SwaggerModule.setup('docs', app, document);
```

**tree**
```
.
├── pet
│   ├── domain
│   │   ├── ApiResponse.vo.ts
│   │   ├── Pet.dto.ts
│   │   ├── Pet.vo.ts
│   │   ├── findPetsByStatus-query.dto.ts
│   │   └── findPetsByTags-query.dto.ts
│   ├── pet.controller.ts
│   ├── pet.service.ts
│   └── repository
│       ├── pet-repository.module.ts
│       ├── pet.mapper.ts
│       └── pet.repository.ts
├── store
│   ├── domain
│   │   ├── Order.dto.ts
│   │   └── Order.vo.ts
│   ├── repository
│   │   ├── store-repository.module.ts
│   │   ├── store.mapper.ts
│   │   └── store.repository.ts
│   ├── store.controller.ts
│   └── store.service.ts
└── user
    ├── domain
    │   ├── User.dto.ts
    │   ├── User.vo.ts
    │   └── loginUser-query.dto.ts
    ├── repository
    │   ├── user-repository.module.ts
    │   ├── user.mapper.ts
    │   └── user.repository.ts
    ├── user.controller.ts
    └── user.service.ts

```

<details> 
<summary>controller</summary>

```ts
import {
  Controller,
  HttpStatus,
  HttpCode,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
  Delete,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { Permissions } from "@/common/decorators/auth.decorator";
import { ApiTag } from "@/common/swagger";
import { PetService } from "./pet.service";
import { Pet } from "./domain/Pet.vo";
import { ApiResponse } from "./domain/ApiResponse.vo";
import { FindPetsByStatusQueryDto } from "./domain/findPetsByStatus-query.dto";
import { FindPetsByTagsQueryDto } from "./domain/findPetsByTags-query.dto";
@ApiTag({
  name: "pet",
  description: "Everything about your Pets",
})
@Controller("pet")
export class PetController {
  constructor(private readonly petService: PetService) {}

  @ApiOperation({
    summary: "Find pet by ID",
    description: "Returns a single pet",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "successful operation",
    Pet,
  })
  @ApiParam({
    name: "petId",
    description: "ID of pet to return",
  })
  @Get("/:petId")
  @HttpCode(HttpStatus.OK)
  async getPetById(@Param("petId", ParseIntPipe) petId: number): Promise<Pet> {
    return await this.petService.getPetById(petId);
  }

  @ApiOperation({ summary: "Updates a pet in the store with form data" })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiParam({
    name: "petId",
    description: "ID of pet that needs to be updated",
  })
  @Post("/:petId")
  @HttpCode(HttpStatus.OK)
  async updatePetWithForm(
    @Param("petId", ParseIntPipe) petId: number,
    @Body() data: any,
  ): Promise<void> {
    return await this.petService.updatePetWithForm(petId, data);
  }

  @ApiOperation({ summary: "Deletes a pet" })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiParam({
    name: "petId",
    description: "Pet id to delete",
  })
  @Delete("/:petId")
  @HttpCode(HttpStatus.OK)
  async deletePet(@Param("petId", ParseIntPipe) petId: number): Promise<void> {
    return await this.petService.deletePet(petId);
  }

  @ApiOperation({ summary: "uploads an image" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "successful operation",
    ApiResponse,
  })
  @ApiParam({
    name: "petId",
    description: "ID of pet to update",
  })
  @Post("/:petId/uploadImage")
  @HttpCode(HttpStatus.OK)
  async uploadFile(
    @Param("petId", ParseIntPipe) petId: number,
    @Body() data: any,
  ): Promise<ApiResponse> {
    return await this.petService.uploadFile(petId, data);
  }

  @ApiOperation({ summary: "Add a new pet to the store" })
  @ApiResponse({ status: HttpStatus.OK })
  @Post()
  @HttpCode(HttpStatus.OK)
  async addPet(@Body() data: Pet): Promise<void> {
    return await this.petService.addPet(data);
  }

  @ApiOperation({ summary: "Update an existing pet" })
  @ApiResponse({ status: HttpStatus.OK })
  @Put()
  @HttpCode(HttpStatus.OK)
  async updatePet(@Body() data: Pet): Promise<void> {
    return await this.petService.updatePet(data);
  }

  @ApiOperation({
    summary: "Finds Pets by status",
    description:
      "Multiple status values can be provided with comma separated strings",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "successful operation",
    isArray: true,
  })
  @Get("/findByStatus")
  @HttpCode(HttpStatus.OK)
  async findPetsByStatus(
    @Query() query: FindPetsByStatusQueryDto,
  ): Promise<Pet[]> {
    return await this.petService.findPetsByStatus(query);
  }

  @ApiOperation({
    summary: "Finds Pets by tags",
    description:
      "Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "successful operation",
    isArray: true,
  })
  @Get("/findByTags")
  @HttpCode(HttpStatus.OK)
  async findPetsByTags(@Query() query: FindPetsByTagsQueryDto): Promise<Pet[]> {
    return await this.petService.findPetsByTags(query);
  }
}

```
</details>

<details> 
<summary>service</summary>

```ts
 import { Injectable } from "@nestjs/common";
import { PetRepository } from "./repository/pet.repository";
import { Pet } from "./domain/Pet.vo";
import { ApiResponse } from "./domain/ApiResponse.vo";
import { FindPetsByStatusQueryDto } from "./domain/findPetsByStatus-query.dto";
import { FindPetsByTagsQueryDto } from "./domain/findPetsByTags-query.dto";

@Injectable
export class PetService {
    constructor(private readonly petRepository: PetRepository) {
    }

    async getPetById(petId: number): Promise<Pet> {
        return await this.petRepository.getPetById(petId)
    }

    async updatePetWithForm(petId: number, data: any): Promise<void> {
        return await this.petRepository.updatePetWithForm(petId, data)
    }

    async deletePet(petId: number): Promise<void> {
        return await this.petRepository.deletePet(petId)
    }

    async uploadFile(petId: number, data: any): Promise<ApiResponse> {
        return await this.petRepository.uploadFile(petId, data)
    }

    async addPet(data: Pet): Promise<void> {
        return await this.petRepository.addPet(data)
    }

    async updatePet(data: Pet): Promise<void> {
        return await this.petRepository.updatePet(data)
    }

    async findPetsByStatus(query: FindPetsByStatusQueryDto): Promise<Pet[]> {
        return await this.petRepository.findPetsByStatus(query)
    }

    async findPetsByTags(query: FindPetsByTagsQueryDto): Promise<Pet[]> {
        return await this.petRepository.findPetsByTags(query)
    }
} 
```

  </details>



<details> 
<summary>repository</summary>

 ```ts
  import { Injectable } from "@nestjs/common";
import { PetRepository } from "./repository/pet.repository";
import { Pet } from "./domain/Pet.vo";
import { ApiResponse } from "./domain/ApiResponse.vo";
import { FindPetsByStatusQueryDto } from "./domain/findPetsByStatus-query.dto";
import { FindPetsByTagsQueryDto } from "./domain/findPetsByTags-query.dto";

@Injectable
export class PetService {
    constructor(private readonly petRepository: PetRepository) {
    }

    async getPetById(petId: number): Promise<Pet> {
        return await this.petRepository.getPetById(petId)
    }

    async updatePetWithForm(petId: number, data: any): Promise<void> {
        return await this.petRepository.updatePetWithForm(petId, data)
    }

    async deletePet(petId: number): Promise<void> {
        return await this.petRepository.deletePet(petId)
    }

    async uploadFile(petId: number, data: any): Promise<ApiResponse> {
        return await this.petRepository.uploadFile(petId, data)
    }

    async addPet(data: Pet): Promise<void> {
        return await this.petRepository.addPet(data)
    }

    async updatePet(data: Pet): Promise<void> {
        return await this.petRepository.updatePet(data)
    }

    async findPetsByStatus(query: FindPetsByStatusQueryDto): Promise<Pet[]> {
        return await this.petRepository.findPetsByStatus(query)
    }

    async findPetsByTags(query: FindPetsByTagsQueryDto): Promise<Pet[]> {
        return await this.petRepository.findPetsByTags(query)
    }
}
 ```

</details>

<details> 
<summary>domain</summary>

```ts
 import { Type, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Category } from "Category";
import { Tag } from "Tag";


/**
 *
 * @description Pet object that needs to be added to the store
 */
export class Pet {

    @IsNumber()
    @IsOptional()
    @ApiProperty({
        format: 'int64',
        required: false,
        name: 'id'
    })
    id?: number;

    @IsOptional()
    @ApiProperty({
        $ref: '#/components/schemas/Category',
        required: false,
        name: 'category'
    })
    category?: Category;

    @IsString()
    @ApiProperty({
        example: 'doggie',
        required: true,
        name: 'name'
    })
    name: string;

    @Type(() => String)
    @IsString({ "each": true })
    @ApiProperty({
        xml: {
            wrapped: true
        },
        isArray: true,
        required: true,
        name: 'photoUrls'
    })
    photoUrls: string[];

    @Type(() => Tag)
    @IsOptional()
    @ApiProperty({
        xml: {
            wrapped: true
        },
        isArray: true,
        required: false,
        name: 'tags'
    })
    tags?: Tag;

    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'pet status in the store',
        enum: [
            'available',
            'pending',
            'sold'
        ],
        required: false,
        name: 'status'
    })
    status?: string;
}
```
</details>



## SWR


| Name        | Description                                                  | Type  | Default |
| ----------- | ------------------------------------------------------------ | ----- | ------- |
| infiniteKey | each option in the query parmas generates an infinite queryKey | Array |         |

**example**

add config

```TS
createSWR({
		infiniteKey: ["pageNum", "pageSize"]
})
```

generate queryKey

```ts
const findByStatusGetQueryKey = (params: Pet.FindByStatusGetQueryParams, shouldFetch: boolean) =>
    (pageIndex: number, previousPageData: Pet.FindByStatusGetQueryResponse) => {
        if (!shouldFetch) {
            return null
        }
        if (previousPageData && !previousPageData.length) return null

        return {
            ...params
        } as const
};
```


<details> 
  <summary>SWR</summary>

```TS
  import { petAPI } from "./petAPI";
import type { Pet } from "./Pet";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import type { SWRMutationConfiguration } from "swr/mutation";

const findByPetIdQueryKey = (petId: Pet.FindByPetIdPathParams['petId']) => [{ url: `/pet/${petId}`, method: 'get' }] as const;

const petIdPostMutationKey = (petId: Pet.PetIdPostPathParams['petId']) => [{ url: `/pet/${petId}`, method: 'post' }] as const;

const delByPetIdMutationKey = (petId: Pet.DelByPetIdPathParams['petId']) => [{ url: `/pet/${petId}`, method: 'delete' }] as const;

const uploadImagePostMutationKey = (petId: Pet.UploadImagePostPathParams['petId']) => [{ url: `/pet/${petId}/uploadImage`, method: 'post' }] as const;

const createMutationKey = () => [{ url: `/pet`, method: 'post' }] as const;

const updateMutationKey = () => [{ url: `/pet`, method: 'put' }] as const;

const findByStatusGetQueryKey = (params: Pet.FindByStatusGetQueryParams) => [{ url: `/pet/findByStatus`, method: 'get' }, ...(params ? [params] : [])] as const;

const findByTagsGetQueryKey = (params: Pet.FindByTagsGetQueryParams) => [{ url: `/pet/findByTags`, method: 'get' }, ...(params ? [params] : [])] as const;
type FindByPetIdQueryKey = ReturnType<typeof findByPetIdQueryKey>;
type PetIdPostMutationKey = ReturnType<typeof petIdPostMutationKey>;
type DelByPetIdMutationKey = ReturnType<typeof delByPetIdMutationKey>;
type UploadImagePostMutationKey = ReturnType<typeof uploadImagePostMutationKey>;
type CreateMutationKey = ReturnType<typeof createMutationKey>;
type UpdateMutationKey = ReturnType<typeof updateMutationKey>;
type FindByStatusGetQueryKey = ReturnType<typeof findByStatusGetQueryKey>;
type FindByTagsGetQueryKey = ReturnType<typeof findByTagsGetQueryKey>;

/**
 * @summary Find pet by ID
 * @description Returns a single pet
 */
function useFindByPetId(petId: Pet.FindByPetIdPathParams['petId'], options?: {
    swr?: Parameters<typeof useSWR<Pet.FindByPetIdQueryResponse, FindByPetIdQueryKey | null, any>>[2]
    shouldFetch?: boolean
}) {

    const { swr: queryOptions, shouldFetch = true } = options ?? {}
    const queryKey = findByPetIdQueryKey(petId)

    return useSWR<Pet.FindByPetIdQueryResponse, Pet.FindByPetIdError, FindByPetIdQueryKey | null>(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async () => {
            return petAPI.findByPetId(petId);
        }
    })
}

/** @summary Updates a pet in the store with form data */
function usePetIdPost(petId: Pet.PetIdPostPathParams['petId'], options?: {
    swr?: SWRMutationConfiguration<Pet.PetIdPostMutationResponse, Pet.PetIdPostError, PetIdPostMutationKey | null, Pet.PetIdPostMutationRequest>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = petIdPostMutationKey(petId)

    return useSWRMutation<Pet.PetIdPostMutationResponse, Pet.PetIdPostError, PetIdPostMutationKey | null, Pet.PetIdPostMutationRequest>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petAPI.petIdPost(petId, data);
    }, mutationOptions);
}

/** @summary Deletes a pet */
function useDelByPetId(petId: Pet.DelByPetIdPathParams['petId'], options?: {
    swr?: SWRMutationConfiguration<Pet.DelByPetIdMutationResponse, Pet.DelByPetIdError, DelByPetIdMutationKey | null, never>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = delByPetIdMutationKey(petId)

    return useSWRMutation<Pet.DelByPetIdMutationResponse, Pet.DelByPetIdError, DelByPetIdMutationKey | null, never>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petAPI.delByPetId(petId);
    }, mutationOptions);
}

/** @summary uploads an image */
function useUploadImagePost(petId: Pet.UploadImagePostPathParams['petId'], options?: {
    swr?: SWRMutationConfiguration<Pet.UploadImagePostMutationResponse, Pet.UploadImagePostError, UploadImagePostMutationKey | null, Pet.UploadImagePostMutationRequest>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = uploadImagePostMutationKey(petId)

    return useSWRMutation<Pet.UploadImagePostMutationResponse, Pet.UploadImagePostError, UploadImagePostMutationKey | null, Pet.UploadImagePostMutationRequest>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petAPI.uploadImagePost(petId, data);
    }, mutationOptions);
}

/** @summary Add a new pet to the store */
function useCreate(options?: {
    swr?: SWRMutationConfiguration<Pet.CreateMutationResponse, Pet.CreateError, CreateMutationKey | null, Pet.CreateMutationRequest>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = createMutationKey()

    return useSWRMutation<Pet.CreateMutationResponse, Pet.CreateError, CreateMutationKey | null, Pet.CreateMutationRequest>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petAPI.create(data);
    }, mutationOptions);
}

/** @summary Update an existing pet */
function useUpdate(options?: {
    swr?: SWRMutationConfiguration<Pet.UpdateMutationResponse, Pet.UpdateError, UpdateMutationKey | null, Pet.UpdateMutationRequest>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = updateMutationKey()

    return useSWRMutation<Pet.UpdateMutationResponse, Pet.UpdateError, UpdateMutationKey | null, Pet.UpdateMutationRequest>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petAPI.update(data);
    }, mutationOptions);
}

/**
 * @summary Finds Pets by status
 * @description Multiple status values can be provided with comma separated strings
 */
function useFindByStatusGet(params: Pet.FindByStatusGetQueryParams, options?: {
    swr?: Parameters<typeof useSWR<Pet.FindByStatusGetQueryResponse, FindByStatusGetQueryKey | null, any>>[2]
    shouldFetch?: boolean
}) {

    const { swr: queryOptions, shouldFetch = true } = options ?? {}
    const queryKey = findByStatusGetQueryKey(params)

    return useSWR<Pet.FindByStatusGetQueryResponse, Pet.FindByStatusGetError, FindByStatusGetQueryKey | null>(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async () => {
            return petAPI.findByStatusGet(params);
        }
    })
}

/**
 * @summary Finds Pets by tags
 * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
 */
function useFindByTagsGet(params: Pet.FindByTagsGetQueryParams, options?: {
    swr?: Parameters<typeof useSWR<Pet.FindByTagsGetQueryResponse, FindByTagsGetQueryKey | null, any>>[2]
    shouldFetch?: boolean
}) {

    const { swr: queryOptions, shouldFetch = true } = options ?? {}
    const queryKey = findByTagsGetQueryKey(params)

    return useSWR<Pet.FindByTagsGetQueryResponse, Pet.FindByTagsGetError, FindByTagsGetQueryKey | null>(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async () => {
            return petAPI.findByTagsGet(params);
        }
    })
}

export const petSWR = {
    findByPetIdQueryKey, petIdPostMutationKey, delByPetIdMutationKey, uploadImagePostMutationKey, createMutationKey, updateMutationKey, findByStatusGetQueryKey, findByTagsGetQueryKey, useFindByPetId, usePetIdPost, useDelByPetId, useUploadImagePost, useCreate, useUpdate, useFindByStatusGet, useFindByTagsGet
};

export namespace PetSWR {
    export type FindByPetIdQueryKey = ReturnType<typeof findByPetIdQueryKey>;
    export type PetIdPostMutationKey = ReturnType<typeof petIdPostMutationKey>;
    export type DelByPetIdMutationKey = ReturnType<typeof delByPetIdMutationKey>;
    export type UploadImagePostMutationKey = ReturnType<typeof uploadImagePostMutationKey>;
    export type CreateMutationKey = ReturnType<typeof createMutationKey>;
    export type UpdateMutationKey = ReturnType<typeof updateMutationKey>;
    export type FindByStatusGetQueryKey = ReturnType<typeof findByStatusGetQueryKey>;
    export type FindByTagsGetQueryKey = ReturnType<typeof findByTagsGetQueryKey>;
}
```
</details>
