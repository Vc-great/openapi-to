import type { Schema } from "@openapi-to/core";
import { getlowerFirstRefAlias } from "@/utils/getlowerFirstRefAlias.ts";

type SchemaRecord = Record<string, unknown>;

export type SchemaRenderDiagnostic = {
	code:
		| "ZOD_EMPTY_COMPOSITION"
		| "ZOD_EMPTY_ENUM"
		| "ZOD_UNSUPPORTED_ENUM_VALUE";
	message: string;
};

export type SchemaRenderOptions = {
	lazyRefs?: ReadonlySet<string>;
	onDiagnostic?: (diagnostic: SchemaRenderDiagnostic) => void;
};

function isRecord(value: unknown): value is SchemaRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reportDiagnostic(
	options: SchemaRenderOptions,
	diagnostic: SchemaRenderDiagnostic,
): void {
	if (options.onDiagnostic) {
		options.onDiagnostic(diagnostic);
		return;
	}
	throw new Error(`${diagnostic.code}: ${diagnostic.message}`);
}

function literal(value: unknown): string | undefined {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "boolean" ||
		(typeof value === "number" && Number.isFinite(value))
	) {
		return `z.literal(${JSON.stringify(value)})`;
	}
	return undefined;
}

function enumSchema(values: unknown[], options: SchemaRenderOptions): string {
	const uniqueValues = values.filter(
		(value, index) =>
			values.findIndex((candidate) => Object.is(candidate, value)) === index,
	);
	if (uniqueValues.length === 0) {
		reportDiagnostic(options, {
			code: "ZOD_EMPTY_ENUM",
			message: "An empty enum cannot match any value; generated z.never().",
		});
		return "z.never()";
	}

	const literals = uniqueValues.map(literal);
	if (literals.some((value) => value === undefined)) {
		reportDiagnostic(options, {
			code: "ZOD_UNSUPPORTED_ENUM_VALUE",
			message:
				"An enum contains a non-JSON scalar value that cannot be represented as a Zod literal; generated z.never().",
		});
		return "z.never()";
	}
	if (literals.length === 1) return literals[0] ?? "z.never()";
	if (uniqueValues.every((value) => typeof value === "string")) {
		return `z.enum([${uniqueValues.map((value) => JSON.stringify(value)).join(", ")}])`;
	}
	return `z.union([${literals.join(", ")}])`;
}

function unionSchema(
	schemas: unknown[],
	propertyName: string,
	parentName: string,
	options: SchemaRenderOptions,
): string {
	if (schemas.length === 0) {
		reportDiagnostic(options, {
			code: "ZOD_EMPTY_COMPOSITION",
			message: `An empty union${propertyName ? ` at "${propertyName}"` : ""} cannot match any value; generated z.never().`,
		});
		return "z.never()";
	}
	const members = schemas.map((schema) =>
		schemaTemplate(schema as Schema, propertyName, parentName, options),
	);
	return members.length === 1
		? (members[0] ?? "z.never()")
		: `z.union([${members.join(", ")}])`;
}

function intersectionSchema(
	schemas: unknown[],
	propertyName: string,
	parentName: string,
	options: SchemaRenderOptions,
): string {
	if (schemas.length === 0) {
		reportDiagnostic(options, {
			code: "ZOD_EMPTY_COMPOSITION",
			message: `An empty intersection${propertyName ? ` at "${propertyName}"` : ""} cannot be represented safely; generated z.never().`,
		});
		return "z.never()";
	}
	const members = schemas.map((schema) =>
		schemaTemplate(schema as Schema, propertyName, parentName, options),
	);
	return members
		.slice(1)
		.reduce(
			(left, right) => `z.intersection(${left}, ${right})`,
			members[0] ?? "z.never()",
		);
}

function appendStringConstraints(
	expression: string,
	schema: SchemaRecord,
): string {
	let result = expression;
	if (typeof schema.minLength === "number")
		result += `.min(${schema.minLength})`;
	if (typeof schema.maxLength === "number")
		result += `.max(${schema.maxLength})`;
	if (typeof schema.pattern === "string")
		result += `.regex(new RegExp(${JSON.stringify(schema.pattern)}))`;
	return result;
}

function formatterString(schema: SchemaRecord): string {
	let expression: string;
	switch (schema.format) {
		case "email":
			expression = "z.email()";
			break;
		case "uri":
		case "url":
			expression = "z.url()";
			break;
		case "uuid":
			expression = "z.uuid()";
			break;
		case "date":
			expression = "z.iso.date()";
			break;
		case "date-time":
		case "datetime":
			expression = "z.iso.datetime()";
			break;
		case "byte":
			expression = "z.base64()";
			break;
		case "password":
			expression = "z.string().min(1)";
			break;
		default:
			expression = "z.string()";
			break;
	}
	return appendStringConstraints(expression, schema);
}

