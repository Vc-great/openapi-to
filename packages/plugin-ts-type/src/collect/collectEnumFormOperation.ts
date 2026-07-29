import {
	collectEnumsFromPathParameters,
	collectEnumsFromPathRequestBodies,
	collectEnumsFromPathResponses,
} from "@/collect/collectEnumsFromDocument.ts";
import {
	getRequestBodyTypeName,
	getResponseStatusTypeName,
	getResponseSuccessName,
} from "@/templates/operationTypeNameTemplate.ts";
import type { OperationWrapper } from "@openapi-to/core";

export function collectEnumFormOperation(operation: OperationWrapper) {
	const responseTagEnums = [];

	const statusCodes = operation.accessor.operation.getResponseStatusCodes();
	const responseName = getResponseSuccessName(operation);
	for (const statusCode of statusCodes) {
		const responses =
			operation.accessor.operation.getResponseAsJSONSchema(statusCode);

		const responseEnum = collectEnumsFromPathResponses(
			responses,
			getResponseStatusTypeName(responseName, statusCode),
		);
		responseTagEnums.push(...responseEnum);
	}

	return [
		...collectEnumsFromPathParameters(
			operation.accessor.parameters,
			operation.accessor.operationName,
		),
		...collectEnumsFromPathRequestBodies(
			operation.accessor.operation.getRequestBody(),
			getRequestBodyTypeName(operation.accessor.operationName),
		),
		...responseTagEnums,
	];
}
