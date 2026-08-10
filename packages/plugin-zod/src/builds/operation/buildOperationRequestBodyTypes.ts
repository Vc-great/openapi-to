import { getRequestBodyTypeName } from "@/templates/operationTypeNameTemplate.ts";
import { requestBodyTemplate } from "@/templates/requestBodyTemplate.ts";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";
import {
	getOperationRequestBodyMediaTypeObject,
	type OperationWrapper,
	type ReferenceObject,
} from "@openapi-to/core";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type { VariableStatementStructure } from "ts-morph";

type MediaTypeObject = OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject;

export function buildOperationRequestBodyTypes(
	operation: OperationWrapper,
	options: SchemaRenderOptions = {},
): VariableStatementStructure | undefined {
	const bodyDataName = getRequestBodyTypeName(operation.accessor.operationName);

	// 获取请求体 schema
	const bodySchema = getRequestBodySchema(operation);

	if (!bodySchema) {
		return undefined;
	}
	return requestBodyTemplate(bodyDataName, bodySchema, options);
}

// ---------------- 辅助函数 ----------------

function getRequestBodySchema(
	operation: OperationWrapper,
): MediaTypeObject | ReferenceObject | null {
	const requestBody = operation.accessor.operation.schema.requestBody;
	// Preserve a referenced Request Body Object before selecting its media type.
	if (requestBody && "$ref" in requestBody && requestBody.$ref) {
		return requestBody;
	}

	return (
		getOperationRequestBodyMediaTypeObject(operation.accessor.operation) || null
	);
}
