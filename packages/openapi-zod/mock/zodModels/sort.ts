import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Sort
 */
export const sort = z.object({
    /***/
    empty: z.boolean().optional(),
    /***/
    sorted: z.boolean().optional(),
    /***/
    unsorted: z.boolean().optional()
});
