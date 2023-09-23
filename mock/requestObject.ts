export const requestObjectExpected = `/** summary */
const TestPutBodyRequest = {
    /**test321*/
    test321: [],
};
/** summary */
const TestPostBodyRequest = TestPutBodyRequest;

const IdQueryRequest = {
    /** fields */
    fields: [],
};
/** uploads an image */
const UploadImagePostBodyRequest = {
    /**Additional data to pass to server*/
    additionalMetadata: '',
    /**file to upload*/
    file: '',
};
/** Update an existing pet */
const UpdateBodyRequest = {
    /***/
    id: 0,
    /***/
    category: '',
    /***/
    name: '',
    /***/
    photoUrls: [],
    /***/
    tags: [],
    /**pet status in the store*/
    status: '',
};
/** Add a new pet to the store */
const CreateBodyRequest = UpdateBodyRequest;
const FindByStatusGetQueryRequest = {
    /** Status values that need to be considered for filter */
    status: [],
};
const FindByTagsGetQueryRequest = {
    /** Tags to filter by */
    tags: [],
};

/** Updates a pet in the store with form data */
const PetIdBodyRequest = {
    /**Updated name of the pet*/
    name: '',
    /**Updated status of the pet*/
    status: '',
};
`;
