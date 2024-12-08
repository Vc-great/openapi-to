[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

The current version is not compatible with V1.[V1 document](https://github.com/Vc-great/openapi-to/tree/v1)


## openapi-to
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


## Install
```
npm i openapi-to -g
```


## Usage
```js
  openapi init  // Generate openapi.config.js file
  openapi g     // Generate code from the openapi.config.js file
```

## openapi.config
```ts
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
    createTSRequest({
      createZodDecorator: true,
    }),
    createTSType(),
    createZod(),
    createFaker(),
    createMSW(),
    createNestjs(),
  ],
});
```
## createTSRequest


| Name                                          | Description                          | Type    | Default |
| --------------------------------------------- | ------------------------------------ | ------- |---------|
| createZodDecorator                            | create zod decorator                 | boolean | false   |
| compare                                       | Experimental features                | boolean | false   |
| zodDecoratorImportDeclaration.moduleSpecifier | zod Ddecorator Import from           | string  | -       |
| requestImportDeclaration.moduleSpecifier      | request Import from                  | string  | -       |
| requestType                                   | axios,common,commonWithArrayResponse | enum    | axios   |

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
import type { Pet } from "./Pet";
import { request } from "@/api/request";

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID API-pet
 */
class PetAPI {
  /**
   *
   * @summary summary
   * @description
   * @UUID operationId
   */
  testPost(bodyParams: Pet.TestPostBodyParams): Promise<[Pet.TestPostErrorResponse, Pet.TestPostResponse]> {
    return request({
      method: 'post',
      url: `/pet/test`,
      data: bodyParams
    })
  }

  /**
   *
   * @summary Add a new pet to the store
   * @description
   * @UUID addPet
   */
  create(bodyParams: Pet.CreateBodyParams): Promise<[Pet.CreateErrorResponse, Pet.CreateResponse]> {
    return request({
      method: 'post',
      url: `/pet`,
      data: bodyParams
    })
  }

  /**
   *
   * @summary Update an existing pet
   * @description
   * @UUID updatePet
   */
  update(bodyParams: Pet.UpdateBodyParams): Promise<[Pet.UpdateErrorResponse, Pet.UpdateResponse]> {
    return request({
      method: 'put',
      url: `/pet`,
      data: bodyParams
    })
  }
}

export const petAPI = new PetAPI;

```

</details>


<details> 
<summary>ts type</summary>

```ts
import type { TestDto, TestDto2, Test32145, ApiResponse, Pet } from "./typeModels";

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID type-pet
 */
export namespace Pet {
    /** */
    export type TestPostBodyParams = TestDto;
    /** OK */
    export type TestPostResponse = TestDto2;
    /** */
    export type TestPostResponse401 = unknown;
    /** */
    export type TestPostResponse403 = unknown;
    /** */
    export type TestPostResponse404 = unknown;
    /** */
    export type TestPostErrorResponse = TestPostResponse401 | TestPostResponse403 | TestPostResponse404;
    /** */
    export type TestPutBodyParams = TestDto;
    /** OK */
    export type TestPutResponse = TestDto2;
    /** */
    export type TestPutResponse401 = unknown;
    /** */
    export type TestPutResponse403 = unknown;
    /** */
    export type TestPutResponse404 = unknown;
    /** */
    export type TestPutErrorResponse = TestPutResponse401 | TestPutResponse403 | TestPutResponse404;
    /** */
    export type DelByTestBodyParams = Array<number>;
    /** OK */
    export type DelByTestResponse = Test32145;
    /** */
    export type DelByTestResponse401 = unknown;
    /** */
    export type DelByTestResponse403 = unknown;
    /** */
    export type DelByTestErrorResponse = DelByTestResponse401 | DelByTestResponse403;

    /** queryParams */
    export interface TestIdGetQueryParams {
        /**
         *
         * @description
         */
        fields?: Array<string>;
        /**
         *
         * @description
         */
        page: number;
        /**
         *
         * @description
         */
        size: number;
    }

    /** pathParams */
    export interface TestIdGetPathParams {
        /**
         *
         * @description
         */
        testId?: number;
        /**
         *
         * @description
         */
        testId2?: string;
    }

    /** OK */
    export type TestIdGetResponse = TestDto2;
    /** */
    export type TestIdGetResponse401 = unknown;
    /** */
    export type TestIdGetResponse403 = unknown;
    /** */
    export type TestIdGetResponse404 = unknown;
    /** */
    export type TestIdGetErrorResponse = TestIdGetResponse401 | TestIdGetResponse403 | TestIdGetResponse404;

    /** pathParams */
    export interface UploadImagePostPathParams {
        /**
         *
         * @description
         */
        petId: number;
    }

    /** bodyParams */
    export interface UploadImagePostBodyParams {
        /**
         *
         * @description Additional data to pass to server
         */
        additionalMetadata?: string;
        /**
         *
         * @description file to upload
         */
        file?: string;
    }

    /** successful operation */
    export type UploadImagePostResponse = ApiResponse;
    /** */
    export type UploadImagePostErrorResponse = unknown;
    /** */
    export type CreateBodyParams = Pet;
    /** */
    export type CreateResponse405 = unknown;
    /** */
    export type CreateErrorResponse = CreateResponse405;
    /** */
    export type CreateResponse = unknown;
    /** */
    export type UpdateBodyParams = Pet;
    /** */
    export type UpdateResponse400 = unknown;
    /** */
    export type UpdateResponse404 = unknown;
    /** */
    export type UpdateResponse405 = unknown;
    /** */
    export type UpdateErrorResponse = UpdateResponse400 | UpdateResponse404 | UpdateResponse405;
    /** */
    export type UpdateResponse = unknown;

    /** queryParams */
    export interface FindByStatusGetQueryParams {
        /**
         *
         * @description
         */
        status: Array<string>;
    }

    /** successful operation */
    export type FindByStatusGetResponse = Pet[];
    /** */
    export type FindByStatusGetResponse400 = unknown;
    /** */
    export type FindByStatusGetErrorResponse = FindByStatusGetResponse400;

    /** queryParams */
    export interface FindByTagsGetQueryParams {
        /**
         *
         * @description
         */
        tags: Array<string>;
    }

    /** successful operation */
    export type FindByTagsGetResponse = Pet[];
    /** */
    export type FindByTagsGetResponse400 = unknown;
    /** */
    export type FindByTagsGetErrorResponse = FindByTagsGetResponse400;

    /** pathParams */
    export interface FindByPetIdPathParams {
        /**
         *
         * @description
         */
        petId: number;
    }

    /** successful operation */
    export type FindByPetIdResponse = Pet;
    /** */
    export type FindByPetIdResponse400 = unknown;
    /** */
    export type FindByPetIdResponse404 = unknown;
    /** */
    export type FindByPetIdErrorResponse = FindByPetIdResponse400 | FindByPetIdResponse404;

    /** pathParams */
    export interface PetIdPostPathParams {
        /**
         *
         * @description
         */
        petId: number;
    }

    /** bodyParams */
    export interface PetIdPostBodyParams {
        /**
         *
         * @description Updated name of the pet
         */
        name?: string;
        /**
         *
         * @description Updated status of the pet
         */
        status?: string;
    }

    /** */
    export type PetIdPostResponse405 = unknown;
    /** */
    export type PetIdPostErrorResponse = PetIdPostResponse405;
    /** */
    export type PetIdPostResponse = unknown;

    /** pathParams */
    export interface DelByPetIdPathParams {
        /**
         *
         * @description
         */
        petId: number;
    }

    /** */
    export type DelByPetIdResponse400 = unknown;
    /** */
    export type DelByPetIdResponse404 = unknown;
    /** */
    export type DelByPetIdErrorResponse = DelByPetIdResponse400 | DelByPetIdResponse404;
    /** */
    export type DelByPetIdResponse = unknown;
}

```
</details>

<details> 
<summary>zod</summary>

```ts
import { z } from "zod";
import { testDto, testDto2, test32145, apiResponse, pet } from "./zodModels";
/** bodyParams */
const testPostBodyParams = z.lazy(() => testDto);
/** OK */
const testPostResponse = z.lazy(() => testDto2);
/** */
const testPostResponse401 = z.unknown();
/** */
const testPostResponse403 = z.unknown();
/** */
const testPostResponse404 = z.unknown();
/** */
const testPostErrorResponse = z.union([testPostResponse401, testPostResponse403, testPostResponse404]);
/** bodyParams */
const testPutBodyParams = z.lazy(() => testDto);
/** OK */
const testPutResponse = z.lazy(() => testDto2);
/** */
const testPutResponse401 = z.unknown();
/** */
const testPutResponse403 = z.unknown();
/** */
const testPutResponse404 = z.unknown();
/** */
const testPutErrorResponse = z.union([testPutResponse401, testPutResponse403, testPutResponse404]);
/** bodyParams */
const delByTestBodyParams = z.number().array();
/** OK */
const delByTestResponse = z.lazy(() => test32145);
/** */
const delByTestResponse401 = z.unknown();
/** */
const delByTestResponse403 = z.unknown();
/** */
const delByTestErrorResponse = z.union([delByTestResponse401, delByTestResponse403]);
/** queryParams */
const testIdGetQueryParams = z.object({
    /***/
    fields: z.string().array().optional(),
    /***/
    page: z.number(),
    /***/
    size: z.number()
});
/** pathParams */
export const testIdGetPathParams = z.object({
    /***/
    testId: z.number().optional(),
    /***/
    testId2: z.string().optional()
});
/** OK */
const testIdGetResponse = z.lazy(() => testDto2);
/** */
const testIdGetResponse401 = z.unknown();
/** */
const testIdGetResponse403 = z.unknown();
/** */
const testIdGetResponse404 = z.unknown();
/** */
const testIdGetErrorResponse = z.union([testIdGetResponse401, testIdGetResponse403, testIdGetResponse404]);
/** pathParams */
export const uploadImagePostPathParams = z.object({
    /***/
    petId: z.number()
});
/** bodyParams */
const uploadImagePostBodyParams = z.object({
    /**Additional data to pass to server*/
    additionalMetadata: z.string().optional(),
    /**file to upload*/
    file: z.string().optional()
});
/** successful operation */
const uploadImagePostResponse = z.lazy(() => apiResponse);
/** */
const uploadImagePostErrorResponse = z.unknown();
/** bodyParams */
const createBodyParams = z.lazy(() => pet);
/** */
const createResponse405 = z.unknown();
/** */
const createErrorResponse = createResponse405;
/** */
const createResponse = z.unknown();
/** bodyParams */
const updateBodyParams = z.lazy(() => pet);
/** */
const updateResponse400 = z.unknown();
/** */
const updateResponse404 = z.unknown();
/** */
const updateResponse405 = z.unknown();
/** */
const updateErrorResponse = z.union([updateResponse400, updateResponse404, updateResponse405]);
/** */
const updateResponse = z.unknown();
/** queryParams */
const findByStatusGetQueryParams = z.object({
    /***/
    status: z.string().array()
});
/** successful operation */
const findByStatusGetResponse = z.lazy(() => pet.array());
/** */
const findByStatusGetResponse400 = z.unknown();
/** */
const findByStatusGetErrorResponse = findByStatusGetResponse400;
/** queryParams */
const findByTagsGetQueryParams = z.object({
    /***/
    tags: z.string().array()
});
/** successful operation */
const findByTagsGetResponse = z.lazy(() => pet.array());
/** */
const findByTagsGetResponse400 = z.unknown();
/** */
const findByTagsGetErrorResponse = findByTagsGetResponse400;
/** pathParams */
export const findByPetIdPathParams = z.object({
    /***/
    petId: z.number()
});
/** successful operation */
const findByPetIdResponse = z.lazy(() => pet);
/** */
const findByPetIdResponse400 = z.unknown();
/** */
const findByPetIdResponse404 = z.unknown();
/** */
const findByPetIdErrorResponse = z.union([findByPetIdResponse400, findByPetIdResponse404]);
/** pathParams */
export const petIdPostPathParams = z.object({
    /***/
    petId: z.number()
});
/** bodyParams */
const petIdPostBodyParams = z.object({
    /**Updated name of the pet*/
    name: z.string().optional(),
    /**Updated status of the pet*/
    status: z.string().optional()
});
/** */
const petIdPostResponse405 = z.unknown();
/** */
const petIdPostErrorResponse = petIdPostResponse405;
/** */
const petIdPostResponse = z.unknown();
/** pathParams */
export const delByPetIdPathParams = z.object({
    /***/
    petId: z.number()
});
/** */
const delByPetIdResponse400 = z.unknown();
/** */
const delByPetIdResponse404 = z.unknown();
/** */
const delByPetIdErrorResponse = z.union([delByPetIdResponse400, delByPetIdResponse404]);
/** */
const delByPetIdResponse = z.unknown();
/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID zod-pet
 */
export const petZod = {
    /**bodyParams*/
    testPostBodyParams,
    /**OK*/
    testPostResponse,
    /***/
    testPostResponse401,
    /***/
    testPostResponse403,
    /***/
    testPostResponse404,
    /***/
    testPostErrorResponse,
    /**bodyParams*/
    testPutBodyParams,
    /**OK*/
    testPutResponse,
    /***/
    testPutResponse401,
    /***/
    testPutResponse403,
    /***/
    testPutResponse404,
    /***/
    testPutErrorResponse,
    /**bodyParams*/
    delByTestBodyParams,
    /**OK*/
    delByTestResponse,
    /***/
    delByTestResponse401,
    /***/
    delByTestResponse403,
    /***/
    delByTestErrorResponse,
    /**queryParams*/
    testIdGetQueryParams,
    /**pathParams*/
    testIdGetPathParams,
    /**OK*/
    testIdGetResponse,
    /***/
    testIdGetResponse401,
    /***/
    testIdGetResponse403,
    /***/
    testIdGetResponse404,
    /***/
    testIdGetErrorResponse,
    /**pathParams*/
    uploadImagePostPathParams,
    /**bodyParams*/
    uploadImagePostBodyParams,
    /**successful operation*/
    uploadImagePostResponse,
    /***/
    uploadImagePostErrorResponse,
    /**bodyParams*/
    createBodyParams,
    /***/
    createResponse405,
    /***/
    createErrorResponse,
    /***/
    createResponse,
    /**bodyParams*/
    updateBodyParams,
    /***/
    updateResponse400,
    /***/
    updateResponse404,
    /***/
    updateResponse405,
    /***/
    updateErrorResponse,
    /***/
    updateResponse,
    /**queryParams*/
    findByStatusGetQueryParams,
    /**successful operation*/
    findByStatusGetResponse,
    /***/
    findByStatusGetResponse400,
    /***/
    findByStatusGetErrorResponse,
    /**queryParams*/
    findByTagsGetQueryParams,
    /**successful operation*/
    findByTagsGetResponse,
    /***/
    findByTagsGetResponse400,
    /***/
    findByTagsGetErrorResponse,
    /**pathParams*/
    findByPetIdPathParams,
    /**successful operation*/
    findByPetIdResponse,
    /***/
    findByPetIdResponse400,
    /***/
    findByPetIdResponse404,
    /***/
    findByPetIdErrorResponse,
    /**pathParams*/
    petIdPostPathParams,
    /**bodyParams*/
    petIdPostBodyParams,
    /***/
    petIdPostResponse405,
    /***/
    petIdPostErrorResponse,
    /***/
    petIdPostResponse,
    /**pathParams*/
    delByPetIdPathParams,
    /***/
    delByPetIdResponse400,
    /***/
    delByPetIdResponse404,
    /***/
    delByPetIdErrorResponse,
    /***/
    delByPetIdResponse
};

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID zod-pet
 */
export namespace Pet {
    /** bodyParams */
    export type TestPostBodyParams = z.infer<typeof testPostBodyParams>;
    /** OK */
    export type TestPostResponse = z.infer<typeof testPostResponse>;
    /** */
    export type TestPostResponse401 = z.infer<typeof testPostResponse401>;
    /** */
    export type TestPostResponse403 = z.infer<typeof testPostResponse403>;
    /** */
    export type TestPostResponse404 = z.infer<typeof testPostResponse404>;
    /** */
    export type TestPostErrorResponse = z.infer<typeof testPostErrorResponse>;
    /** bodyParams */
    export type TestPutBodyParams = z.infer<typeof testPutBodyParams>;
    /** OK */
    export type TestPutResponse = z.infer<typeof testPutResponse>;
    /** */
    export type TestPutResponse401 = z.infer<typeof testPutResponse401>;
    /** */
    export type TestPutResponse403 = z.infer<typeof testPutResponse403>;
    /** */
    export type TestPutResponse404 = z.infer<typeof testPutResponse404>;
    /** */
    export type TestPutErrorResponse = z.infer<typeof testPutErrorResponse>;
    /** bodyParams */
    export type DelByTestBodyParams = z.infer<typeof delByTestBodyParams>;
    /** OK */
    export type DelByTestResponse = z.infer<typeof delByTestResponse>;
    /** */
    export type DelByTestResponse401 = z.infer<typeof delByTestResponse401>;
    /** */
    export type DelByTestResponse403 = z.infer<typeof delByTestResponse403>;
    /** */
    export type DelByTestErrorResponse = z.infer<typeof delByTestErrorResponse>;
    /** queryParams */
    export type TestIdGetQueryParams = z.infer<typeof testIdGetQueryParams>;
    /** pathParams */
    export type TestIdGetPathParams = z.infer<typeof testIdGetPathParams>;
    /** OK */
    export type TestIdGetResponse = z.infer<typeof testIdGetResponse>;
    /** */
    export type TestIdGetResponse401 = z.infer<typeof testIdGetResponse401>;
    /** */
    export type TestIdGetResponse403 = z.infer<typeof testIdGetResponse403>;
    /** */
    export type TestIdGetResponse404 = z.infer<typeof testIdGetResponse404>;
    /** */
    export type TestIdGetErrorResponse = z.infer<typeof testIdGetErrorResponse>;
    /** pathParams */
    export type UploadImagePostPathParams = z.infer<typeof uploadImagePostPathParams>;
    /** bodyParams */
    export type UploadImagePostBodyParams = z.infer<typeof uploadImagePostBodyParams>;
    /** successful operation */
    export type UploadImagePostResponse = z.infer<typeof uploadImagePostResponse>;
    /** */
    export type UploadImagePostErrorResponse = z.infer<typeof uploadImagePostErrorResponse>;
    /** bodyParams */
    export type CreateBodyParams = z.infer<typeof createBodyParams>;
    /** */
    export type CreateResponse405 = z.infer<typeof createResponse405>;
    /** */
    export type CreateErrorResponse = z.infer<typeof createErrorResponse>;
    /** */
    export type CreateResponse = z.infer<typeof createResponse>;
    /** bodyParams */
    export type UpdateBodyParams = z.infer<typeof updateBodyParams>;
    /** */
    export type UpdateResponse400 = z.infer<typeof updateResponse400>;
    /** */
    export type UpdateResponse404 = z.infer<typeof updateResponse404>;
    /** */
    export type UpdateResponse405 = z.infer<typeof updateResponse405>;
    /** */
    export type UpdateErrorResponse = z.infer<typeof updateErrorResponse>;
    /** */
    export type UpdateResponse = z.infer<typeof updateResponse>;
    /** queryParams */
    export type FindByStatusGetQueryParams = z.infer<typeof findByStatusGetQueryParams>;
    /** successful operation */
    export type FindByStatusGetResponse = z.infer<typeof findByStatusGetResponse>;
    /** */
    export type FindByStatusGetResponse400 = z.infer<typeof findByStatusGetResponse400>;
    /** */
    export type FindByStatusGetErrorResponse = z.infer<typeof findByStatusGetErrorResponse>;
    /** queryParams */
    export type FindByTagsGetQueryParams = z.infer<typeof findByTagsGetQueryParams>;
    /** successful operation */
    export type FindByTagsGetResponse = z.infer<typeof findByTagsGetResponse>;
    /** */
    export type FindByTagsGetResponse400 = z.infer<typeof findByTagsGetResponse400>;
    /** */
    export type FindByTagsGetErrorResponse = z.infer<typeof findByTagsGetErrorResponse>;
    /** pathParams */
    export type FindByPetIdPathParams = z.infer<typeof findByPetIdPathParams>;
    /** successful operation */
    export type FindByPetIdResponse = z.infer<typeof findByPetIdResponse>;
    /** */
    export type FindByPetIdResponse400 = z.infer<typeof findByPetIdResponse400>;
    /** */
    export type FindByPetIdResponse404 = z.infer<typeof findByPetIdResponse404>;
    /** */
    export type FindByPetIdErrorResponse = z.infer<typeof findByPetIdErrorResponse>;
    /** pathParams */
    export type PetIdPostPathParams = z.infer<typeof petIdPostPathParams>;
    /** bodyParams */
    export type PetIdPostBodyParams = z.infer<typeof petIdPostBodyParams>;
    /** */
    export type PetIdPostResponse405 = z.infer<typeof petIdPostResponse405>;
    /** */
    export type PetIdPostErrorResponse = z.infer<typeof petIdPostErrorResponse>;
    /** */
    export type PetIdPostResponse = z.infer<typeof petIdPostResponse>;
    /** pathParams */
    export type DelByPetIdPathParams = z.infer<typeof delByPetIdPathParams>;
    /** */
    export type DelByPetIdResponse400 = z.infer<typeof delByPetIdResponse400>;
    /** */
    export type DelByPetIdResponse404 = z.infer<typeof delByPetIdResponse404>;
    /** */
    export type DelByPetIdErrorResponse = z.infer<typeof delByPetIdErrorResponse>;
    /** */
    export type DelByPetIdResponse = z.infer<typeof delByPetIdResponse>;
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
