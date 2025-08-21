import type { OperationWrapper } from "@openapi-to/core";
import { StructureKind, type TypeAliasDeclarationStructure } from "ts-morph";
import type { RequiredPluginConfig } from "../types.ts";

export function buildQueryGenericType(
	operation: OperationWrapper,
	pluginConfig: RequiredPluginConfig,
): TypeAliasDeclarationStructure[] {
	const dataKey = operation.accessor?.dataReturnType.find(
		(item) => item === pluginConfig.dataReturnType,
	);
  const typeKey = `${dataKey ? `['${dataKey}']` : ""}`
	return [
		{
			leadingTrivia: "\n",
			kind: StructureKind.TypeAlias,
			name: "TData",
			docs: [
				"the final transformed data type after `select` (or other transforms); this is what components receive.",
			],
			type:
				`${operation.accessor.operationTSType?.responseSuccess}${typeKey}` ||
				"",
		},
		{
			leadingTrivia: "\n",
			kind: StructureKind.TypeAlias,
			name: "TQueryData",
			docs: [
				"the type of data actually stored in the cache before transformation.",
			],
			type:
				`${operation.accessor.operationTSType?.responseSuccess}${typeKey}` ||
				"",
		},
		{
			leadingTrivia: "\n",
			kind: StructureKind.TypeAlias,
			name: "TQueryFnData",
			docs: [
				"the raw data type returned directly from your `queryFn` (e.g. a network response).",
			],
			type:
				`${operation.accessor.operationTSType?.responseSuccess}${typeKey}` ||
				"",
		},
	];
}

// the optional context type passed into the query observer (e.g. for context-aware retries or caching).
