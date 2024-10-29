/**
 *
 * @description
 * @UUID type-Order
 */
export interface Order {
  /**
   *
   * @description
   */
  id?: number;
  /**
   *
   * @description
   */
  petId?: number;
  /**
   *
   * @description
   */
  quantity?: number;
  /**
   *
   * @description
   */
  shipDate?: string;
  /**
   *
   * @description Order Status
   */
  status?: string;
  /**
   *
   * @description
   */
  complete?: boolean;
}
