import { testdata } from "./testdata";
import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Test32145
 */
export const test32145 = z.object({
    /**description*/
    code: z.number().optional(),
    /***/
    meta: z.lazy(() => testdata).optional()
});
