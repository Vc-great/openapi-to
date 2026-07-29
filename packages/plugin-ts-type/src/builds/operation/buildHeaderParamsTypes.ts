import type { OperationWrapper } from "@openapi-to/core";
import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { getHeaderParamsTypeName } from "@/templates/operationTypeNameTemplate.ts";
import { generateParameterType } from "@/utils/generatePropertyType.ts";

export function buildHeaderParamsTypes(operation: OperationWrapper) {
	const parameters = operation.accessor.headerParameters;
	if (parameters.length === 0) return;
	return createTypeAlias(
		getHeaderParamsTypeName(operation.accessor.operationName),
		generateParameterType(parameters, operation.accessor.operationName),
		[],
	);
}
