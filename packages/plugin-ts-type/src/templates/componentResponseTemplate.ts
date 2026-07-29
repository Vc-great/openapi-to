import { buildSchemaPropertiesTypes } from "@/builds/components/buildSchemaPropertiesTypes.ts";
import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { schemaTemplate } from "@/templates/schemaTemplate.ts";
import { getRefAlias } from "@openapi-to/core/utils";
import { upperFirst } from "lodash-es";
import type { Schema } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import {
	type InterfaceDeclarationStructure,
	type JSDocStructure,
	type OptionalKind,
	StructureKind,
	type TypeAliasDeclarationStructure,
} from "ts-morph";

type MediaTypeObject = { schema?: Schema };
export function componentResponseTemplate(
	mediaTypeObject: MediaTypeObject,
	responseName: string,
): TypeAliasDeclarationStructure | InterfaceDeclarationStructure {
	const schema = mediaTypeObject.schema;

	if (schema && typeof schema === "object" && "$ref" in schema && schema.$ref) {
		const refType = `${upperFirst(getRefAlias(schema.$ref))}Model`;
		return createTypeAlias(responseName, refType, []);
	}

	if (!schema) {
		return createTypeAlias(responseName, "unknown", []);
	}

	const docs: OptionalKind<JSDocStructure>[] =
		typeof schema === "object" && "description" in schema
			? jsDocTemplateFromSchema(schema.description, schema)
			: [];
	if (
		typeof schema === "object" &&
		"type" in schema &&
		schema.type === "object" &&
		schema.properties
	) {
		return {
			kind: StructureKind.Interface,
			name: responseName,
			isExported: true,
			docs,
			properties:
				buildSchemaPropertiesTypes(schema as SchemaObject, responseName) ?? [],
		};
	}

	const aliasedType = schemaTemplate(schema, responseName);
	return createTypeAlias(responseName, aliasedType, docs);
}
