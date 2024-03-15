import { z } from "zod";
import { user } from "./zodModels";
/** bodyParams */
const createWithArrayPostBodyParams = z.lazy(() => user.array());
/** */
const createWithArrayPostErrorResponse = z.unknown();
/** */
const createWithArrayPostResponse = z.unknown();
/** bodyParams */
const createWithListPostBodyParams = z.lazy(() => user.array());
/** */
const createWithListPostErrorResponse = z.unknown();
/** */
const createWithListPostResponse = z.unknown();
/** pathParams */
export const findByUsernamePathParams = z.object({
    /***/
    username: z.string()
});
/** successful operation */
const findByUsernameResponse = z.lazy(() => user);
/** */
const findByUsernameResponse400 = z.unknown();
/** */
const findByUsernameResponse404 = z.unknown();
/** */
const findByUsernameErrorResponse = z.union([findByUsernameResponse400, findByUsernameResponse404]);
/** pathParams */
export const usernamePutPathParams = z.object({
    /***/
    username: z.string()
});
/** bodyParams */
const usernamePutBodyParams = z.lazy(() => user);
/** */
const usernamePutResponse400 = z.unknown();
/** */
const usernamePutResponse404 = z.unknown();
/** */
const usernamePutErrorResponse = z.union([usernamePutResponse400, usernamePutResponse404]);
/** */
const usernamePutResponse = z.unknown();
/** pathParams */
export const delByUsernamePathParams = z.object({
    /***/
    username: z.string()
});
/** */
const delByUsernameResponse400 = z.unknown();
/** */
const delByUsernameResponse404 = z.unknown();
/** */
const delByUsernameErrorResponse = z.union([delByUsernameResponse400, delByUsernameResponse404]);
/** */
const delByUsernameResponse = z.unknown();
/** queryParams */
const loginGetQueryParams = z.object({
    /***/
    username: z.string(),
    /***/
    password: z.string()
});
/** successful operation */
const loginGetResponse;
/** */
const loginGetResponse400 = z.unknown();
/** */
const loginGetErrorResponse = loginGetResponse400;
/** */
const logoutGetErrorResponse = z.unknown();
/** */
const logoutGetResponse = z.unknown();
/** bodyParams */
const createBodyParams = z.lazy(() => user);
/** */
const createErrorResponse = z.unknown();
/** */
const createResponse = z.unknown();
/**
 *
 * @tag user
 * @description Operations about user
 * @UUID zod-user
 */
export const userZod = {
    /**bodyParams*/
    createWithArrayPostBodyParams,
    /***/
    createWithArrayPostErrorResponse,
    /***/
    createWithArrayPostResponse,
    /**bodyParams*/
    createWithListPostBodyParams,
    /***/
    createWithListPostErrorResponse,
    /***/
    createWithListPostResponse,
    /**pathParams*/
    findByUsernamePathParams,
    /**successful operation*/
    findByUsernameResponse,
    /***/
    findByUsernameResponse400,
    /***/
    findByUsernameResponse404,
    /***/
    findByUsernameErrorResponse,
    /**pathParams*/
    usernamePutPathParams,
    /**bodyParams*/
    usernamePutBodyParams,
    /***/
    usernamePutResponse400,
    /***/
    usernamePutResponse404,
    /***/
    usernamePutErrorResponse,
    /***/
    usernamePutResponse,
    /**pathParams*/
    delByUsernamePathParams,
    /***/
    delByUsernameResponse400,
    /***/
    delByUsernameResponse404,
    /***/
    delByUsernameErrorResponse,
    /***/
    delByUsernameResponse,
    /**queryParams*/
    loginGetQueryParams,
    /**successful operation*/
    loginGetResponse,
    /***/
    loginGetResponse400,
    /***/
    loginGetErrorResponse,
    /***/
    logoutGetErrorResponse,
    /***/
    logoutGetResponse,
    /**bodyParams*/
    createBodyParams,
    /***/
    createErrorResponse,
    /***/
    createResponse
};

/**
 *
 * @tag user
 * @description Operations about user
 * @UUID zod-user
 */
export namespace User {
    /** bodyParams */
    export type CreateWithArrayPostBodyParams = z.infer<typeof createWithArrayPostBodyParams>;
    /** */
    export type CreateWithArrayPostErrorResponse = z.infer<typeof createWithArrayPostErrorResponse>;
    /** */
    export type CreateWithArrayPostResponse = z.infer<typeof createWithArrayPostResponse>;
    /** bodyParams */
    export type CreateWithListPostBodyParams = z.infer<typeof createWithListPostBodyParams>;
    /** */
    export type CreateWithListPostErrorResponse = z.infer<typeof createWithListPostErrorResponse>;
    /** */
    export type CreateWithListPostResponse = z.infer<typeof createWithListPostResponse>;
    /** pathParams */
    export type FindByUsernamePathParams = z.infer<typeof findByUsernamePathParams>;
    /** successful operation */
    export type FindByUsernameResponse = z.infer<typeof findByUsernameResponse>;
    /** */
    export type FindByUsernameResponse400 = z.infer<typeof findByUsernameResponse400>;
    /** */
    export type FindByUsernameResponse404 = z.infer<typeof findByUsernameResponse404>;
    /** */
    export type FindByUsernameErrorResponse = z.infer<typeof findByUsernameErrorResponse>;
    /** pathParams */
    export type UsernamePutPathParams = z.infer<typeof usernamePutPathParams>;
    /** bodyParams */
    export type UsernamePutBodyParams = z.infer<typeof usernamePutBodyParams>;
    /** */
    export type UsernamePutResponse400 = z.infer<typeof usernamePutResponse400>;
    /** */
    export type UsernamePutResponse404 = z.infer<typeof usernamePutResponse404>;
    /** */
    export type UsernamePutErrorResponse = z.infer<typeof usernamePutErrorResponse>;
    /** */
    export type UsernamePutResponse = z.infer<typeof usernamePutResponse>;
    /** pathParams */
    export type DelByUsernamePathParams = z.infer<typeof delByUsernamePathParams>;
    /** */
    export type DelByUsernameResponse400 = z.infer<typeof delByUsernameResponse400>;
    /** */
    export type DelByUsernameResponse404 = z.infer<typeof delByUsernameResponse404>;
    /** */
    export type DelByUsernameErrorResponse = z.infer<typeof delByUsernameErrorResponse>;
    /** */
    export type DelByUsernameResponse = z.infer<typeof delByUsernameResponse>;
    /** queryParams */
    export type LoginGetQueryParams = z.infer<typeof loginGetQueryParams>;
    /** successful operation */
    export type LoginGetResponse = z.infer<typeof loginGetResponse>;
    /** */
    export type LoginGetResponse400 = z.infer<typeof loginGetResponse400>;
    /** */
    export type LoginGetErrorResponse = z.infer<typeof loginGetErrorResponse>;
    /** */
    export type LogoutGetErrorResponse = z.infer<typeof logoutGetErrorResponse>;
    /** */
    export type LogoutGetResponse = z.infer<typeof logoutGetResponse>;
    /** bodyParams */
    export type CreateBodyParams = z.infer<typeof createBodyParams>;
    /** */
    export type CreateErrorResponse = z.infer<typeof createErrorResponse>;
    /** */
    export type CreateResponse = z.infer<typeof createResponse>;
}
