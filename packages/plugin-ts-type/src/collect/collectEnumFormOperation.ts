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
	describeOperationResponses,
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
	for (const response of describeOperationResponses(
		operation.accessor.operation,
	)) {
		if (response.kind === "reference") continue;
		const inspection = response.inspection ?? [];
		const responses = inspection
			.filter((inspection) => inspection.schema !== undefined)
			.map((inspection) => ({
				description: inspection.description,
				label: inspection.label ?? response.statusCode,
				schema: inspection.schema ?? true,
				type: inspection.type ?? "object",
			}));
		const contentTypes = inspection.map(
			(inspection) => inspection.contentType ?? response.statusCode,
		);

		const responseEnum = collectEnumsFromPathResponses(
			responses,
			getResponseStatusTypeName(responseName, response.statusCode),
			[...operationSourcePath, "responses", response.sourceStatusCode],
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
