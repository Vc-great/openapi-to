import type {
  NewTestDto,
  TestDto2,
  Test32145,
  ApiResponse,
  Pet,
} from "./typeModels";

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @UUID type-pet
 */
export namespace NewPet {
  /** */
  export type TestPostBodyParams = NewTestDto;
  /** OK */
  export type TestPostResponse = TestDto2;
  /** */
  export type TestPostResponse401 = unknown;
  /** */
  export type TestPostResponse403 = unknown;
  /** */
  export type TestPostResponse404 = unknown;
  /** */
  export type TestPostErrorResponse =
    | TestPostResponse401
    | TestPostResponse403
    | TestPostResponse404;
  /** */
  export type TestPutBodyParams = NewTestDto;
  /** OK */
  export type TestPutResponse = TestDto2;
  /** */
  export type TestPutResponse401 = unknown;
  /** */
  export type TestPutResponse403 = unknown;
  /** */
  export type TestPutResponse404 = unknown;
  /** */
  export type TestPutErrorResponse =
    | TestPutResponse401
    | TestPutResponse403
    | TestPutResponse404;
  /** */
  export type DelByTestBodyParams = Array<number>;
  /** OK */
  export type DelByTestResponse = Test32145;
  /** */
  export type DelByTestResponse401 = unknown;
  /** */
  export type DelByTestResponse403 = unknown;
  /** */
  export type DelByTestErrorResponse =
    | DelByTestResponse401
    | DelByTestResponse403;

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
  export type TestIdGetErrorResponse =
    | TestIdGetResponse401
    | TestIdGetResponse403
    | TestIdGetResponse404;

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
  export type UpdateErrorResponse =
    | UpdateResponse400
    | UpdateResponse404
    | UpdateResponse405;
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
  export type FindByPetIdErrorResponse =
    | FindByPetIdResponse400
    | FindByPetIdResponse404;

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
  export type DelByPetIdErrorResponse =
    | DelByPetIdResponse400
    | DelByPetIdResponse404;
  /** */
  export type DelByPetIdResponse = unknown;
}
