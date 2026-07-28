import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";
import { renderObjectSchema } from "@/templates/schemaTemplate.ts";
import type { SchemaObject } from "oas/types";

export function buildSchemaPropertiesTypes(
	baseSchema: SchemaObject,
	schemaModelName: string,
	options: SchemaRenderOptions = {},
): string {
	return renderObjectSchema(
		baseSchema as unknown as Record<string, unknown>,
		schemaModelName,
		options,
	);
}
