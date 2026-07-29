import type { Schema } from "@openapi-to/core";

export function canRenderAsPlainInterface(schema: Schema): boolean {
	if (typeof schema !== "object" || schema === null || Array.isArray(schema))
		return false;

	const record = schema as Record<string, unknown>;
	return (
		record.type === "object" &&
		typeof record.properties === "object" &&
		record.properties !== null &&
		record.nullable !== true &&
		!("$ref" in record) &&
		!("oneOf" in record) &&
		!("anyOf" in record) &&
		!("allOf" in record) &&
		!("not" in record) &&
		!("enum" in record) &&
		!("const" in record)
	);
}
