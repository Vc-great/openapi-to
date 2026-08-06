import {
	type ComponentsParameters,
	type ComponentsSchema,
	type ParameterObjectWithRef,
	resolveParameterSchema,
	type Schema,
} from "@openapi-to/core";
import { isBoolean, isPlainObject, upperFirst } from "lodash-es";
import type { MediaTypeObject, SchemaObject } from "oas/types";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type { EnumItem } from "@/EnumRegistry.ts";
import { getInlineSchemaContextName } from "@/utils/inlineEnumNaming.ts";

type Reference = OpenAPIV3.ReferenceObject;

export const collectEnumsFromPathParameters = (
	parameters: ParameterObjectWithRef[],
	operationName: string,
): EnumItem[] => {
	return parameters.flatMap((parameter) => {
		const schema = resolveParameterSchema(parameter) || {};
		if (typeof schema !== "object") return [];
		const name = operationName + upperFirst(parameter.name);
		return collectEnumsFromSchema(schema, name);
	});
};

export const collectEnumsFromPathRequestBodies = (
	requestBodies:
		| MediaTypeObject
		| false
		| [string, MediaTypeObject, ...string[]],
	contextName: string,
): EnumItem[] => {
	if (requestBodies === false) return [];
	if (Array.isArray(requestBodies)) {
		const [_contentType, media] = requestBodies;

		if (media?.schema) return collectEnumsFromSchema(media.schema, contextName);
	} else if (requestBodies) {
		if (requestBodies.schema)
			return collectEnumsFromSchema(requestBodies.schema, contextName);
	}
	return [];
};

type Responses =
	| {
			description?: string;
			label: string;
			schema: SchemaObject;
			type: string | string[];
	  }[]
	| null;
export const collectEnumsFromPathResponses = (
	responses: Responses,
	contextName: string,
): EnumItem[] => {
	if (!responses) {
		return [];
	}

	return responses.flatMap((response) =>
		collectEnumsFromSchema(
			response.schema,
			`${contextName}${upperFirst(response.label)}`,
		),
	);
};

export const collectEnumsFromComponentParameters = (
	parameters: ComponentsParameters,
): EnumItem[] => {
	const enums = [];
	for (const [name, parameter] of Object.entries(parameters)) {
		if ("$ref" in parameter) continue;
		const schema = resolveParameterSchema(parameter);
		if (schema !== undefined)
			enums.push(
				...collectEnumsFromSchema(schema, `Parameter${upperFirst(name)}Model`),
			);
	}
	return enums;
};

export const collectEnumsFromComponentRequestBody = (
	rb: OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject | Reference,
	name: string,
): EnumItem[] => {
	if ("$ref" in rb) return [];
	const enums = [];
	for (const contentType in rb.content) {
		const media = rb.content[contentType];
		if (media?.schema)
			enums.push(...collectEnumsFromSchema(media.schema, name));
	}
	return enums;
};

export const collectEnumsFromComponentResponse = (
	response: OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject | Reference,
	contextName: string,
): EnumItem[] => {
	if ("$ref" in response) return [];
	return Object.values(response.content ?? {}).flatMap((media) =>
		media?.schema ? collectEnumsFromSchema(media.schema, contextName) : [],
	);
};

export const collectEnumsFromComponentSchema = (
	schema: ComponentsSchema,
	name: string,
): EnumItem[] => {
	return collectEnumsFromSchema(schema, name);
};

export function collectEnumsFromSchema(
	schema: Schema,
	contextName: string,
	enums: EnumItem[] = [],
): EnumItem[] {
	if (!schema || typeof schema !== "object") return enums;
	const record = schema as Record<string, unknown>;

	if (Array.isArray(record.enum)) {
		const enumName = `${contextName}`;

		enums.push({
			name: enumName,
			enumValue: record.enum,
			description:
				typeof record.description === "string" ? record.description : undefined,
		});
	}

	if (isPlainObject(record.properties)) {
		for (const [propName, propSchema] of Object.entries(
			record.properties as Record<string, unknown>,
		)) {
			if (typeof propSchema === "boolean" || isPlainObject(propSchema)) {
				collectEnumsFromSchema(
					propSchema as Schema,
					getInlineSchemaContextName(contextName, propName),
					enums,
				);
			}
		}
	}

	for (const key of ["allOf", "anyOf", "oneOf"] as const) {
		const arr = record[key];
		if (Array.isArray(arr)) {
			arr.forEach((item, idx) => {
				if (typeof item === "boolean" || isPlainObject(item)) {
					collectEnumsFromSchema(
						item as Schema,
						`${contextName}_${key}_${idx}`,
						enums,
					);
				}
			});
		}
	}

	if (record.items && typeof record.items === "object") {
		const items = record.items;
		if (isPlainObject(items)) {
			collectEnumsFromSchema(items as Schema, contextName, enums);
		}

		if (Array.isArray(items)) {
			items.forEach((item) => {
				if (!isBoolean(item)) {
					collectEnumsFromSchema(item as Schema, contextName, enums);
				}
			});
		}
	}
	return enums;
}
