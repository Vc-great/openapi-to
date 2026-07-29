import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { schemaTemplate } from "@/templates/schemaTemplate.ts";
import { canRenderAsPlainInterface } from "@/templates/canRenderAsPlainInterface.ts";
import type { ComponentsSchema } from "@openapi-to/core";
import { upperFirst } from "lodash-es";
import type { SchemaObject } from "oas/types";
import {
	type InterfaceDeclarationStructure,
	type JSDocStructure,
	type OptionalKind,
	StructureKind,
	type TypeAliasDeclarationStructure,
} from "ts-morph";
import { buildSchemaPropertiesTypes } from "./buildSchemaPropertiesTypes.ts";

export type SchemaDeclarationStructure = InterfaceDeclarationStructure | TypeAliasDeclarationStructure

export function buildSchemas(
	schemaName: string,
	schema: ComponentsSchema,
): SchemaDeclarationStructure[] {
	if (
		schema === undefined ||
		schema === null ||
		(typeof schema !== "object" && typeof schema !== "boolean")
	) {
		return [];
	}

	const typeName = `${upperFirst(schemaName)}Model`;
	if (canRenderAsPlainInterface(schema)) {
		const objectSchema = schema as Exclude<ComponentsSchema, boolean>;
		return [
			{
				kind: StructureKind.Interface,
				name: typeName,
				isExported: true,
				docs: jsDocTemplateFromSchema(
					"description" in objectSchema
						? objectSchema.description
						: undefined,
					objectSchema,
					schemaName,
				),
				properties:
					buildSchemaPropertiesTypes(
						objectSchema as SchemaObject,
						schemaName,
					) ?? [],
			},
		];
	}

	const description =
		typeof schema === "object" && "description" in schema
			? schema.description
			: undefined;
	return [
		createTypeAlias(
			typeName,
			schemaTemplate(schema, schemaName),
			jsDocTemplateFromSchema(description, schema, schemaName),
		),
	];
}

function createTypeAlias(
	name: string,
	type: string,
	docs?: OptionalKind<JSDocStructure>[],
): TypeAliasDeclarationStructure {
	return {
		kind: StructureKind.TypeAlias,
		name,
		isExported: true,
		type,
		docs,
	};
}
