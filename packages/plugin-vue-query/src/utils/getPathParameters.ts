import type {OperationWrapper} from "@openapi-to/core";
import {camelCase} from "lodash-es";
import type {OptionalKind, ParameterDeclarationStructure} from "ts-morph";

export  function getPathParameters(operation: OperationWrapper) {
  const pathParameters: OptionalKind<ParameterDeclarationStructure>[] = operation.accessor.pathParameters.map((item) => {
    return {
      name: camelCase(item.name),
      type: `MaybeRefOrGetter<${operation.accessor.operationTSType?.pathParams || ''}['${camelCase(item.name)}']>`,
    }
  })
 return pathParameters
}
