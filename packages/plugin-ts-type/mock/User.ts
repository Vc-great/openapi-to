import type { User } from "./typeModels";

/**
 *
 * @tag user
 * @description Operations about user
 * @UUID type-user
 */
export namespace User {
  /** */
  export type CreateWithArrayPostBodyParams = User[];
  /** */
  export type CreateWithArrayPostErrorResponse = unknown;
  /** */
  export type CreateWithArrayPostResponse = unknown;
  /** */
  export type CreateWithListPostBodyParams = User[];
  /** */
  export type CreateWithListPostErrorResponse = unknown;
  /** */
  export type CreateWithListPostResponse = unknown;

  /** pathParams */
  export interface FindByUsernamePathParams {
    /**
     *
     * @description
     */
    username: string;
  }

  /** successful operation */
  export type FindByUsernameResponse = User;
  /** */
  export type FindByUsernameResponse400 = unknown;
  /** */
  export type FindByUsernameResponse404 = unknown;
  /** */
  export type FindByUsernameErrorResponse =
    | FindByUsernameResponse400
    | FindByUsernameResponse404;

  /** pathParams */
  export interface UsernamePutPathParams {
    /**
     *
     * @description
     */
    username: string;
  }

  /** */
  export type UsernamePutBodyParams = User;
  /** */
  export type UsernamePutResponse400 = unknown;
  /** */
  export type UsernamePutResponse404 = unknown;
  /** */
  export type UsernamePutErrorResponse =
    | UsernamePutResponse400
    | UsernamePutResponse404;
  /** */
  export type UsernamePutResponse = unknown;

  /** pathParams */
  export interface DelByUsernamePathParams {
    /**
     *
     * @description
     */
    username: string;
  }

  /** */
  export type DelByUsernameResponse400 = unknown;
  /** */
  export type DelByUsernameResponse404 = unknown;
  /** */
  export type DelByUsernameErrorResponse =
    | DelByUsernameResponse400
    | DelByUsernameResponse404;
  /** */
  export type DelByUsernameResponse = unknown;

  /** queryParams */
  export interface LoginGetQueryParams {
    /**
     *
     * @description
     */
    username: string;
    /**
     *
     * @description
     */
    password: string;
  }

  /** successful operation */
  export type LoginGetResponse = string;
  /** */
  export type LoginGetResponse400 = unknown;
  /** */
  export type LoginGetErrorResponse = LoginGetResponse400;
  /** */
  export type LogoutGetErrorResponse = unknown;
  /** */
  export type LogoutGetResponse = unknown;
  /** */
  export type CreateBodyParams = User;
  /** */
  export type CreateErrorResponse = unknown;
  /** */
  export type CreateResponse = unknown;
}
