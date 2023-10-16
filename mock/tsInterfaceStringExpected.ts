export const tsInterfaceStringExpected = `//eslint-disable-next-line @typescript-eslint/no-namespace
/**
 *@tag pet
 *@description Everything about your Pets
 */
//todo edit namespace name
export namespace ApiType {
    /**error response*/
    export type ErrorResponse = object;
    /** summary */
    export interface TestPutBodyRequest {
        /***/
        test321?: Test321[];
    }
    /** summary */
    export interface TestPutResponse {
        /**testDto3*/
        content?: TestDto3;
        /**title*/
        meta?: Testdata;
    }
    /**test321*/
    export interface Test321 {
        /***/
        id?: number;
    }
    /**testDto3*/
    export interface TestDto3 {
        /***/
        test3214?: Test3214[];
    }
    /**title*/
    export interface Testdata {
        /**description*/
        number?: number;
        /**description*/
        numberOfElements?: number;
        /**description*/
        totalElements?: number;
        /**description*/
        totalPages?: number;
    }
    /**test3214*/
    export interface Test3214 {
        /**默认值*/
        columnDefault?: string;
        /**description*/
        columnLength?: number;
        /**description*/
        columnName?: string;
        /**description*/
        columnRemark?: string;
        /**description*/
        columnScale?: number;
        /**description*/
        columnType?: 'CHAR';
        /**description*/
        delFlag?: boolean;
        /***/
        formId?: number;
        /**id*/
        id?: number;
        /**description*/
        notNull?: boolean;
    }
    /** summary */
    export interface TestPostBodyRequest extends TestPutBodyRequest {}
    /** summary */
    export interface TestPostResponse extends TestPutResponse {}
    /** summary */
    export type DelByTestBodyRequest = number[];
    /** summary */
    export interface DelByTestResponse {
        /**description*/
        code?: number;
        /**title*/
        meta?: Testdata;
    }
    /** summary*/
    export interface IdQueryRequest {
        /** fields */
        fields?: string[];
    }
    /** summary*/
    export interface IdPathRequest {
        /** id */
        id: number;
    }
    /** summary */
    export interface IdResponse extends TestPutResponse {}
    /** uploads an image*/
    export interface UploadImagePostPathRequest {
        /** ID of pet to update */
        petId: number;
    }
    /** uploads an image */
    export interface UploadImagePostBodyRequest {
        /**Additional data to pass to server*/
        additionalMetadata?: string;
        /**
         *@remark content transferred in binary (octet-stream)
         *@description file to upload
         */
        file?: string;
    }
    /** uploads an image */
    export interface UploadImagePostResponse {
        /***/
        code?: number;
        /***/
        type?: string;
        /***/
        message?: string;
    }
    /** Update an existing pet */
    export interface UpdateBodyRequest {
        /***/
        id?: number;
        /***/
        category?: Category;
        /***/
        name: string;
        /***/
        photoUrls: string[];
        /***/
        tags?: Tag[];
        /**pet status in the store*/
        status?: 'available' | 'pending' | 'sold';
    }
    /** Update an existing pet */
    export interface UpdateResponse {}
    /***/
    export interface Category {
        /***/
        id?: number;
        /***/
        name?: string;
    }
    /***/
    export interface Tag {
        /***/
        id?: number;
        /***/
        name?: string;
    }
    /** Add a new pet to the store */
    export interface CreateBodyRequest extends UpdateBodyRequest {}
    /** Add a new pet to the store */
    export interface CreateResponse {}
    /** Finds Pets by status*/
    export interface FindByStatusGetQueryRequest {
        /** Status values that need to be considered for filter */
        status: string[];
    }
    /** Finds Pets by status */
    export interface FindByStatusGetResponse {}
    /** Finds Pets by tags*/
    export interface FindByTagsGetQueryRequest {
        /** Tags to filter by */
        tags: string[];
    }
    /** Finds Pets by tags */
    export interface FindByTagsGetResponse {}
    /** Find pet by ID*/
    export interface FindByPetIdPathRequest {
        /** ID of pet to return */
        petId: number;
    }
    /** Find pet by ID */
    export interface FindByPetIdResponse extends UpdateBodyRequest {}
    /** Updates a pet in the store with form data*/
    export interface PetIdPathRequest {
        /** ID of pet that needs to be updated */
        petId: number;
    }
    /** Updates a pet in the store with form data */
    export interface PetIdBodyRequest {
        /**Updated name of the pet*/
        name?: string;
        /**Updated status of the pet*/
        status?: string;
    }
    /** Updates a pet in the store with form data */
    export interface PetIdResponse {}
    /** Deletes a pet*/
    export interface DelByPetIdPathRequest {
        /** Pet id to delete */
        petId: number;
    }
    /** Deletes a pet */
    export interface DelByPetIdResponse {}
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
