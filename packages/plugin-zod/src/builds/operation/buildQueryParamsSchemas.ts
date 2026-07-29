import { createVariable } from "@/templates/operationResponseTemplate.ts";
import { getQueryParamsTypeName } from "@/templates/operationTypeNameTemplate.ts";

import { generateParameterSchema } from "@/utils/generateParameterSchema.ts";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";

import type {
	OperationWrapper,
	ParameterObjectWithRef,
} from "@openapi-to/core";

export function buildQueryParamsSchemas(
	operation: OperationWrapper,
	options?: SchemaRenderOptions,
) {
	const queryParamsName = getQueryParamsTypeName(
		operation.accessor.operationName,
	);

	const queryParameters: ParameterObjectWithRef[] =
		operation.accessor.queryParameters;

	if (queryParameters.length === 0) {
		return;
	}

	const querySchema = options
		? generateParameterSchema(
				queryParameters,
				operation.accessor.operationName,
				options,
			)
		: generateParameterSchema(
				queryParameters,
				operation.accessor.operationName,
			);

	return createVariable(queryParamsName, querySchema, []);
}
