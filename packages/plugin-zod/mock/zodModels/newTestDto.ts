import { newTest321 } from "./newTest321";
import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-TestDto
 */
export const newTestDto = z.object({
  /**test321*/
  test321: z.lazy(() => newTest321.array()).optional(),
});
