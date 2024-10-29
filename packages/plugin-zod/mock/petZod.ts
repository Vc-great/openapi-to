import { z } from "zod";
import { newTestDto, testDto2, test32145, apiResponse, pet } from "./zodModels";
/** bodyParams */
const testPostBodyParams = z.lazy(() => newTestDto);
/** OK */
const testPostResponse = z.lazy(() => testDto2);
/** */
const testPostResponse401 = z.unknown();
/** */
const testPostResponse403 = z.unknown();
/** */
const testPostResponse404 = z.unknown();
/** */
const testPostErrorResponse = z.union([
  testPostResponse401,
  testPostResponse403,
  testPostResponse404,
]);
/** bodyParams */
const testPutBodyParams = z.lazy(() => newTestDto);
/** OK */
const testPutResponse = z.lazy(() => testDto2);
/** */
const testPutResponse401 = z.unknown();
/** */
const testPutResponse403 = z.unknown();
/** */
const testPutResponse404 = z.unknown();
/** */
const testPutErrorResponse = z.union([
  testPutResponse401,
  testPutResponse403,
  testPutResponse404,
]);
/** bodyParams */
const delByTestBodyParams = z.number().array();
/** OK */
const delByTestResponse = z.lazy(() => test32145);
/** */
const delByTestResponse401 = z.unknown();
/** */
const delByTestResponse403 = z.unknown();
/** */
const delByTestErrorResponse = z.union([
  delByTestResponse401,
  delByTestResponse403,
]);
/** queryParams */
const testIdGetQueryParams = z.object({
  /***/
  fields: z.string().array().optional(),
  /***/
  page: z.number(),
  /***/
  size: z.number(),
});
/** pathParams */
export const testIdGetPathParams = z.object({
  /***/
  testId: z.number().optional(),
  /***/
  testId2: z.string().optional(),
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
const testIdGetErrorResponse = z.union([
  testIdGetResponse401,
  testIdGetResponse403,
  testIdGetResponse404,
]);
/** pathParams */
export const uploadImagePostPathParams = z.object({
  /***/
  petId: z.number(),
});
/** bodyParams */
const uploadImagePostBodyParams = z.object({
  /**Additional data to pass to server*/
  additionalMetadata: z.string().optional(),
  /**file to upload*/
  file: z.string().optional(),
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
const updateErrorResponse = z.union([
  updateResponse400,
  updateResponse404,
  updateResponse405,
]);
/** */
const updateResponse = z.unknown();
/** queryParams */
const findByStatusGetQueryParams = z.object({
  /***/
  status: z.string().array(),
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
  tags: z.string().array(),
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
  petId: z.number(),
});
/** successful operation */
const findByPetIdResponse = z.lazy(() => pet);
/** */
const findByPetIdResponse400 = z.unknown();
/** */
const findByPetIdResponse404 = z.unknown();
/** */
const findByPetIdErrorResponse = z.union([
  findByPetIdResponse400,
  findByPetIdResponse404,
]);
/** pathParams */
export const petIdPostPathParams = z.object({
  /***/
  petId: z.number(),
});
/** bodyParams */
const petIdPostBodyParams = z.object({
  /**Updated name of the pet*/
  name: z.string().optional(),
  /**Updated status of the pet*/
  status: z.string().optional(),
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
  petId: z.number(),
});
/** */
const delByPetIdResponse400 = z.unknown();
/** */
const delByPetIdResponse404 = z.unknown();
/** */
const delByPetIdErrorResponse = z.union([
  delByPetIdResponse400,
  delByPetIdResponse404,
]);
/** */
const delByPetIdResponse = z.unknown();
/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID zod-pet
 */
export const newPetZod = {
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
  delByPetIdResponse,
};

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID zod-pet
 */
export namespace NewPet {
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
  export type UploadImagePostPathParams = z.infer<
    typeof uploadImagePostPathParams
  >;
  /** bodyParams */
  export type UploadImagePostBodyParams = z.infer<
    typeof uploadImagePostBodyParams
  >;
  /** successful operation */
  export type UploadImagePostResponse = z.infer<typeof uploadImagePostResponse>;
  /** */
  export type UploadImagePostErrorResponse = z.infer<
    typeof uploadImagePostErrorResponse
  >;
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
  export type FindByStatusGetQueryParams = z.infer<
    typeof findByStatusGetQueryParams
  >;
  /** successful operation */
  export type FindByStatusGetResponse = z.infer<typeof findByStatusGetResponse>;
  /** */
  export type FindByStatusGetResponse400 = z.infer<
    typeof findByStatusGetResponse400
  >;
  /** */
  export type FindByStatusGetErrorResponse = z.infer<
    typeof findByStatusGetErrorResponse
  >;
  /** queryParams */
  export type FindByTagsGetQueryParams = z.infer<
    typeof findByTagsGetQueryParams
  >;
  /** successful operation */
  export type FindByTagsGetResponse = z.infer<typeof findByTagsGetResponse>;
  /** */
  export type FindByTagsGetResponse400 = z.infer<
    typeof findByTagsGetResponse400
  >;
  /** */
  export type FindByTagsGetErrorResponse = z.infer<
    typeof findByTagsGetErrorResponse
  >;
  /** pathParams */
  export type FindByPetIdPathParams = z.infer<typeof findByPetIdPathParams>;
  /** successful operation */
  export type FindByPetIdResponse = z.infer<typeof findByPetIdResponse>;
  /** */
  export type FindByPetIdResponse400 = z.infer<typeof findByPetIdResponse400>;
  /** */
  export type FindByPetIdResponse404 = z.infer<typeof findByPetIdResponse404>;
  /** */
  export type FindByPetIdErrorResponse = z.infer<
    typeof findByPetIdErrorResponse
  >;
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
