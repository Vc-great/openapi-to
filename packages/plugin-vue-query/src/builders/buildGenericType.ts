import type {OperationWrapper} from "@openapi-to/core";
import {StructureKind, type TypeAliasDeclarationStructure} from "ts-morph";

export function buildQueryGenericType(operation: OperationWrapper):TypeAliasDeclarationStructure[] {
  return [
    {
      leadingTrivia:'\n',
      kind: StructureKind.TypeAlias,
      name: "TData",
      docs:['the final transformed data type after `select` (or other transforms); this is what components receive.'],
      type: operation.accessor.operationTSType?.responseSuccess||'',
    },
    {
      leadingTrivia:'\n',
      kind: StructureKind.TypeAlias,
      name: "TQueryData",
      docs:['the type of data actually stored in the cache before transformation.'],
      type: operation.accessor.operationTSType?.responseSuccess||'',
    },
    {
      leadingTrivia:'\n',
      kind: StructureKind.TypeAlias,
      name: "TQueryFnData",
      docs:['the raw data type returned directly from your `queryFn` (e.g. a network response).'],
      type: operation.accessor.operationTSType?.responseSuccess||'',
    },
  ]
}

// the optional context type passed into the query observer (e.g. for context-aware retries or caching).
