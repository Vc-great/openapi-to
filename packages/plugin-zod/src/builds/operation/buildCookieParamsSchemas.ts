import type { OperationWrapper } from "@openapi-to/core";
import { createVariable } from "@/templates/operationResponseTemplate.ts";
import { getCookieParamsTypeName } from "@/templates/operationTypeNameTemplate.ts";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";
import { generateParameterSchema } from "@/utils/generateParameterSchema.ts";

export function buildCookieParamsSchemas(
	operation: OperationWrapper,
	options: SchemaRenderOptions = {},
) {
	const parameters = operation.accessor.cookieParameters;
	if (parameters.length === 0) return;
	return createVariable(
		getCookieParamsTypeName(operation.accessor.operationName),
		generateParameterSchema(
			parameters,
			operation.accessor.operationName,
			options,
		),
		[],
	);
}
