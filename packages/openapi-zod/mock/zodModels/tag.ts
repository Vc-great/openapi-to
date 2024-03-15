import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Tag
 */
export const tag = z.object({
    /***/
    id: z.number().optional(),
    /***/
    name: z.string().optional()
});
