import {
	jsDocTemplateFromParameter,
	writeJSDoc,
} from "@/templates/jsDocTemplateFromSchema.ts";
import { schemaTemplate } from "@/templates/schemaTemplate.ts";

import type { ParameterObjectWithRef } from "@openapi-to/core";
import { CodeBlockWriter } from "ts-morph";

/**
 * 将一组属性描述生成成带 JSDoc 注释的 TypeScript 对象字面量
 */
export function generateParameterSchema(
	parameters: ParameterObjectWithRef[],
	operationName: string,
): string {
	const writer = new CodeBlockWriter({ indentNumberOfSpaces: 4 });

	writer.block(() => {
		parameters.forEach((prop, idx) => {
			const name = prop.name;
			const comma = idx < parameters.length - 1 ? "," : "";

			if ("$ref" in prop && prop.$ref) {
				writer.writeLine(
					`${JSON.stringify(name)}: ${schemaTemplate(prop, name, operationName)}${comma}`,
				);
			} else {
				writeJSDoc(writer, jsDocTemplateFromParameter(prop));
				const optional = prop.required ? "" : ".optional()";
				const schemaString = prop.schema
					? schemaTemplate(prop.schema, name, operationName)
					: "z.string()";

				writer.writeLine(
					`${JSON.stringify(name)}: ${schemaString}${optional}${comma}`,
				);
			}
		});
	});
	return `z.object(${writer.toString()})`;
}
