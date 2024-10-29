import { testDto3 } from "./testDto3";
import { testdata } from "./testdata";
import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-TestDto2
 */
export const testDto2 = z.object({
    /***/
    content: z.lazy(() => testDto3).optional(),
    /***/
    meta: z.lazy(() => testdata).optional()
});
