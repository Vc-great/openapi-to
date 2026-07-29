import type { OperationWrapper } from "@openapi-to/core";
import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { getCookieParamsTypeName } from "@/templates/operationTypeNameTemplate.ts";
import { generateParameterType } from "@/utils/generatePropertyType.ts";

export function buildCookieParamsTypes(operation: OperationWrapper) {
	const parameters = operation.accessor.cookieParameters;
	if (parameters.length === 0) return;
	return createTypeAlias(
		getCookieParamsTypeName(operation.accessor.operationName),
		generateParameterType(parameters, operation.accessor.operationName),
		[],
	);
}
