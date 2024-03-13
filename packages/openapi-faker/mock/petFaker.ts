//@ts-nocheck
import { faker } from "@faker-js/faker";
import { testDto2, test32145, apiResponse, pet } from "./fakerModels";
import type { Pet } from "./newPet";

/**
 *
 * @tag pet
 * @description Everything about your Pets
 * @uuid Faker-pet
 */
class PetFaker {
  /**
   *
   * @summary summary
   * @description
   * @uuid operationIdpost
   */
  newtestPost(): NonNullable<Pet.TestPostResponse> {
    return testDto2();
  }

  /**
   *
   * @summary summary
   * @description
   * @uuid operationIdput
   */
  newtestPut(): NonNullable<Pet.TestPutResponse> {
    return testDto2();
  }

  /**
   *
   * @summary summary
   * @description
   * @uuid operationIddelete
   */
  delByTest(): NonNullable<Pet.DelByTestResponse> {
    return test32145();
  }

  /**
   *
   * @summary summary
   * @description
   * @uuid get/pet/test/{test-id}
   */
  testIdGet(): NonNullable<Pet.TestIdGetResponse> {
    return testDto2();
  }

  /**
   *
   * @summary uploads an image
   * @description pet
   * @uuid uploadFile
   */
  uploadImagePost(): NonNullable<Pet.UploadImagePostResponse> {
    return apiResponse();
  }

  /**
   *
   * @summary Add a new pet to the store
   * @description
   * @uuid addPet
   */
  create(): NonNullable<Pet.CreateResponse> {
    return {};
  }

  /**
   *
   * @summary Update an existing pet
   * @description
   * @uuid updatePet
   */
  update(): NonNullable<Pet.UpdateResponse> {
    return {};
  }

  /**
   *
   * @summary Finds Pets by status
   * @description Multiple status values can be provided with comma separated strings
   * @uuid findPetsByStatus
   */
  findByStatusGet(): NonNullable<Pet.FindByStatusGetResponse> {
    return faker.helpers.multiple(() => pet(), {
      count: 10,
    });
  }

  /**
   *
   * @summary Finds Pets by tags
   * @description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
   * @uuid findPetsByTags
   */
  findByTagsGet(): NonNullable<Pet.FindByTagsGetResponse> {
    return faker.helpers.multiple(() => pet(), {
      count: 10,
    });
  }

  /**
   *
   * @summary Find pet by ID
   * @description Returns a single pet
   * @uuid getPetById
   */
  findByPetId(): NonNullable<Pet.FindByPetIdResponse> {
    return pet();
  }

  /**
   *
   * @summary Updates a pet in the store with form data
   * @description
   * @uuid updatePetWithForm
   */
  petIdPost(): NonNullable<Pet.PetIdPostResponse> {
    return {};
  }

  /**
   *
   * @summary Deletes a pet
   * @description
   * @uuid deletePet
   */
  delByPetId(): NonNullable<Pet.DelByPetIdResponse> {
    return {};
  }
}

export const petFaker = new PetFaker();
