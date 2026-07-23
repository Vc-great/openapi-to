import { classifyResponseStatusCodes, type OperationWrapper } from "@openapi-to/core";
import type { StatementStructures } from "ts-morph";
import {
	buildDefaultSuccessType,
	buildResponseErrorType,
	operationResponseTemplate,
} from "@/templates/operationResponseTemplate.ts";
import { getResponseSuccessName } from "@/templates/operationTypeNameTemplate.ts";
import type { JsonResponseObject } from "@/types.ts";

export function buildJsonResponseTypes(
	operation: OperationWrapper,
): StatementStructures[] {
	const responseName = getResponseSuccessName(operation);

	const allStatusCodes =
		operation.accessor.operation.getResponseStatusCodes?.() ?? [];
	const { success: successCodes, error: errorCodes } =
		classifyResponseStatusCodes(allStatusCodes);

	const responseObjects: JsonResponseObject[] = [...successCodes, ...errorCodes]
		.map((code) => ({
			code,
			jsonSchema:
				operation.accessor.operation.getResponseAsJSONSchema?.(code)?.[0] ??
				undefined,
		}))
		.filter((res) => !!res.jsonSchema);

	const responseTypes = responseObjects.map((res) =>
		operationResponseTemplate(res, responseName),
	);

	responseTypes.push(
		buildResponseErrorType(
			errorCodes,
			operation.accessor.operationName,
			responseObjects,
		),
	);

	if (successCodes.length === 0 || responseObjects.length === 0) {
		responseTypes.push(buildDefaultSuccessType(responseName));
	}

	return responseTypes;
}
