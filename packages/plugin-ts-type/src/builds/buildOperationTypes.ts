import {
	buildCookieParamsTypes,
	buildHeaderParamsTypes,
	buildOperationRequestBodyTypes,
	buildPathParamsTypes,
	buildQueryParamsTypes,
} from "@/builds/operation";
import type { OperationWrapper } from "@openapi-to/core";
import type { StatementStructures } from "ts-morph";
import type { InlineEnumSymbolResolver } from "@/utils/inlineEnumNaming.ts";
import { buildJsonResponseTypes } from "./operation";

export function buildOperationTypes(
	operation: OperationWrapper,
	inlineEnumSymbols?: InlineEnumSymbolResolver,
): StatementStructures[] {
	const requestBodyTypes = buildOperationRequestBodyTypes(
		operation,
		inlineEnumSymbols,
	);
	const queryParamsTypes = buildQueryParamsTypes(operation, inlineEnumSymbols);
	const pathParamsTypes = buildPathParamsTypes(operation, inlineEnumSymbols);
	const headerParamsTypes = buildHeaderParamsTypes(
		operation,
		inlineEnumSymbols,
	);
	const cookieParamsTypes = buildCookieParamsTypes(
		operation,
		inlineEnumSymbols,
	);
	return [
		...(pathParamsTypes ? [pathParamsTypes] : []),
		...(queryParamsTypes ? [queryParamsTypes] : []),
		...(headerParamsTypes ? [headerParamsTypes] : []),
		...(cookieParamsTypes ? [cookieParamsTypes] : []),
		...(requestBodyTypes ? [requestBodyTypes] : []),
		...buildJsonResponseTypes(operation, inlineEnumSymbols),
	];
}
