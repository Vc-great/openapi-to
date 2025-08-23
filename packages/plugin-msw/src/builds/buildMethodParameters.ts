import type { OperationWrapper } from "@openapi-to/core";

import type { OptionalKind, ParameterDeclarationStructure } from "ts-morph";
import type { PluginConfig } from "../types.ts";

export function buildMethodParameters(
	operation: OperationWrapper,
	pluginConfig?: PluginConfig,
): OptionalKind<ParameterDeclarationStructure>[] {
	const dataParameters: OptionalKind<ParameterDeclarationStructure> = {
		name: "data",
		hasQuestionToken: operation.accessor.isQueryParametersOptional,
		type: operation.accessor.operationTSType?.responseSuccess,
		initializer:
			pluginConfig?.responseDefaultType === "faker"
				? operation.accessor.operationFaker?.responseSuccess
				: "",
	};

	return [dataParameters];
}
