//@ts-nocheck
import { newPetZod } from "./newPetZod";
import type { newPet } from "./newPetZod";
import { paramsZodSchema, responseZodSchema, zodValidate } from "./newZod";
import { request } from "./newRequest";

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @uuid API-pet
 */
class NewPetAPI {
  /**
   *
   * @summary summary
   * @description
   * @uuid test
   */
  @zodValidate
  @responseZodSchema(newPetZod.testPostResponse)
  newtestPost(
    @paramsZodSchema(newPetZod.testPostBodyParams)
    bodyParams: newPet.TestPostBodyParams,
  ): Promise<[newPet.TestPostErrorResponse, newPet.TestPostResponse]> {
    return request({
      method: "post",
      url: `/pet/test`,
      data: bodyParams,
    });
  }

  /**
   *
   * @summary summary
   * @description
   * @uuid testput
   */
  @zodValidate
  @responseZodSchema(newPetZod.testPutResponse)
  newtestPut(
    @paramsZodSchema(newPetZod.testPutBodyParams)
    bodyParams: newPet.TestPutBodyParams,
  ): Promise<[newPet.TestPutErrorResponse, newPet.TestPutResponse]> {
    return request({
      method: "put",
      url: `/pet/test`,
      data: bodyParams,
    });
  }

  /**
   *
   * @summary summary
   * @description
   * @uuid testdelete
   */
  @zodValidate
  @responseZodSchema(newPetZod.delByTestResponse)
  newdelByTest(
    @paramsZodSchema(newPetZod.delByTestBodyParams)
    bodyParams: newPet.DelByTestBodyParams,
  ): Promise<[newPet.DelByTestErrorResponse, newPet.DelByTestResponse]> {
    return request({
      method: "delete",
      url: `/pet/test`,
      data: bodyParams,
    });
  }

  /**
   *
   * @summary summary
   * @description
   * @uuid test-idget
   */
  @zodValidate
  @responseZodSchema(newPetZod.testIdGetResponse)
  newtestIdGet(
    @paramsZodSchema(newPetZod.testIdGetQueryParams)
    queryParams: newPet.TestIdGetQueryParams,
    @paramsZodSchema(newPetZod.testIdGetPathParams.shape.testId)
    testId: newPet.TestIdGetPathParams["testId"],
  ): Promise<[newPet.TestIdGetErrorResponse, newPet.TestIdGetResponse]> {
    return request({
      method: "get",
      url: `/pet/test/${testId}`,
      params: queryParams,
      paramsSerializer(params: newPet.TestIdGetQueryParams) {
        return qs.stringify(params);
      },
    });
  }

  /**
   *
   * @summary uploads an image
   * @description pet
   * @uuid uploadFile
   */
  @zodValidate
  @responseZodSchema(newPetZod.uploadImagePostResponse)
  newuploadImagePost(
    @paramsZodSchema(newPetZod.uploadImagePostBodyParams)
    bodyParams: newPet.UploadImagePostBodyParams,
    @paramsZodSchema(newPetZod.uploadImagePostPathParams.shape.petId)
    petId: newPet.UploadImagePostPathParams["petId"],
  ): Promise<
    [newPet.UploadImagePostErrorResponse, newPet.UploadImagePostResponse]
  > {
    return request({
      method: "post",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      url: `/pet/${petId}/uploadImage`,
      data: bodyParams,
    });
  }

  /**
   *
   * @summary Add a new pet to the store
   * @description
   * @uuid addPet
   */
  @zodValidate
  @responseZodSchema(newPetZod.createResponse)
  newcreate(
    @paramsZodSchema(newPetZod.createBodyParams)
    bodyParams: newPet.CreateBodyParams,
  ): Promise<[newPet.CreateErrorResponse, newPet.CreateResponse]> {
    return request({
      method: "post",
      url: `/pet`,
      data: bodyParams,
    });
  }

