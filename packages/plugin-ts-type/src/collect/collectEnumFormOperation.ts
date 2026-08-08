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
import {
	getOperationRequestBodyMediaType,
	type OperationWrapper,
} from "@openapi-to/core";

export function collectEnumFormOperation(operation: OperationWrapper) {
	const responseTagEnums = [];
	const operationSourcePath = [
		"paths",
		operation.path,
		operation.method,
	] as const;

	const statusCodes = operation.accessor.operation.getResponseStatusCodes();
	const responseName = getResponseSuccessName(operation);
	const requestBody = operation.accessor.operation.schema?.requestBody;
	const requestBodyEnums =
		requestBody && "$ref" in requestBody
			? []
			: collectEnumsFromPathRequestBodies(
					getOperationRequestBodyMediaType(operation.accessor.operation),
					getRequestBodyTypeName(operation.accessor.operationName),
					operationSourcePath,
				);
	for (const statusCode of statusCodes) {
		const responses =
			operation.accessor.operation.getResponseAsJSONSchema(statusCode);
		const responseObject =
			operation.accessor.operation.schema?.responses?.[statusCode];
		const contentTypes =
			responseObject && !("$ref" in responseObject) && responseObject.content
				? Object.keys(responseObject.content)
				: [];

		const responseEnum = collectEnumsFromPathResponses(
			responses,
			getResponseStatusTypeName(responseName, statusCode),
			[...operationSourcePath, "responses", statusCode],
			contentTypes,
		);
		responseTagEnums.push(...responseEnum);
	}

	return [
		...collectEnumsFromPathParameters(
			operation.accessor.parameters,
			operation.accessor.operationName,
			operationSourcePath,
		),
		...requestBodyEnums,
		...responseTagEnums,
	];
}