function formatterNumber(schema: SchemaRecord): string {
	const integerFormats = new Set(["int32", "int64", "integer", "long", "int"]);
	let result =
		schema.type === "integer" || integerFormats.has(String(schema.format ?? ""))
			? "z.int()"
			: "z.number()";

	if (typeof schema.minimum === "number") {
		result +=
			schema.exclusiveMinimum === true
				? `.gt(${schema.minimum})`
				: `.min(${schema.minimum})`;
	} else if (typeof schema.exclusiveMinimum === "number") {
		result += `.gt(${schema.exclusiveMinimum})`;
	}
	if (typeof schema.maximum === "number") {
		result +=
			schema.exclusiveMaximum === true
				? `.lt(${schema.maximum})`
				: `.max(${schema.maximum})`;
	} else if (typeof schema.exclusiveMaximum === "number") {
		result += `.lt(${schema.exclusiveMaximum})`;
	}
	if (typeof schema.multipleOf === "number")
		result += `.multipleOf(${schema.multipleOf})`;
	return result;
}

function refSchema(ref: string, options: SchemaRenderOptions): string {
	const alias = getlowerFirstRefAlias(ref);
	return options.lazyRefs?.has(ref) ? `z.lazy(() => ${alias})` : alias;
}

function arraySchema(
	schema: SchemaRecord,
	propertyName: string,
	parentName: string,
	options: SchemaRenderOptions,
): string {
	const items = schema.items;
	let result = `z.array(${items === undefined ? "z.unknown()" : schemaTemplate(items as Schema, propertyName, parentName, options)})`;
	if (typeof schema.minItems === "number") result += `.min(${schema.minItems})`;
	if (typeof schema.maxItems === "number") result += `.max(${schema.maxItems})`;
	return result;
}

export function renderObjectSchema(
	schema: SchemaRecord,
	parentName = "",
	options: SchemaRenderOptions = {},
): string {
	const properties = isRecord(schema.properties) ? schema.properties : {};
	const required = new Set(
		Array.isArray(schema.required)
			? schema.required.filter(
					(name): name is string => typeof name === "string",
				)
			: [],
	);
	const entries = Object.entries(properties);
	const shape = entries
		.map(([propertyName, propertySchema]) => {
			const rendered = schemaTemplate(
				propertySchema as Schema,
				propertyName,
				parentName,
				options,
			);
			return `${JSON.stringify(propertyName)}: ${rendered}${required.has(propertyName) ? "" : ".optional()"}`;
		})
		.join(", ");

	if (schema.additionalProperties === false)
		return `z.strictObject({${shape}})`;
	if (
		schema.additionalProperties === true ||
		schema.additionalProperties === undefined
	)
		return `z.looseObject({${shape}})`;

	const additional = schemaTemplate(
		schema.additionalProperties as Schema,
		"",
		parentName,
		options,
	);
	if (entries.length === 0) return `z.record(z.string(), ${additional})`;
	return `z.object({${shape}}).catchall(${additional})`;
}

function resolveTypeArray(
	schema: SchemaRecord,
	propertyName: string,
	parentName: string,
	options: SchemaRenderOptions,
): string | undefined {
	if (!Array.isArray(schema.type)) return undefined;
	const members = schema.type.map((type) =>
		type === "null"
			? "z.null()"
			: resolveBaseSchema(
					{ ...schema, type } as Schema,
					propertyName,
					parentName,
					options,
				),
	);
	const unique = [...new Set(members)];
	return unique.length === 1
		? (unique[0] ?? "z.unknown()")
		: `z.union([${unique.join(", ")}])`;
}

export function schemaTemplate(
	schema: Schema,
	propertyName = "",
	parentName = "",
	options: SchemaRenderOptions = {},
): string {
	if (schema === true || schema === undefined) return "z.unknown()";
	if (schema === false) return "z.never()";
	if (!isRecord(schema)) return "z.unknown()";
	const record: SchemaRecord = schema;
	if (typeof record.$ref === "string") return refSchema(record.$ref, options);

	let result: string;
	if (Array.isArray(record.enum)) {
		result = enumSchema(record.enum, options);
	} else if ("const" in record) {
		result = literal(record.const) ?? "z.never()";
	} else if (Array.isArray(record.oneOf)) {
		result = unionSchema(record.oneOf, propertyName, parentName, options);
	} else if (Array.isArray(record.anyOf)) {
		result = unionSchema(record.anyOf, propertyName, parentName, options);
	} else if (Array.isArray(record.allOf)) {
		result = intersectionSchema(
			record.allOf,
			propertyName,
			parentName,
			options,
		);
	} else {
		result =
			resolveTypeArray(record, propertyName, parentName, options) ??
			resolveBaseSchema(schema, propertyName, parentName, options);
	}

	if (record.nullable === true && result !== "z.null()")
		result += ".nullable()";
	return result;
}

export function resolveBaseSchema(
	schema: Schema,
	propertyName = "",
	parentName = "",
	options: SchemaRenderOptions = {},
): string {
	if (schema === true || schema === undefined) return "z.unknown()";
	if (schema === false || !isRecord(schema)) return "z.never()";
	const record: SchemaRecord = schema;

	switch (record.type) {
		case "boolean":
			return "z.boolean()";
		case "string":
			return formatterString(record);
		case "number":
		case "integer":
			return formatterNumber(record);
		case "array":
			return arraySchema(record, propertyName, parentName, options);
		case "object":
			return renderObjectSchema(record, parentName, options);
		case "null":
			return "z.null()";
		default:
			if (
				record.properties !== undefined ||
				record.additionalProperties !== undefined
			)
				return renderObjectSchema(record, parentName, options);
			return "z.unknown()";
	}
}
