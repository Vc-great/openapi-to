import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type {
	JSDocStructure,
	OptionalKind,
	VariableStatementStructure,
} from "ts-morph";
import { buildSchemaPropertiesTypes } from "@/builds/components/buildSchemaPropertiesTypes.ts";
import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { createVariable } from "@/templates/operationResponseTemplate.ts";
import {
	schemaTemplate,
	type SchemaRenderOptions,
} from "@/templates/schemaTemplate.ts";

type MediaTypeObject = OpenAPIV3_1.MediaTypeObject | OpenAPIV3.MediaTypeObject;
export function componentResponseTemplate(
	mediaTypeObject: MediaTypeObject,
	responseName: string,
	options: SchemaRenderOptions = {},
): VariableStatementStructure {
	const schema = mediaTypeObject.schema;

	if (schema && typeof schema === "object" && "$ref" in schema && schema.$ref) {
		const refType = schemaTemplate(schema, responseName, "", options);
		return createVariable(responseName, refType, []);
	}

	if (schema === undefined) {
		return createVariable(responseName, "z.unknown()", []);
	}

	const docs: OptionalKind<JSDocStructure>[] =
		typeof schema === "object" && schema !== null && "description" in schema
			? jsDocTemplateFromSchema(schema.description, schema)
			: [];
	if (
		schema &&
		typeof schema === "object" &&
		"type" in schema &&
		schema.type === "object" &&
		schema.properties
	) {
		const propertiesString = buildSchemaPropertiesTypes(schema, responseName);
		return createVariable(responseName, propertiesString, docs);
	}

	const aliasedType = schemaTemplate(schema, responseName, "", options);
	return createVariable(responseName, aliasedType, docs);
}
