import { buildSchemaPropertiesTypes } from "@/builds/components/buildSchemaPropertiesTypes.ts";
import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { schemaTemplate } from "@/templates/schemaTemplate.ts";
import { canRenderAsPlainInterface } from "@/templates/canRenderAsPlainInterface.ts";
import type {
	InlineEnumSourcePath,
	InlineEnumSymbolResolver,
} from "@/utils/inlineEnumNaming.ts";
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
	inlineEnumSymbols?: InlineEnumSymbolResolver,
	inlineEnumSourcePath?: InlineEnumSourcePath,
): TypeAliasDeclarationStructure | InterfaceDeclarationStructure {
	const schema = mediaTypeObject.schema;

	if (schema === undefined) {
		return createTypeAlias(responseName, "unknown", []);
	}

	const docs: OptionalKind<JSDocStructure>[] =
		typeof schema === "object" && "description" in schema
			? jsDocTemplateFromSchema(schema.description, schema)
			: [];
	if (canRenderAsPlainInterface(schema)) {
		return {
			kind: StructureKind.Interface,
			name: responseName,
			isExported: true,
			docs,
			properties:
				buildSchemaPropertiesTypes(
					schema as SchemaObject,
					responseName,
					inlineEnumSymbols,
					inlineEnumSourcePath,
				) ?? [],
		};
	}

	const aliasedType = schemaTemplate(
		schema,
		responseName,
		undefined,
		inlineEnumSymbols,
		inlineEnumSourcePath,
	);
	return createTypeAlias(responseName, aliasedType, docs);
}
