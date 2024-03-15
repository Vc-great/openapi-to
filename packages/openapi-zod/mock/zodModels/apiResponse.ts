import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-ApiResponse
 */
export const apiResponse = z.object({
    /***/
    code: z.number().optional(),
    /***/
    type: z.string().optional(),
    /***/
    message: z.string().optional()
});
