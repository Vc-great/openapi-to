import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-User
 */
export const user = z.object({
    /***/
    id: z.number().optional(),
    /***/
    username: z.string().optional(),
    /***/
    firstName: z.string().optional(),
    /***/
    lastName: z.string().optional(),
    /***/
    email: z.string().optional(),
    /***/
    password: z.string().optional(),
    /***/
    phone: z.string().optional(),
    /**User Status*/
    userStatus: z.number().optional()
});
