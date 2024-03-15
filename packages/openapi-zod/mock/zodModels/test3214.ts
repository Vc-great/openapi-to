import { z } from "zod";
/**
 *
 * @description
 * @UUID zod-Test3214
 */
export const test3214 = z.object({
    /**默认值*/
    columnDefault: z.string().optional(),
    /**description*/
    columnLength: z.number().optional(),
    /**description*/
    columnName: z.string().optional(),
    /**description*/
    columnRemark: z.string().optional(),
    /**description*/
    columnScale: z.number().optional(),
    /**description*/
    columnType: z.string().optional(),
    /**description*/
    delFlag: z.boolean().optional(),
    /***/
    formId: z.number().optional(),
    /**id*/
    id: z.number().optional(),
    /**description*/
    notNull: z.boolean().optional()
});
