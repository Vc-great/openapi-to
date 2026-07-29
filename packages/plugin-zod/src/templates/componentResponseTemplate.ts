import type { Schema } from "@openapi-to/core";
import type {
	JSDocStructure,
	OptionalKind,
	VariableStatementStructure,
} from "ts-morph";
import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { createVariable } from "@/templates/operationResponseTemplate.ts";
import {
	schemaTemplate,
	type SchemaRenderOptions,
} from "@/templates/schemaTemplate.ts";

type MediaTypeObject = { schema?: Schema };
export function componentResponseTemplate(
	mediaTypeObject: MediaTypeObject,
	responseName: string,
	options: SchemaRenderOptions = {},
): VariableStatementStructure {
	const schema = mediaTypeObject.schema;

	if (schema === undefined) {
		return createVariable(responseName, "z.unknown()", []);
	}

	const docs: OptionalKind<JSDocStructure>[] =
		typeof schema === "object" && schema !== null && "description" in schema
			? jsDocTemplateFromSchema(schema.description, schema)
			: [];
	const aliasedType = schemaTemplate(schema, responseName, "", options);
	return createVariable(responseName, aliasedType, docs);
}
