import { apiResponse } from "./apiResponse";
import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-RefList
 */
export const refList = z.object({
    /***/
    content: z.lazy(() => apiResponse).optional(),
    /**string*/
    string: z.string().optional(),
    /***/
    name: z.string().optional(),
    /**title*/
    title: z.string().optional(),
    /**type*/
    type: z.string().optional()
});
