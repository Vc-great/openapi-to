import type { ApiResponse } from "./ApiResponse";

/**
 *
 * @description
 * @UUID type-RefList
 */
export interface RefList {
  /**
   *
   * @description
   * @UUID type-ApiResponse
   */
  content?: ApiResponse;
  /**
   *
   * @description string
   */
  string?: string;
  /**
   *
   * @description
   */
  name?: string;
  /**
   *
   * @description title
   */
  title?: string;
  /**
   *
   * @description type
   */
  type?: string;
}
