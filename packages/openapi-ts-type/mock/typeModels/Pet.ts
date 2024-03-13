import type { NewCategory } from "./NewCategory";
import type { Tag } from "./Tag";

/**
 *
 * @description
 * @UUID type-Pet
 */
export interface Pet {
  /**
   *
   * @description
   */
  id?: number;
  /**
   *
   * @description
   * @UUID type-Category
   */
  category?: NewCategory;
  /**
   *
   * @description
   */
  name: string;
  /**
   *
   * @description
   */
  photoUrls: Array<string>;
  /**
   *
   * @description
   */
  tags?: Tag[];
  /**
   *
   * @description pet status in the store
   */
  status?: string;
}
