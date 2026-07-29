import type { Schema as CoreSchema } from "@openapi-to/core";
import type {
	JSONSchema4,
	JSONSchema6Definition,
	JSONSchema7Definition,
} from "json-schema";
import { isBoolean } from "lodash-es";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";

type Schema =
	| OpenAPIV3.ReferenceObject
	| SchemaObject
	| JSONSchema4
	| JSONSchema7Definition
	| JSONSchema6Definition;

export function collectRefsFromSchema(schema: CoreSchema): Array<string> {
	const refs = new Set<string>();

	function walk(schema: Schema) {
		if (!schema || typeof schema !== "object") return;

		if ("$ref" in schema) {
			if (typeof schema.$ref === "string") {
				refs.add(schema.$ref);
			}
		}

		// object properties
		if ("properties" in schema && typeof schema.properties === "object") {
			Object.values(schema.properties).forEach(walk);
		}

		// array items
		if ("items" in schema && schema.items) {
			if (Array.isArray(schema.items)) {
				schema.items.forEach(walk);
			} else {
				!isBoolean(schema.items) && walk(schema.items);
			}
		}
		// allOf / anyOf / oneOf
		const composedSchema = schema as Schema &
			Partial<Record<"allOf" | "anyOf" | "oneOf", Schema[]>>;
		(["allOf", "anyOf", "oneOf"] as const).forEach((key) => {
			const composed = composedSchema[key];
			if (Array.isArray(composed)) {
				composed.forEach(walk);
			}
		});

		// not
		if ("not" in schema && schema.not) {
			!isBoolean(schema.not) && walk(schema.not);
		}

		// additionalProperties
		if (
			"additionalProperties" in schema &&
			typeof schema.additionalProperties === "object"
		) {
			walk(schema.additionalProperties);
		}
	}

	walk(schema);

	return [...refs];
}
