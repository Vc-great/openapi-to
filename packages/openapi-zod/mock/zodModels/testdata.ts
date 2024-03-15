import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Testdata
 */
export const testdata = z.object({
    /**description*/
    number: z.number().optional(),
    /**description*/
    numberOfElements: z.number().optional(),
    /**description*/
    totalElements: z.number().optional(),
    /**description*/
    totalPages: z.number().optional()
});
