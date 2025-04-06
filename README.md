[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

# At Glance
openapi-to is a library and toolkit that transforms your Swagger/OpenAPI specification into various client libraries, including:
+ [x] ts request
+ [x] ts type
+ [x] zod
+ [x] Faker.js
+ [x] MSW
+ [x] nestjs
+ [x] SWR
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
import { createFaker, 
        createMSW,
        createNestjs,
        createSWR,
        createTSRequest,
        createTSType,
        createVueQuery,
        createZod,
        defineConfig } from 'openapi-to'

export default defineConfig({
  servers: [
    {
      input: {
        path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
      },
      output:{
       dir:'server' //.OpenAPI/server
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
    createVueQuery(),
    createSWR()
  ]
});
```

# plugins
## createTSRequest


| Name                                          | Description                | Type    | Default |
| --------------------------------------------- |----------------------------| ------- |---------|
| createZodDecorator                            | create zod decorator       | boolean | false   |
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
async create(data: Pet.CreateMutationRequest, requestConfig?: Partial<AxiosRequestConfig<Pet.CreateMutationRequest>>) {
  const res = await request<Pet.CreateMutationResponse, AxiosResponse<Pet.CreateMutationResponse>, Pet.CreateMutationRequest>({
    method: 'POST',
    url: `/pet`,
    data,
    ...requestConfig
  })
  return res.data
}
//...
```

common

```ts
//...
    async create(data: Pet.CreateMutationRequest, requestConfig?: Partial<AxiosRequestConfig<Pet.CreateMutationRequest>>) {
        const res = await request<Pet.CreateMutationResponse>({
            method: 'POST',
            url: `/pet`,
            data,
            ...requestConfig
        })
        return res.data
    }
//...
```




## Zod 
Adding zod is mainly used for end-to-end verification. ZodDecorator will add three methods to the request method. You need to implement the specific logic yourself. An example is given for your reference.

- parametersSchema

  Collect request parameters zodSchema

```ts
@parametersSchema(petSchemas.createMutationRequest)
```
- responseSchema 

  Collect response parameters schema

```ts
@responseSchema(petSchemas.createMutationResponse)
```
- zodValidate 

  Use  zodSchema for verification


example 

```ts

import _ from 'lodash'
export function validateSchema(target: object, propertyKey: string, descriptor) {
  const fn = descriptor.value
  descriptor.value = async (...args) => {
    args.forEach((item, index) => {
      const zodSchema = _.get(target, `_schema.${propertyKey}.${index}`)
      if (!zodSchema) {
        return ''
      }
      const safeParse = zodSchema.safeParse(item)
      !safeParse.success && console.error(`[${propertyKey}]request params error`, safeParse.error)
    })
    //
    const result = await fn(...args)
    //response
    const responseZodSchema = _.get(target, `_schema.${propertyKey}.responseZodSchema`)
    const safeParse = responseZodSchema.safeParse(result[1])
    result[1] && !safeParse.success && console.error(`[${propertyKey}]response error`, safeParse.error)

    return result
  }
}

export const responseSchema = (zodSchema) => (target: object, propertyKey: string, descriptor) => {
  _.set(target, `_schema.${propertyKey}.responseZodSchema`, zodSchema)
}

export const parametersSchema = (zodSchema) => (target: object, propertyKey: string, index) => {
  _.set(target, `_schema.${propertyKey}.${index}`, zodSchema)
}

```



<details> 
<summary>ts request</summary>

```ts
import type { Pet } from "./pet.schemas";
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
import type { PetModel, ApiResponseModel } from "./models";
/**
 * @description Status values that need to be considered for filter
 */
export const petFindByStatusGetQueryParamsStatusEnumLabel = {
    Available: '',
    Pending: '',
    Sold: ''
};
/**
 * @description Status values that need to be considered for filter
 */
export const petFindByStatusGetQueryParamsStatusEnum = {
    Available: 'available',
    Pending: 'pending',
    Sold: 'sold'
} as const;
export type PetFindByStatusGetQueryParamsStatusEnum = (typeof petFindByStatusGetQueryParamsStatusEnum)[keyof typeof petFindByStatusGetQueryParamsStatusEnum];
/** Status values that need to be considered for filter */
export const PetFindByStatusGetQueryParamsStatusEnumOption = [{
    label: petFindByStatusGetQueryParamsStatusEnumLabel.Available,
    value: petFindByStatusGetQueryParamsStatusEnum.Available
}, {
    label: petFindByStatusGetQueryParamsStatusEnumLabel.Pending,
    value: petFindByStatusGetQueryParamsStatusEnum.Pending
}, {
    label: petFindByStatusGetQueryParamsStatusEnumLabel.Sold,
    value: petFindByStatusGetQueryParamsStatusEnum.Sold
}];

/**
 * @tag pet
 * @description Everything about your Pets
 */
export namespace Pet {
    export type UpdateMutationRequest = PetModel;
    /**
     * @description Successful operation
     */
    export type UpdateMutationResponse = PetModel;
    export type UpdateError = unknown;
    export type CreateMutationRequest = PetModel;
    /**
     * @description Successful operation
     */
    export type CreateMutationResponse = PetModel;
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
        status?: PetFindByStatusGetQueryParamsStatusEnum;
    }

    /**
     * @description successful operation
     */
    export type FindByStatusGetQueryResponse = PetModel[];
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
    export type FindByTagsGetQueryResponse = PetModel[];
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
    export type FindByPetIdQueryResponse = PetModel;
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

    export type UploadImagePostMutationRequest = Blob;
    /**
     * @description successful operation
     */
    export type UploadImagePostMutationResponse = ApiResponseModel;
    export type UploadImagePostError = unknown;
}
```
</details>

<details> 
<summary>zod</summary>

```ts
import { z } from "zod";
import { petSchema, apiResponseSchema } from "./zod-schemas";
/**
 * @description Status values that need to be considered for filter
 */
export const petFindByStatusGetQueryParamsStatusEnumLabel = {
    Available: '',
    Pending: '',
    Sold: ''
};
/**
 * @description Status values that need to be considered for filter
 */
export const PetFindByStatusGetQueryParamsStatusEnum = {
    Available: 'available',
    Pending: 'pending',
    Sold: 'sold'
} as const;
/** Status values that need to be considered for filter */
export const PetFindByStatusGetQueryParamsStatusEnumOption = [{
    label: petFindByStatusGetQueryParamsStatusEnumLabel.Available,
    value: PetFindByStatusGetQueryParamsStatusEnum.Available
}, {
    label: petFindByStatusGetQueryParamsStatusEnumLabel.Pending,
    value: PetFindByStatusGetQueryParamsStatusEnum.Pending
}, {
    label: petFindByStatusGetQueryParamsStatusEnumLabel.Sold,
    value: PetFindByStatusGetQueryParamsStatusEnum.Sold
}];
const updateMutationRequest = z.lazy(() => petSchema);
/**
 * @description Successful operation
 */
const updateMutationResponse = z.lazy(() => petSchema);
const updateError = z.unknown();
const createMutationRequest = z.lazy(() => petSchema);
/**
 * @description Successful operation
 */
const createMutationResponse = z.lazy(() => petSchema);
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
    status: z.nativeEnum(PetFindByStatusGetQueryParamsStatusEnum).optional()
});
/**
 * @description successful operation
 */
const findByStatusGetQueryResponse = z.lazy(() => petSchema.array());
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
/**
 * @description successful operation
 */
const findByTagsGetQueryResponse = z.lazy(() => petSchema.array());
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
const findByPetIdQueryResponse = z.lazy(() => petSchema);
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
const uploadImagePostMutationRequest = z.instanceof(File);
/**
 * @description successful operation
 */
const uploadImagePostMutationResponse = z.lazy(() => apiResponseSchema);
const uploadImagePostError = z.unknown();
/**
 * @tag pet
 * @description Everything about your Pets
 */
export const petSchemas = {
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
    /**
    *@description:successful operation
    */
    findByStatusGetQueryResponse,
    findByStatusGetError,
    /**
    *@description:queryParams
    */
    findByTagsGetQueryParams,
    /**
    *@description:successful operation
    */
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
    /**
     * @description successful operation
     */
    export type FindByStatusGetQueryResponse = z.infer<typeof findByStatusGetQueryResponse>;
    export type FindByStatusGetError = z.infer<typeof findByStatusGetError>;
    /**
     * @description queryParams
     */
    export type FindByTagsGetQueryParams = z.infer<typeof findByTagsGetQueryParams>;
    /**
     * @description successful operation
     */
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
import { petFakerService } from "./pet-faker.service";
/** */
const handlers = [{
    name: 'update',
    start: false,
    msw: http.put('/pet', (req) => {
        return HttpResponse.json(petFakerService.update())
    })
}, {
    name: 'create',
    start: false,
    msw: http.post('/pet', (req) => {
        return HttpResponse.json(petFakerService.create())
    })
}, {
    name: 'findByStatusGet',
    start: false,
    msw: http.get('/pet/findByStatus', (req) => {
        return HttpResponse.json(petFakerService.findByStatusGet())
    })
}, {
    name: 'findByTagsGet',
    start: false,
    msw: http.get('/pet/findByTags', (req) => {
        return HttpResponse.json(petFakerService.findByTagsGet())
    })
}, {
    name: 'findByPetId',
    start: false,
    msw: http.get('/pet/:petId', (req) => {
        return HttpResponse.json(petFakerService.findByPetId())
    })
}, {
    name: 'petIdPost',
    start: false,
    msw: http.post('/pet/:petId', (req) => {
        return HttpResponse.json(petFakerService.petIdPost())
    })
}, {
    name: 'delByPetId',
    start: false,
    msw: http.delete('/pet/:petId', (req) => {
        return HttpResponse.json(petFakerService.delByPetId())
    })
}, {
    name: 'uploadImagePost',
    start: false,
    msw: http.post('/pet/:petId/uploadImage', (req) => {
        return HttpResponse.json(petFakerService.uploadImagePost())
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
import { petFaker, apiResponseFaker } from "./faker-models";
import type { Pet } from "./pet.schemas";

/**
 * @tag pet
 * @description Everything about your Pets
 */
class PetFakerService {
    /**
     * @summary Update an existing pet
     * @description Update an existing pet by Id
     */
    update(): NonNullable<Pet.UpdateMutationResponse> {
        return petFaker()
    }

    /**
     * @summary Add a new pet to the store
     * @description Add a new pet to the store
     */
    create(): NonNullable<Pet.CreateMutationResponse> {
        return petFaker()
    }

    /**
     * @summary Finds Pets by status
     * @description Multiple status values can be provided with comma separated strings
     */
    findByStatusGet(): NonNullable<Pet.FindByStatusGetQueryResponse> {
        return faker.helpers.multiple(() => petFaker(), {
            count: 10,
        })
    }

    /**
     * @summary Finds Pets by tags
     * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
     */
    findByTagsGet(): NonNullable<Pet.FindByTagsGetQueryResponse> {
        return faker.helpers.multiple(() => petFaker(), {
            count: 10,
        })
    }

    /**
     * @summary Find pet by ID
     * @description Returns a single pet
     */
    findByPetId(): NonNullable<Pet.FindByPetIdQueryResponse> {
        return petFaker()
    }

    /** @summary Updates a pet in the store with form data */
    petIdPost(): NonNullable<Pet.PetIdPostMutationResponse> {
        return {}
    }

    /**
     * @summary Deletes a pet
     * @description delete a pet
     */
    delByPetId(): NonNullable<Pet.DelByPetIdMutationResponse> {
        return {}
    }

    /** @summary uploads an image */
    uploadImagePost(): NonNullable<Pet.UploadImagePostMutationResponse> {
        return apiResponseFaker()
    }
}

export const petFakerService = new PetFakerService;

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
const findByStatusGetQueryKey = (params?: Pet.FindByStatusGetQueryParams, shouldFetch = true) =>
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
import { petService } from "./pet.service";
import type { Pet } from "./pet.schemas";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import type { SWRMutationConfiguration } from "swr/mutation";

const updateMutationKey = () => [{ url: `/pet`, method: 'put' }] as const;

const createMutationKey = () => [{ url: `/pet`, method: 'post' }] as const;

const findByStatusGetQueryKey = (params?: Pet.FindByStatusGetQueryParams, shouldFetch = true) =>
    (pageIndex: number, previousPageData: Pet.FindByStatusGetQueryResponse) => {
        if (!shouldFetch) {
            return null
        }
        if (previousPageData && !previousPageData.length) return null

        return {
            ...params
        } as const
    };

const findByTagsGetQueryKey = (params?: Pet.FindByTagsGetQueryParams) => [{ url: `/pet/findByTags`, method: 'get' }, ...(params ? [params] : [])] as const;

const findByPetIdQueryKey = (petId: Pet.FindByPetIdPathParams['petId']) => [{ url: `/pet/${petId}`, method: 'get' }] as const;

const petIdPostMutationKey = (petId: Pet.PetIdPostPathParams['petId'], params?: Pet.PetIdPostQueryParams) => [{ url: `/pet/${petId}`, method: 'post' }, ...(params ? [params] : [])] as const;

const delByPetIdMutationKey = (petId: Pet.DelByPetIdPathParams['petId']) => [{ url: `/pet/${petId}`, method: 'delete' }] as const;

const uploadImagePostMutationKey = (petId: Pet.UploadImagePostPathParams['petId'], params?: Pet.UploadImagePostQueryParams) => [{ url: `/pet/${petId}/uploadImage`, method: 'post' }, ...(params ? [params] : [])] as const;

export namespace PetKey {
    export type UpdateMutationKey = ReturnType<typeof updateMutationKey>;
    export type CreateMutationKey = ReturnType<typeof createMutationKey>;
    export type FindByStatusGetQueryKey = ReturnType<typeof findByStatusGetQueryKey>;
    export type FindByTagsGetQueryKey = ReturnType<typeof findByTagsGetQueryKey>;
    export type FindByPetIdQueryKey = ReturnType<typeof findByPetIdQueryKey>;
    export type PetIdPostMutationKey = ReturnType<typeof petIdPostMutationKey>;
    export type DelByPetIdMutationKey = ReturnType<typeof delByPetIdMutationKey>;
    export type UploadImagePostMutationKey = ReturnType<typeof uploadImagePostMutationKey>;
}

/**
 * @summary Update an existing pet
 * @description Update an existing pet by Id
 */
function useUpdate(options?: {
    swr?: SWRMutationConfiguration<Pet.UpdateMutationResponse, Pet.UpdateError, PetKey.UpdateMutationKey | null, Pet.UpdateMutationRequest>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = updateMutationKey()

    return useSWRMutation<Pet.UpdateMutationResponse, Pet.UpdateError, PetKey.UpdateMutationKey | null, Pet.UpdateMutationRequest>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petService.update(data);
    }, mutationOptions);
}

/**
 * @summary Add a new pet to the store
 * @description Add a new pet to the store
 */
function useCreate(options?: {
    swr?: SWRMutationConfiguration<Pet.CreateMutationResponse, Pet.CreateError, PetKey.CreateMutationKey | null, Pet.CreateMutationRequest>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = createMutationKey()

    return useSWRMutation<Pet.CreateMutationResponse, Pet.CreateError, PetKey.CreateMutationKey | null, Pet.CreateMutationRequest>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petService.create(data);
    }, mutationOptions);
}

/**
 * @summary Finds Pets by status
 * @description Multiple status values can be provided with comma separated strings
 */
function useFindByStatusGet(params?: Pet.FindByStatusGetQueryParams, options?: {
    swr?: Parameters<typeof useSWR<Pet.FindByStatusGetQueryResponse, PetKey.FindByStatusGetQueryKey | null, any>>[2]
    shouldFetch?: boolean
}) {

    const { swr: queryOptions, shouldFetch = true } = options ?? {}
    const queryKey = findByStatusGetQueryKey(params, shouldFetch)

    return useSWR<Pet.FindByStatusGetQueryResponse, Pet.FindByStatusGetError, PetKey.FindByStatusGetQueryKey | null>(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async () => {
            return petService.findByStatusGet(params);
        }
    })
}

/**
 * @summary Finds Pets by tags
 * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
 */
function useFindByTagsGet(params?: Pet.FindByTagsGetQueryParams, options?: {
    swr?: Parameters<typeof useSWR<Pet.FindByTagsGetQueryResponse, PetKey.FindByTagsGetQueryKey | null, any>>[2]
    shouldFetch?: boolean
}) {

    const { swr: queryOptions, shouldFetch = true } = options ?? {}
    const queryKey = findByTagsGetQueryKey(params)

    return useSWR<Pet.FindByTagsGetQueryResponse, Pet.FindByTagsGetError, PetKey.FindByTagsGetQueryKey | null>(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async () => {
            return petService.findByTagsGet(params);
        }
    })
}

/**
 * @summary Find pet by ID
 * @description Returns a single pet
 */
function useFindByPetId(petId: Pet.FindByPetIdPathParams['petId'], options?: {
    swr?: Parameters<typeof useSWR<Pet.FindByPetIdQueryResponse, PetKey.FindByPetIdQueryKey | null, any>>[2]
    shouldFetch?: boolean
}) {

    const { swr: queryOptions, shouldFetch = true } = options ?? {}
    const queryKey = findByPetIdQueryKey(petId)

    return useSWR<Pet.FindByPetIdQueryResponse, Pet.FindByPetIdError, PetKey.FindByPetIdQueryKey | null>(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async () => {
            return petService.findByPetId(petId);
        }
    })
}

/** @summary Updates a pet in the store with form data */
function usePetIdPost(petId: Pet.PetIdPostPathParams['petId'], params?: Pet.PetIdPostQueryParams, options?: {
    swr?: SWRMutationConfiguration<Pet.PetIdPostMutationResponse, Pet.PetIdPostError, PetKey.PetIdPostMutationKey | null, never>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = petIdPostMutationKey(petId, params)

    return useSWRMutation<Pet.PetIdPostMutationResponse, Pet.PetIdPostError, PetKey.PetIdPostMutationKey | null, never>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petService.petIdPost(petId, params);
    }, mutationOptions);
}

/**
 * @summary Deletes a pet
 * @description delete a pet
 */
function useDelByPetId(petId: Pet.DelByPetIdPathParams['petId'], options?: {
    swr?: SWRMutationConfiguration<Pet.DelByPetIdMutationResponse, Pet.DelByPetIdError, PetKey.DelByPetIdMutationKey | null, never>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = delByPetIdMutationKey(petId)

    return useSWRMutation<Pet.DelByPetIdMutationResponse, Pet.DelByPetIdError, PetKey.DelByPetIdMutationKey | null, never>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petService.delByPetId(petId);
    }, mutationOptions);
}

/** @summary uploads an image */
function useUploadImagePost(petId: Pet.UploadImagePostPathParams['petId'], params?: Pet.UploadImagePostQueryParams, options?: {
    swr?: SWRMutationConfiguration<Pet.UploadImagePostMutationResponse, Pet.UploadImagePostError, PetKey.UploadImagePostMutationKey | null, Pet.UploadImagePostMutationRequest>;
    shouldFetch?: boolean;
}) {

    const { swr: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = uploadImagePostMutationKey(petId, params)

    return useSWRMutation<Pet.UploadImagePostMutationResponse, Pet.UploadImagePostError, PetKey.UploadImagePostMutationKey | null, Pet.UploadImagePostMutationRequest>(shouldFetch ? mutationKey : null, async (_url, { arg: data }) => {
        return petService.uploadImagePost(petId, data, params);
    }, mutationOptions);
}

export const petSWRKey = {
    updateMutationKey, createMutationKey, findByStatusGetQueryKey, findByTagsGetQueryKey, findByPetIdQueryKey, petIdPostMutationKey, delByPetIdMutationKey, uploadImagePostMutationKey
};
export const petSWR = {
    useUpdate, useCreate, useFindByStatusGet, useFindByTagsGet, useFindByPetId, usePetIdPost, useDelByPetId, useUploadImagePost
};
```
</details>



<details> 
  <summary>vue query</summary>

```TS
import { petService } from "./pet.service";
import type { Pet } from "./pet.schemas";
import type { MaybeRef } from "vue";
import { toValue } from "vue";
import { queryOptions, useQuery } from "@tanstack/vue-query";
import type { QueryKey, QueryObserverOptions, UseQueryReturnType, MutationObserverOptions } from "@tanstack/vue-query";
import { useMutation } from "@tanstack/vue-query";

export const updateMutationKey = () => [{ url: `/pet`, method: 'put' }] as const;

export const createMutationKey = () => [{ url: `/pet`, method: 'post' }] as const;

export const findByStatusGetQueryKey = (params?: MaybeRef<Pet.FindByStatusGetQueryParams>) => [{ url: `/pet/findByStatus`, method: 'get' }, ...(params ? [params] : [])] as const;

export const findByTagsGetQueryKey = (params?: MaybeRef<Pet.FindByTagsGetQueryParams>) => [{ url: `/pet/findByTags`, method: 'get' }, ...(params ? [params] : [])] as const;

export const findByPetIdQueryKey = (petId: Pet.FindByPetIdPathParams['petId']) => [{ url: `/pet/${petId}`, method: 'get' }] as const;

export const petIdPostMutationKey = (petId: Pet.PetIdPostPathParams['petId'], params?: MaybeRef<Pet.PetIdPostQueryParams>) => [{ url: `/pet/${petId}`, method: 'post' }, ...(params ? [params] : [])] as const;

export const delByPetIdMutationKey = (petId: Pet.DelByPetIdPathParams['petId']) => [{ url: `/pet/${petId}`, method: 'delete' }] as const;

export const uploadImagePostMutationKey = (petId: Pet.UploadImagePostPathParams['petId'], params?: MaybeRef<Pet.UploadImagePostQueryParams>) => [{ url: `/pet/${petId}/uploadImage`, method: 'post' }, ...(params ? [params] : [])] as const;
type UpdateMutationKey = ReturnType<typeof updateMutationKey>;
type CreateMutationKey = ReturnType<typeof createMutationKey>;
type FindByStatusGetQueryKey = ReturnType<typeof findByStatusGetQueryKey>;
type FindByTagsGetQueryKey = ReturnType<typeof findByTagsGetQueryKey>;
type FindByPetIdQueryKey = ReturnType<typeof findByPetIdQueryKey>;
type PetIdPostMutationKey = ReturnType<typeof petIdPostMutationKey>;
type DelByPetIdMutationKey = ReturnType<typeof delByPetIdMutationKey>;
type UploadImagePostMutationKey = ReturnType<typeof uploadImagePostMutationKey>;

/**
 * @summary Update an existing pet
 * @description Update an existing pet by Id
 */
function useUpdate(options?: {
    mutation?: MutationObserverOptions<Pet.UpdateMutationResponse, Pet.UpdateError, { data: MaybeRef<Pet.UpdateMutationRequest> }>;
}) {

    const { mutation: mutationOptions } = options ?? {}
    const mutationKey = mutationOptions?.mutationKey ?? updateMutationKey()

    return useMutation<Pet.UpdateMutationResponse, Pet.UpdateError, { data: Pet.UpdateMutationRequest }>({
        mutationFn: async ({ data }) => {
            return petService.update(data);
        },
        mutationKey,
        ...mutationOptions
    })
}

/**
 * @summary Add a new pet to the store
 * @description Add a new pet to the store
 */
function useCreate(options?: {
    mutation?: MutationObserverOptions<Pet.CreateMutationResponse, Pet.CreateError, { data: MaybeRef<Pet.CreateMutationRequest> }>;
}) {

    const { mutation: mutationOptions } = options ?? {}
    const mutationKey = mutationOptions?.mutationKey ?? createMutationKey()

    return useMutation<Pet.CreateMutationResponse, Pet.CreateError, { data: Pet.CreateMutationRequest }>({
        mutationFn: async ({ data }) => {
            return petService.create(data);
        },
        mutationKey,
        ...mutationOptions
    })
}

/**
 * @summary Finds Pets by status
 * @description Multiple status values can be provided with comma separated strings
 */
function useFindByStatusGet<TData = Pet.FindByStatusGetQueryResponse, TQueryData = Pet.FindByStatusGetQueryResponse, TQueryKey extends QueryKey = FindByStatusGetQueryKey>(params?: MaybeRef<Pet.FindByStatusGetQueryParams>, options?: {
    query?: Partial<QueryObserverOptions<Pet.FindByStatusGetQueryResponse, Pet.FindByStatusGetError, TData, TQueryData, TQueryKey>>
}) {

    const { query: queryOption } = options ?? {}
    const queryKey = queryOption?.queryKey ?? findByStatusGetQueryKey(params)

    return useQuery({
        ...(queryOptions({
            queryKey: queryKey as QueryKey,
            queryFn: async ({ signal }) => {
                return petService.findByStatusGet(toValue(params), { signal });
            }
        }) as QueryObserverOptions),
        ...(queryOption as unknown as Omit<QueryObserverOptions, 'queryKey'>)
    }) as UseQueryReturnType<TData, Pet.FindByStatusGetError>

}

/**
 * @summary Finds Pets by tags
 * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
 */
function useFindByTagsGet<TData = Pet.FindByTagsGetQueryResponse, TQueryData = Pet.FindByTagsGetQueryResponse, TQueryKey extends QueryKey = FindByTagsGetQueryKey>(params?: MaybeRef<Pet.FindByTagsGetQueryParams>, options?: {
    query?: Partial<QueryObserverOptions<Pet.FindByTagsGetQueryResponse, Pet.FindByTagsGetError, TData, TQueryData, TQueryKey>>
}) {

    const { query: queryOption } = options ?? {}
    const queryKey = queryOption?.queryKey ?? findByTagsGetQueryKey(params)

    return useQuery({
        ...(queryOptions({
            queryKey: queryKey as QueryKey,
            queryFn: async ({ signal }) => {
                return petService.findByTagsGet(toValue(params), { signal });
            }
        }) as QueryObserverOptions),
        ...(queryOption as unknown as Omit<QueryObserverOptions, 'queryKey'>)
    }) as UseQueryReturnType<TData, Pet.FindByTagsGetError>

}

/**
 * @summary Find pet by ID
 * @description Returns a single pet
 */
function useFindByPetId<TData = Pet.FindByPetIdQueryResponse, TQueryData = Pet.FindByPetIdQueryResponse, TQueryKey extends QueryKey = FindByPetIdQueryKey>(petId: Pet.FindByPetIdPathParams['petId'], options?: {
    query?: Partial<QueryObserverOptions<Pet.FindByPetIdQueryResponse, Pet.FindByPetIdError, TData, TQueryData, TQueryKey>>
}) {

    const { query: queryOption } = options ?? {}
    const queryKey = queryOption?.queryKey ?? findByPetIdQueryKey(petId)

    return useQuery({
        ...(queryOptions({
            queryKey: queryKey as QueryKey,
            queryFn: async ({ signal }) => {
                return petService.findByPetId(toValue(petId), { signal });
            }
        }) as QueryObserverOptions),
        ...(queryOption as unknown as Omit<QueryObserverOptions, 'queryKey'>)
    }) as UseQueryReturnType<TData, Pet.FindByPetIdError>

}

/** @summary Updates a pet in the store with form data */
function usePetIdPost(petId: Pet.PetIdPostPathParams['petId'], params?: MaybeRef<Pet.PetIdPostQueryParams>, options?: {
    mutation?: MutationObserverOptions<Pet.PetIdPostMutationResponse, Pet.PetIdPostError>;
}) {

    const { mutation: mutationOptions } = options ?? {}
    const mutationKey = mutationOptions?.mutationKey ?? petIdPostMutationKey(petId, params)

    return useMutation<Pet.PetIdPostMutationResponse, Pet.PetIdPostError>({
        mutationFn: async () => {
            return petService.petIdPost(toValue(petId), toValue(params));
        },
        mutationKey,
        ...mutationOptions
    })
}

/**
 * @summary Deletes a pet
 * @description delete a pet
 */
function useDelByPetId(petId: Pet.DelByPetIdPathParams['petId'], options?: {
    mutation?: MutationObserverOptions<Pet.DelByPetIdMutationResponse, Pet.DelByPetIdError>;
}) {

    const { mutation: mutationOptions } = options ?? {}
    const mutationKey = mutationOptions?.mutationKey ?? delByPetIdMutationKey(petId)

    return useMutation<Pet.DelByPetIdMutationResponse, Pet.DelByPetIdError>({
        mutationFn: async () => {
            return petService.delByPetId(toValue(petId));
        },
        mutationKey,
        ...mutationOptions
    })
}

/** @summary uploads an image */
function useUploadImagePost(petId: Pet.UploadImagePostPathParams['petId'], params?: MaybeRef<Pet.UploadImagePostQueryParams>, options?: {
    mutation?: MutationObserverOptions<Pet.UploadImagePostMutationResponse, Pet.UploadImagePostError, { data: MaybeRef<Pet.UploadImagePostMutationRequest> }>;
}) {

    const { mutation: mutationOptions } = options ?? {}
    const mutationKey = mutationOptions?.mutationKey ?? uploadImagePostMutationKey(petId, params)

    return useMutation<Pet.UploadImagePostMutationResponse, Pet.UploadImagePostError, { data: Pet.UploadImagePostMutationRequest }>({
        mutationFn: async ({ data }) => {
            return petService.uploadImagePost(toValue(petId), data, toValue(params));
        },
        mutationKey,
        ...mutationOptions
    })
}

export const petQuery = {
    updateMutationKey, createMutationKey, findByStatusGetQueryKey, findByTagsGetQueryKey, findByPetIdQueryKey, petIdPostMutationKey, delByPetIdMutationKey, uploadImagePostMutationKey, useUpdate, useCreate, useFindByStatusGet, useFindByTagsGet, useFindByPetId, usePetIdPost, useDelByPetId, useUploadImagePost
};

export namespace PetQuery {
    export type UpdateMutationKey = ReturnType<typeof updateMutationKey>;
    export type CreateMutationKey = ReturnType<typeof createMutationKey>;
    export type FindByStatusGetQueryKey = ReturnType<typeof findByStatusGetQueryKey>;
    export type FindByTagsGetQueryKey = ReturnType<typeof findByTagsGetQueryKey>;
    export type FindByPetIdQueryKey = ReturnType<typeof findByPetIdQueryKey>;
    export type PetIdPostMutationKey = ReturnType<typeof petIdPostMutationKey>;
    export type DelByPetIdMutationKey = ReturnType<typeof delByPetIdMutationKey>;
    export type UploadImagePostMutationKey = ReturnType<typeof uploadImagePostMutationKey>;
}
```
</details>
