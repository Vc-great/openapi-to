import type {OperationWrapper} from "@openapi-to/core";
import {StructureKind, type InterfaceDeclarationStructure, type TypeAliasDeclarationStructure} from "ts-morph";
import {getPathParameters} from "../utils/getPathParameters.ts";

export function buildTVariables(operation: OperationWrapper):(TypeAliasDeclarationStructure|InterfaceDeclarationStructure)[] {
  return [
    {
      leadingTrivia:'\n',
      kind: StructureKind.TypeAlias,
      name: "TData",
      docs:['the final transformed data type after `select` (or other transforms); this is what components receive.'],
      type: operation.accessor.operationTSType?.responseSuccess||'',
    },
    {
      kind:StructureKind.Interface,
      name:'TVariables',
      isExported:true,
      properties: [
        ...getPathParameters(operation).map(item=>{
          return {
            name: item.name,
            type: item.type,
            docs: [{ description: `Path parameter: ${item.name}` }],
          }
        }),
        operation.accessor.operationTSType?.body ? {
          name: "data",
          type: `MaybeRefOrGetter<${operation.accessor.operationTSType?.body}>`,
          docs: [{ description: "The data to be sent in the request body." }],
        } : null,
      ].filter(Boolean),
    }
  ]
}

