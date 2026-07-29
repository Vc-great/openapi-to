import {
	buildCookieParamsSchemas,
	buildHeaderParamsSchemas,
	buildOperationRequestBodyTypes,
	buildPathParamsTypes,
	buildQueryParamsSchemas,
} from "@/builds/operation";
import type { OperationWrapper } from "@openapi-to/core";
import type { StatementStructures } from "ts-morph";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";
import { buildJsonResponseTypes } from "./operation";

export function buildOperationTypes(
	operation: OperationWrapper,
	options: SchemaRenderOptions = {},
): StatementStructures[] {
	const requestBodyTypes = buildOperationRequestBodyTypes(operation, options);
	const queryParamsTypes = buildQueryParamsSchemas(operation, options);
	const pathParamsTypes = buildPathParamsTypes(operation, options);
	const headerParamsTypes = buildHeaderParamsSchemas(operation, options);
	const cookieParamsTypes = buildCookieParamsSchemas(operation, options);
	return [
		...(pathParamsTypes ? [pathParamsTypes] : []),
		...(queryParamsTypes ? [queryParamsTypes] : []),
		...(headerParamsTypes ? [headerParamsTypes] : []),
		...(cookieParamsTypes ? [cookieParamsTypes] : []),
		...(requestBodyTypes ? [requestBodyTypes] : []),
		...buildJsonResponseTypes(operation, options),
	];
}
