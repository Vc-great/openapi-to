import { schemaTemplate } from "@/templates/schemaTemplate.ts";

import { isArray, isBoolean, isString } from "lodash-es";

import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import type { SchemaObjectAndJSONSchema } from "@/types.ts";
import type { SchemaObject } from "oas/types";
import type { OptionalKind, PropertySignatureStructure } from "ts-morph";

type OptionalKindOfPropertySignatureStructure =
	OptionalKind<PropertySignatureStructure>;

export function buildSchemaPropertiesTypes(
	baseSchema: SchemaObject,
	schemaModelName: string,
): OptionalKindOfPropertySignatureStructure[] | undefined {
	const properties = baseSchema.properties ?? {};
	const requiredList = resolveRequiredList(baseSchema.required);

	const typeStatements: OptionalKindOfPropertySignatureStructure[] =
		Object.entries(properties).map(([propertyName, schema]) => {
			const isRequired = requiredList.includes(propertyName);
			const typeString = schemaTemplate(schema, propertyName, schemaModelName);
			const propertyKey =
				(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propertyName)
					? propertyName
					: JSON.stringify(propertyName)) + (isRequired ? "" : "?");

			return {
				name: propertyKey,
				type: typeString,
				docs: jsDocTemplateFromSchema(
					typeof schema === "object" &&
						schema !== null &&
						"description" in schema
						? schema.description
						: undefined,
					schema,
					propertyName,
				),
			};
		});

	if (
		baseSchema.additionalProperties !== undefined &&
		baseSchema.additionalProperties !== false
	) {
		const additionalPropType = widenIndexSignatureForProperties(
			resolveAdditionalPropertiesType(baseSchema),
			typeStatements,
		);
		typeStatements.push({
			name: "[key: string]",
			type: additionalPropType,
		});
	}

	return typeStatements.length ? typeStatements : undefined;
}

// -------------------- Helper Methods --------------------

function resolveRequiredList(required: unknown): string[] {
	if (isBoolean(required)) return [];
	if (isArray(required)) return required.filter(isString);
	return [];
}

function resolveAdditionalPropertiesType(
	schema: SchemaObjectAndJSONSchema,
): string {
	if (
		!("additionalProperties" in schema) ||
		schema.additionalProperties === undefined ||
		schema.additionalProperties === false
	) {
		throw new Error("additionalProperties is undefined");
	}
	const additional = schema.additionalProperties;
	if (isBoolean(additional)) {
		return "unknown";
	}

	return schemaTemplate(additional, "");
}

function widenIndexSignatureForProperties(
	additionalType: string,
	properties: OptionalKindOfPropertySignatureStructure[],
): string {
	if (additionalType === "unknown" || properties.length === 0) {
		return additionalType;
	}

	const members = [additionalType];
	for (const property of properties) {
		if (typeof property.type === "string") members.push(property.type);
		if (typeof property.name === "string" && property.name.endsWith("?")) {
			members.push("undefined");
		}
	}
	return [...new Set(members)].join(" | ");
}
