import { z } from "zod";
import { order } from "./zodModels";
/** bodyParams */
const createBodyParams = z.lazy(() => order);
/** successful operation */
const createResponse = z.lazy(() => order);
/** */
const createResponse400 = z.unknown();
/** */
const createErrorResponse = createResponse400;
/** pathParams */
export const findByOrderIdPathParams = z.object({
    /***/
    orderId: z.number()
});
/** successful operation */
const findByOrderIdResponse = z.lazy(() => order);
/** */
const findByOrderIdResponse400 = z.unknown();
/** */
const findByOrderIdResponse404 = z.unknown();
/** */
const findByOrderIdErrorResponse = z.union([findByOrderIdResponse400, findByOrderIdResponse404]);
/** pathParams */
export const delByOrderIdPathParams = z.object({
    /***/
    orderId: z.number()
});
/** */
const delByOrderIdResponse400 = z.unknown();
/** */
const delByOrderIdResponse404 = z.unknown();
/** */
const delByOrderIdErrorResponse = z.union([delByOrderIdResponse400, delByOrderIdResponse404]);
/** */
const delByOrderIdResponse = z.unknown();
/** successful operation */
const inventoryGetResponse = z.object({});
/** */
const inventoryGetErrorResponse = z.unknown();
/**
 *
 * @tag store
 * @description Access to Petstore orders
 * @UUID zod-store
 */
export const storeZod = {
    /**bodyParams*/
    createBodyParams,
    /**successful operation*/
    createResponse,
    /***/
    createResponse400,
    /***/
    createErrorResponse,
    /**pathParams*/
    findByOrderIdPathParams,
    /**successful operation*/
    findByOrderIdResponse,
    /***/
    findByOrderIdResponse400,
    /***/
    findByOrderIdResponse404,
    /***/
    findByOrderIdErrorResponse,
    /**pathParams*/
    delByOrderIdPathParams,
    /***/
    delByOrderIdResponse400,
    /***/
    delByOrderIdResponse404,
    /***/
    delByOrderIdErrorResponse,
    /***/
    delByOrderIdResponse,
    /**successful operation*/
    inventoryGetResponse,
    /***/
    inventoryGetErrorResponse
};

/**
 *
 * @tag store
 * @description Access to Petstore orders
 * @UUID zod-store
 */
export namespace Store {
    /** bodyParams */
    export type CreateBodyParams = z.infer<typeof createBodyParams>;
    /** successful operation */
    export type CreateResponse = z.infer<typeof createResponse>;
    /** */
    export type CreateResponse400 = z.infer<typeof createResponse400>;
    /** */
    export type CreateErrorResponse = z.infer<typeof createErrorResponse>;
    /** pathParams */
    export type FindByOrderIdPathParams = z.infer<typeof findByOrderIdPathParams>;
    /** successful operation */
    export type FindByOrderIdResponse = z.infer<typeof findByOrderIdResponse>;
    /** */
    export type FindByOrderIdResponse400 = z.infer<typeof findByOrderIdResponse400>;
    /** */
    export type FindByOrderIdResponse404 = z.infer<typeof findByOrderIdResponse404>;
    /** */
    export type FindByOrderIdErrorResponse = z.infer<typeof findByOrderIdErrorResponse>;
    /** pathParams */
    export type DelByOrderIdPathParams = z.infer<typeof delByOrderIdPathParams>;
    /** */
    export type DelByOrderIdResponse400 = z.infer<typeof delByOrderIdResponse400>;
    /** */
    export type DelByOrderIdResponse404 = z.infer<typeof delByOrderIdResponse404>;
    /** */
    export type DelByOrderIdErrorResponse = z.infer<typeof delByOrderIdErrorResponse>;
    /** */
    export type DelByOrderIdResponse = z.infer<typeof delByOrderIdResponse>;
    /** successful operation */
    export type InventoryGetResponse = z.infer<typeof inventoryGetResponse>;
    /** */
    export type InventoryGetErrorResponse = z.infer<typeof inventoryGetErrorResponse>;
}
