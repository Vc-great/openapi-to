import type { OperationWrapper } from "@openapi-to/core";
import { createVariable } from "@/templates/operationResponseTemplate.ts";
import { getHeaderParamsTypeName } from "@/templates/operationTypeNameTemplate.ts";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";
import { generateParameterSchema } from "@/utils/generateParameterSchema.ts";

export function buildHeaderParamsSchemas(
	operation: OperationWrapper,
	options: SchemaRenderOptions = {},
) {
	const parameters = operation.accessor.headerParameters;
	if (parameters.length === 0) return;
	return createVariable(
		getHeaderParamsTypeName(operation.accessor.operationName),
		generateParameterSchema(
			parameters,
			operation.accessor.operationName,
			options,
		),
		[],
	);
}
