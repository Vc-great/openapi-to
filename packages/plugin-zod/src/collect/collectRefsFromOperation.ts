import type { OperationWrapper } from "@openapi-to/core";
import {
	collectRefsFromOperationParameter,
	collectRefsFromOperationRequestBody,
	collectRefsFromOperationResponse,
} from "@/collect/collectRefsFromDocument.ts";

export function collectRefsFromOperation(
	operation: OperationWrapper,
): string[] {
	// 收集响应中的引用

	const oasOperation = operation.accessor.operation;

	return [
		...new Set([
			...collectRefsFromOperationParameter([
				...operation.accessor.pathParameters,
				...operation.accessor.queryParameters,
				...operation.accessor.headerParameters,
				...operation.accessor.cookieParameters,
			]),
			...collectRefsFromOperationRequestBody(oasOperation),
			...collectRefsFromOperationResponse(oasOperation),
		]),
	];
}
