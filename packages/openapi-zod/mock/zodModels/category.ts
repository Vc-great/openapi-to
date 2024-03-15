import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Category
 */
export const category = z.object({
    /***/
    id: z.number().optional(),
    /***/
    name: z.string().optional()
});
