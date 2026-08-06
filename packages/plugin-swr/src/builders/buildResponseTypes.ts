import type { OperationWrapper } from "@openapi-to/core";
import { isEmpty } from "lodash-es";
import type { PluginConfig } from "../types.ts";

export function buildResponseTypes(
	operation: OperationWrapper,
	pluginConfig?: PluginConfig,
): { data: string | undefined; error: string | undefined } {
	const responseSuccess = operation.accessor.operationTSType?.responseSuccess;
	const responseError = operation.accessor.operationTSType?.responseError;
	return {
		data: !isEmpty(
			pluginConfig?.responseConfigTypeImportDeclaration?.namedImports,
		)
			? `${pluginConfig?.responseConfigTypeImportDeclaration?.namedImports[0]}<${responseSuccess}>['data']`
			: responseSuccess,
		error: !isEmpty(
			pluginConfig?.responseErrorTypeImportDeclaration?.namedImports,
		)
			? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${responseError}>`
			: responseError,
	};
}
