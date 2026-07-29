import {
	jsDocTemplateFromParameter,
	writeJSDoc,
} from "@/templates/jsDocTemplateFromSchema.ts";
import { schemaTemplate } from "@/templates/schemaTemplate.ts";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";

import type { ParameterObjectWithRef } from "@openapi-to/core";
import { CodeBlockWriter } from "ts-morph";
import { getComponentRefExportName } from "./componentNaming.ts";

/**
 * 将一组属性描述生成成带 JSDoc 注释的 TypeScript 对象字面量
 */
export function generateParameterSchema(
	parameters: ParameterObjectWithRef[],
	operationName: string,
	options: SchemaRenderOptions = {},
): string {
	const writer = new CodeBlockWriter({ indentNumberOfSpaces: 4 });

	writer.block(() => {
		parameters.forEach((prop, idx) => {
			const name = prop.name;
			const comma = idx < parameters.length - 1 ? "," : "";
			const optional =
				prop.in === "path" || prop.required === true ? "" : ".optional()";

			writeJSDoc(writer, jsDocTemplateFromParameter(prop));
			let schemaString: string;
			if ("$ref" in prop && prop.$ref) {
				schemaString = getComponentRefExportName(prop.$ref);
			} else {
				schemaString =
					prop.schema !== undefined
						? schemaTemplate(prop.schema, name, operationName, options)
						: "z.string()";
			}

			writer.writeLine(
				`${JSON.stringify(name)}: ${schemaString}${optional}${comma}`,
			);
		});
	});
	return `z.object(${writer.toString()})`;
}
