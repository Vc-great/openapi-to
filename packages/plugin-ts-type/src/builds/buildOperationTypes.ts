import {
	buildCookieParamsTypes,
	buildHeaderParamsTypes,
	buildOperationRequestBodyTypes,
	buildPathParamsTypes,
	buildQueryParamsTypes,
} from "@/builds/operation";
import type { OperationWrapper } from "@openapi-to/core";
import type { StatementStructures } from "ts-morph";
import { buildJsonResponseTypes } from "./operation";

export function buildOperationTypes(
	operation: OperationWrapper,
): StatementStructures[] {
	const requestBodyTypes = buildOperationRequestBodyTypes(operation);
	const queryParamsTypes = buildQueryParamsTypes(operation);
	const pathParamsTypes = buildPathParamsTypes(operation);
	const headerParamsTypes = buildHeaderParamsTypes(operation);
	const cookieParamsTypes = buildCookieParamsTypes(operation);
	return [
		...(pathParamsTypes ? [pathParamsTypes] : []),
		...(queryParamsTypes ? [queryParamsTypes] : []),
		...(headerParamsTypes ? [headerParamsTypes] : []),
		...(cookieParamsTypes ? [cookieParamsTypes] : []),
		...(requestBodyTypes ? [requestBodyTypes] : []),
		...buildJsonResponseTypes(operation),
	];
}
