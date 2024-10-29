import { category } from "./category";
import { tag } from "./tag";
import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Pet
 */
export const pet = z.object({
    /***/
    id: z.number().optional(),
    /***/
    category: z.lazy(() => category).optional(),
    /***/
    name: z.string(),
    /***/
    photoUrls: z.string().array(),
    /***/
    tags: z.lazy(() => tag.array()).optional(),
    /**pet status in the store*/
    status: z.string().optional()
});
