[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

## openapi-to
Generate SDKs,OpenAPI to:

+ [x] ts request
+ [x] ts type
+ [x] zod
+ [x] Faker.js
+ [x] MSW
+ [ ] js request(jsDoc)
+ [ ] request object
+ [ ] vue-Query

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
} from "openapi-to";
import * as path from "path";

export default defineConfig({
  servers: [
    {
      input: {
        name: "swagger", // output file folder name
        path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
      },
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
  ],
});
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
