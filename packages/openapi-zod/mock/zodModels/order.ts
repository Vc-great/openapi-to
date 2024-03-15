import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Order
 */
export const order = z.object({
    /***/
    id: z.number().optional(),
    /***/
    petId: z.number().optional(),
    /***/
    quantity: z.number().optional(),
    /***/
    shipDate: z.string().optional(),
    /**Order Status*/
    status: z.string().optional(),
    /***/
    complete: z.boolean().optional()
});
