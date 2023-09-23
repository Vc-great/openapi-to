export const zodStringExpected = `//eslint-disable-next-line @typescript-eslint/no-namespace
import { z } from 'zod';

/** summary */
const testPutBodyRequest = z.object({
    /***/
    test321: z.lazy(() => test321.array().optional()),
});
/** summary */
const testPutResponse = z.object({
    /**testDto3*/
    content: z.lazy(() => testDto3.optional()),
    /**title*/
    meta: z.lazy(() => testdata.optional()),
});
/**test321*/
const test321 = z.object({
    /***/
    id: z.number().optional(),
});
/**testDto3*/
const testDto3 = z.object({
    /***/
    test3214: z.lazy(() => test3214.array().optional()),
});
/**title*/
const testdata = z.object({
    /**description*/
    number: z.number().optional(),
    /**description*/
    numberOfElements: z.number().optional(),
    /**description*/
    totalElements: z.number().optional(),
    /**description*/
    totalPages: z.number().optional(),
});
/**test3214*/
const test3214 = z.object({
    /**默认值*/
    columnDefault: z.string().optional(),
    /**description*/
    columnLength: z.number().optional(),
    /**description*/
    columnName: z.string().optional(),
    /**description*/
    columnRemark: z.string().optional(),
    /**description*/
    columnScale: z.number().optional(),
    /**description*/
    columnType: z.enum(['CHAR']).optional(),
    /**description*/
    delFlag: z.boolean().optional(),
    /***/
    formId: z.number().optional(),
    /**id*/
    id: z.number().optional(),
    /**description*/
    notNull: z.boolean().optional(),
});
/** summary */
const testPostBodyRequest = z.lazy(() => testPutBodyRequest.extend({}));
/** summary */
const testPostResponse = z.lazy(() => testPutResponse.extend({}));
/** summary */
const delByTestBodyRequest = z.number().array();
/** summary */
const delByTestResponse = z.object({
    /**description*/
    code: z.number().optional(),
    /**title*/
    meta: z.lazy(() => testdata.optional()),
});
/** summary*/
const idQueryRequest = z.object({
    /** fields */
    fields: z.string().array().optional(),
});
/** summary*/
const idPathRequest = z.object({
    /** id */
    id: z.number(),
});
/** summary */
const idResponse = z.lazy(() => testPutResponse.extend({}));
/** uploads an image*/
const uploadImagePostPathRequest = z.object({
    /** ID of pet to update */
    petId: z.number(),
});
/** uploads an image */
const uploadImagePostBodyRequest = z.object({
    /**Additional data to pass to server*/
    additionalMetadata: z.string().optional(),
    /**
     *@remark content transferred in binary (octet-stream)
     *@description file to upload
     */
    file: z.string().optional(),
});
/** uploads an image */
const uploadImagePostResponse = z.object({
    /***/
    code: z.number().optional(),
    /***/
    type: z.string().optional(),
    /***/
    message: z.string().optional(),
});
/** Update an existing pet */
const updateBodyRequest = z.object({
    /***/
    id: z.number().optional(),
    /***/
    category: z.lazy(() => category.optional()),
    /***/
    name: z.string(),
    /***/
    photoUrls: z.string().array(),
    /***/
    tags: z.lazy(() => tag.array().optional()),
    /**pet status in the store*/
    status: z.enum(['available', 'pending', 'sold']).optional(),
});
/** Update an existing pet */
const updateResponse = z.object({});
/***/
const category = z.object({
    /***/
    id: z.number().optional(),
    /***/
    name: z.string().optional(),
});
/***/
const tag = z.object({
    /***/
    id: z.number().optional(),
    /***/
    name: z.string().optional(),
});
/** Add a new pet to the store */
const createBodyRequest = z.lazy(() => updateBodyRequest.extend({}));
/** Add a new pet to the store */
const createResponse = z.object({});
/** Finds Pets by status*/
const findByStatusGetQueryRequest = z.object({
    /** Status values that need to be considered for filter */
    status: z.string().array(),
});
/** Finds Pets by status */
const findByStatusGetResponse = z.object({});
/** Finds Pets by tags*/
const findByTagsGetQueryRequest = z.object({
    /** Tags to filter by */
    tags: z.string().array(),
});
/** Finds Pets by tags */
const findByTagsGetResponse = z.object({});
/** Find pet by ID*/
const detailByPetIdPathRequest = z.object({
    /** ID of pet to return */
    petId: z.number(),
});
/** Find pet by ID */
const detailByPetIdResponse = z.lazy(() => updateBodyRequest.extend({}));
/** Updates a pet in the store with form data*/
const petIdPathRequest = z.object({
    /** ID of pet that needs to be updated */
    petId: z.number(),
});
/** Updates a pet in the store with form data */
const petIdBodyRequest = z.object({
    /**Updated name of the pet*/
    name: z.string().optional(),
    /**Updated status of the pet*/
    status: z.string().optional(),
});
/** Updates a pet in the store with form data */
const petIdResponse = z.object({});
/** Deletes a pet*/
const delByPetIdPathRequest = z.object({
    /** Pet id to delete */
    petId: z.number(),
});
/** Deletes a pet */
const delByPetIdResponse = z.object({});

/**
 *@tag pet
 *@description Everything about your Pets
 */
//todo edit zod name
export const ZOD = {
    /** summary */
    testPutBodyRequest,
    /** summary */
    testPutResponse,
    /**test321*/
    test321,
    /**testDto3*/
    testDto3,
    /**title*/
    testdata,
    /**test3214*/
    test3214,
    /** summary */
    testPostBodyRequest,
    /** summary */
    testPostResponse,
    /** summary */
    delByTestBodyRequest,
    /** summary */
    delByTestResponse,
    /** summary*/
    idQueryRequest,
    /** summary*/
    idPathRequest,
    /** summary */
    idResponse,
    /** uploads an image*/
    uploadImagePostPathRequest,
    /** uploads an image */
    uploadImagePostBodyRequest,
    /** uploads an image */
    uploadImagePostResponse,
    /** Update an existing pet */
    updateBodyRequest,
    /** Update an existing pet */
    updateResponse,
    /**undefined*/
    category,
    /**undefined*/
    tag,
    /** Add a new pet to the store */
    createBodyRequest,
    /** Add a new pet to the store */
    createResponse,
    /** Finds Pets by status*/
    findByStatusGetQueryRequest,
    /** Finds Pets by status */
    findByStatusGetResponse,
    /** Finds Pets by tags*/
    findByTagsGetQueryRequest,
    /** Finds Pets by tags */
    findByTagsGetResponse,
    /** Find pet by ID*/
    detailByPetIdPathRequest,
    /** Find pet by ID */
    detailByPetIdResponse,
    /** Updates a pet in the store with form data*/
    petIdPathRequest,
    /** Updates a pet in the store with form data */
    petIdBodyRequest,
    /** Updates a pet in the store with form data */
    petIdResponse,
    /** Deletes a pet*/
    delByPetIdPathRequest,
    /** Deletes a pet */
    delByPetIdResponse,
};

/**
 *@tag pet
 *@description Everything about your Pets
 */
//todo edit namespace name
export namespace ApiType {
    /**error response*/
    export interface ErrorResponse {}
    /** summary */
    export type TestPutBodyRequest = z.infer<typeof testPutBodyRequest>;
    /** summary */
    export type TestPutResponse = z.infer<typeof testPutResponse>;
    /**test321*/
    export type Test321 = z.infer<typeof test321>;
    /**testDto3*/
    export type TestDto3 = z.infer<typeof testDto3>;
    /**title*/
    export type Testdata = z.infer<typeof testdata>;
    /**test3214*/
    export type Test3214 = z.infer<typeof test3214>;
    /** summary */
    export type TestPostBodyRequest = z.infer<typeof testPostBodyRequest>;
    /** summary */
    export type TestPostResponse = z.infer<typeof testPostResponse>;
    /** summary */
    export type DelByTestBodyRequest = z.infer<typeof delByTestBodyRequest>;
    /** summary */
    export type DelByTestResponse = z.infer<typeof delByTestResponse>;
    /** summary*/
    export type IdQueryRequest = z.infer<typeof idQueryRequest>;
    /** summary*/
    export type IdPathRequest = z.infer<typeof idPathRequest>;

    /** summary */
    export type IdResponse = z.infer<typeof idResponse>;
    /** uploads an image*/
    export type UploadImagePostPathRequest = z.infer<typeof uploadImagePostPathRequest>;
    /** uploads an image */
    export type UploadImagePostBodyRequest = z.infer<typeof uploadImagePostBodyRequest>;
    /** uploads an image */
    export type UploadImagePostResponse = z.infer<typeof uploadImagePostResponse>;
    /** Update an existing pet */
    export type UpdateBodyRequest = z.infer<typeof updateBodyRequest>;
    /** Update an existing pet */
    export type UpdateResponse = z.infer<typeof updateResponse>;
    /***/
    export type Category = z.infer<typeof category>;
    /***/
    export type Tag = z.infer<typeof tag>;
    /** Add a new pet to the store */
    export type CreateBodyRequest = z.infer<typeof createBodyRequest>;
    /** Add a new pet to the store */
    export type CreateResponse = z.infer<typeof createResponse>;
    /** Finds Pets by status*/
    export type FindByStatusGetQueryRequest = z.infer<typeof findByStatusGetQueryRequest>;
    /** Finds Pets by status */
    export type FindByStatusGetResponse = z.infer<typeof findByStatusGetResponse>;
    /** Finds Pets by tags*/
    export type FindByTagsGetQueryRequest = z.infer<typeof findByTagsGetQueryRequest>;
    /** Finds Pets by tags */
    export type FindByTagsGetResponse = z.infer<typeof findByTagsGetResponse>;
    /** Find pet by ID*/
    export type DetailByPetIdPathRequest = z.infer<typeof detailByPetIdPathRequest>;
    /** Find pet by ID */
    export type DetailByPetIdResponse = z.infer<typeof detailByPetIdResponse>;
    /** Updates a pet in the store with form data*/
    export type PetIdPathRequest = z.infer<typeof petIdPathRequest>;
    /** Updates a pet in the store with form data */
    export type PetIdBodyRequest = z.infer<typeof petIdBodyRequest>;
    /** Updates a pet in the store with form data */
    export type PetIdResponse = z.infer<typeof petIdResponse>;
    /** Deletes a pet*/
    export type DelByPetIdPathRequest = z.infer<typeof delByPetIdPathRequest>;
    /** Deletes a pet */
    export type DelByPetIdResponse = z.infer<typeof delByPetIdResponse>;
}

/**description*/
export const enum ColumnTypeLabel {
    CHAR = '',
}
/**description*/
export const enum ColumnType {
    CHAR = 'CHAR',
}
/**description*/
export const columnTypeOption = [{ label: ColumnTypeLabel.CHAR, value: ColumnType.CHAR }];
/**pet status in the store*/
export const enum StatusLabel {
    available = '',
    pending = '',
    sold = '',
}
/**pet status in the store*/
export const enum Status {
    available = 'available',
    pending = 'pending',
    sold = 'sold',
}
/**pet status in the store*/
export const statusOption = [
    { label: StatusLabel.available, value: Status.available },
    { label: StatusLabel.pending, value: Status.pending },
    { label: StatusLabel.sold, value: Status.sold },
];
`;
