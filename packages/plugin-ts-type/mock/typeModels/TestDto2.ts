import type { TestDto3 } from "./TestDto3";
import type { Testdata } from "./Testdata";

/**
 *
 * @description
 * @UUID type-TestDto2
 */
export interface TestDto2 {
  /**
   *
   * @description
   * @UUID type-TestDto3
   */
  content?: TestDto3;
  /**
   *
   * @description
   * @UUID type-Testdata
   */
  meta?: Testdata;
}
