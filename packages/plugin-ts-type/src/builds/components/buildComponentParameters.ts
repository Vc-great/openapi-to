import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { schemaTemplate } from "@/templates/schemaTemplate.ts";
import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";

import type { ComponentsParameterValue } from "@openapi-to/core";
import { resolveParameterSchema } from "@openapi-to/core";
import { upperFirst } from "lodash-es";

export function buildComponentParameters(
	parameter: ComponentsParameterValue,
	parameterName: string,
) {
	const parameterTypeName = `Parameter${upperFirst(parameterName)}Model`;

	if (parameter && "$ref" in parameter && parameter.$ref) {
		const typeName = getUpperFirstRefAlias(parameter.$ref);
		return createTypeAlias(parameterTypeName, typeName, []);
	}

	if (parameter && !("$ref" in parameter)) {
		const schema = resolveParameterSchema(parameter) ?? {
			type: "string" as const,
		};
		const typeString = schemaTemplate(schema, parameterTypeName);

		return createTypeAlias(
			parameterTypeName,
			typeString,
			jsDocTemplateFromSchema(
				parameter.description || "",
				schema,
				parameterName,
			),
		);
	}
	return undefined;
}