  /**
   *
   * @summary Update an existing pet
   * @description
   * @uuid updatePet
   */
  @zodValidate
  @responseZodSchema(newPetZod.updateResponse)
  newupdate(
    @paramsZodSchema(newPetZod.updateBodyParams)
    bodyParams: newPet.UpdateBodyParams,
  ): Promise<[newPet.UpdateErrorResponse, newPet.UpdateResponse]> {
    return request({
      method: "put",
      url: `/pet`,
      data: bodyParams,
    });
  }

  /**
   *
   * @summary Finds Pets by status
   * @description Multiple status values can be provided with comma separated strings
   * @uuid findPetsByStatus
   */
  @zodValidate
  @responseZodSchema(newPetZod.findByStatusGetResponse)
  newfindByStatusGet(
    @paramsZodSchema(newPetZod.findByStatusGetQueryParams)
    queryParams: newPet.FindByStatusGetQueryParams,
  ): Promise<
    [newPet.FindByStatusGetErrorResponse, newPet.FindByStatusGetResponse]
  > {
    return request({
      method: "get",
      url: `/pet/findByStatus`,
      params: queryParams,
      paramsSerializer(params: newPet.FindByStatusGetQueryParams) {
        return qs.stringify(params);
      },
    });
  }

  /**
   *
   * @summary Finds Pets by tags
   * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
   * @uuid findPetsByTags
   */
  @zodValidate
  @responseZodSchema(newPetZod.findByTagsGetResponse)
  newfindByTagsGet(
    @paramsZodSchema(newPetZod.findByTagsGetQueryParams)
    queryParams: newPet.FindByTagsGetQueryParams,
  ): Promise<
    [newPet.FindByTagsGetErrorResponse, newPet.FindByTagsGetResponse]
  > {
    return request({
      method: "get",
      url: `/pet/findByTags`,
      params: queryParams,
      paramsSerializer(params: newPet.FindByTagsGetQueryParams) {
        return qs.stringify(params);
      },
    });
  }

  /**
   *
   * @summary Find pet by ID
   * @description Returns a single pet
   * @uuid getPetById
   */
  @zodValidate
  @responseZodSchema(newPetZod.findByPetIdResponse)
  newfindByPetId(
    @paramsZodSchema(newPetZod.findByPetIdPathParams.shape.petId)
    petId: newPet.FindByPetIdPathParams["petId"],
  ): Promise<[newPet.FindByPetIdErrorResponse, newPet.FindByPetIdResponse]> {
    return request({
      method: "get",
      url: `/pet/${petId}`,
    });
  }

  /**
   *
   * @summary Updates a pet in the store with form data
   * @description
   * @uuid updatePetWithForm
   */
  @zodValidate
  @responseZodSchema(newPetZod.petIdPostResponse)
  newpetIdPost(
    @paramsZodSchema(newPetZod.petIdPostBodyParams)
    bodyParams: newPet.PetIdPostBodyParams,
    @paramsZodSchema(newPetZod.petIdPostPathParams.shape.petId)
    petId: newPet.PetIdPostPathParams["petId"],
  ): Promise<[newPet.PetIdPostErrorResponse, newPet.PetIdPostResponse]> {
    return request({
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      url: `/pet/${petId}`,
      data: bodyParams,
    });
  }

  /**
   *
   * @summary Deletes a pet
   * @description
   * @uuid deletePet
   */
  @zodValidate
  @responseZodSchema(newPetZod.delByPetIdResponse)
  newdelByPetId(
    @paramsZodSchema(newPetZod.delByPetIdPathParams.shape.petId)
    petId: newPet.DelByPetIdPathParams["petId"],
  ): Promise<[newPet.DelByPetIdErrorResponse, newPet.DelByPetIdResponse]> {
    return request({
      method: "delete",
      url: `/pet/${petId}`,
    });
  }
}

export const newPetAPI = new NewPetAPI();
