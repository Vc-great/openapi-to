import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { createVariable } from "@/templates/operationResponseTemplate.ts";
import {
	schemaTemplate,
	type SchemaRenderOptions,
} from "@/templates/schemaTemplate.ts";
import type { ComponentsSchema } from "@openapi-to/core";
import { lowerFirst } from "lodash-es";
import type {
	InterfaceDeclarationStructure,
	TypeAliasDeclarationStructure,
	VariableStatementStructure,
} from "ts-morph";

export type SchemaDeclarationStructure =
	| InterfaceDeclarationStructure
	| TypeAliasDeclarationStructure;

export function buildSchemas(
	schemaName: string,
	schema: ComponentsSchema,
	options: SchemaRenderOptions = {},
	referenceName = schemaName,
): VariableStatementStructure {
	const variableName = `${lowerFirst(schemaName)}Schema`;
	const variable =
		typeof schema !== "object" || schema === null
			? createVariable(
					variableName,
					schemaTemplate(schema, schemaName, variableName, options),
					[],
				)
			: createVariable(
					variableName,
					schemaTemplate(schema, schemaName, variableName, options),
					"$ref" in schema
						? []
						: jsDocTemplateFromSchema(schema.description, schema),
				);

	if (options.lazyRefs?.has(`#/components/schemas/${referenceName}`)) {
		const declaration = variable.declarations[0];
		if (declaration) declaration.type = "z.ZodType<unknown>";
	}
	return variable;
}
