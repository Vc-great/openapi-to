import type { ComponentsParameterValue } from "@openapi-to/core";
import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { createVariable } from "@/templates/operationResponseTemplate.ts";
import {
	schemaTemplate,
	type SchemaRenderOptions,
} from "@/templates/schemaTemplate.ts";
import {
	getComponentExportName,
	getComponentRefExportName,
} from "@/utils/componentNaming.ts";

export function buildComponentParameters(
	parameter: ComponentsParameterValue,
	parameterName: string,
	options: SchemaRenderOptions = {},
) {
	const parameterTypeName = getComponentExportName("parameters", parameterName);

	if (parameter && "$ref" in parameter && parameter.$ref) {
		const typeName = getComponentRefExportName(parameter.$ref);
		return createVariable(parameterTypeName, typeName, []);
	}

	if (
		parameter &&
		"schema" in parameter &&
		parameter.schema &&
		typeof parameter.schema === "object" &&
		"$ref" in parameter.schema &&
		parameter.schema.$ref
	) {
		const typeName = getComponentRefExportName(parameter.schema.$ref);
		return createVariable(parameterTypeName, typeName, []);
	}

	if (
		parameter &&
		"schema" in parameter &&
		parameter.schema !== undefined &&
		(typeof parameter.schema !== "object" || !("$ref" in parameter.schema))
	) {
		const typeString = schemaTemplate(
			parameter.schema,
			parameterTypeName,
			"",
			options,
		);

		return createVariable(
			parameterTypeName,
			typeString,
			jsDocTemplateFromSchema(
				parameter.description || "",
				parameter.schema,
				parameterName,
			),
		);
	}
	return undefined;
}
