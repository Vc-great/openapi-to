import { test3214 } from "./test3214";
import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-TestDto3
 */
export const testDto3 = z.object({
    /***/
    test3214: z.lazy(() => test3214.array()).optional()
});
