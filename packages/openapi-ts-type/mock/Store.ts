import type { Order } from "./typeModels";

/**
 *
 * @tag store
 * @description Access to Petstore orders
 * @UUID type-store
 */
export namespace Store {
  /** */
  export type CreateBodyParams = Order;
  /** successful operation */
  export type CreateResponse = Order;
  /** */
  export type CreateResponse400 = unknown;
  /** */
  export type CreateErrorResponse = CreateResponse400;

  /** pathParams */
  export interface FindByOrderIdPathParams {
    /**
     *
     * @description
     */
    orderId: number;
  }

  /** successful operation */
  export type FindByOrderIdResponse = Order;
  /** */
  export type FindByOrderIdResponse400 = unknown;
  /** */
  export type FindByOrderIdResponse404 = unknown;
  /** */
  export type FindByOrderIdErrorResponse =
    | FindByOrderIdResponse400
    | FindByOrderIdResponse404;

  /** pathParams */
  export interface DelByOrderIdPathParams {
    /**
     *
     * @description
     */
    orderId: number;
  }

  /** */
  export type DelByOrderIdResponse400 = unknown;
  /** */
  export type DelByOrderIdResponse404 = unknown;
  /** */
  export type DelByOrderIdErrorResponse =
    | DelByOrderIdResponse400
    | DelByOrderIdResponse404;
  /** */
  export type DelByOrderIdResponse = unknown;

  /** successful operation */
  export interface InventoryGetResponse {
    /** */
    [key: string]: unknown;
  }

  /** */
  export type InventoryGetErrorResponse = unknown;
}
