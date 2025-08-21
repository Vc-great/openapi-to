import type { OperationWrapper } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import { isRef } from "oas/types";
import { findSchemaDefinition } from "oas/utils";
import type { JsonResponseObject } from "@/types.ts";

export function getDataReturnType(operation: OperationWrapper): string[] {
	const allStatusCodes =
		operation.accessor.operation.getResponseStatusCodes?.() ?? [];
	const successCodes = allStatusCodes.filter((code) =>
		/^2\d{2}$|^300$/.test(code),
	);

	const responseObject: JsonResponseObject["jsonSchema"] | undefined = [
		...successCodes,
	]
		.map(
			(code) =>
				operation.accessor.operation.getResponseAsJSONSchema?.(code)?.[0] ??
				undefined,
		)
		.filter((res) => !!res)[0];

	if (!responseObject) {
		return [];
	}

	// 递归解析 schema，处理可能的多层 $ref
	function resolveSchema(schema: SchemaObject): SchemaObject {
		if (isRef(schema)) {
			const resolvedSchema = findSchemaDefinition(
				schema.$ref,
				operation.accessor.operation.api,
			);
			if (resolvedSchema) {
				// 递归解析，因为解析后的 schema 可能还包含 $ref
				return resolveSchema(resolvedSchema);
			}
		}
		return schema;
	}

	// 解析最终的 schema 对象
	const finalSchema = resolveSchema(responseObject.schema);

	// 判断是否为 object 类型
	if (finalSchema.type === "object" && finalSchema.properties) {
		// 返回所有的 key（数组格式）
		return Object.keys(finalSchema.properties);
	}

	// 其他情况返回空字符串
	return [];
}
