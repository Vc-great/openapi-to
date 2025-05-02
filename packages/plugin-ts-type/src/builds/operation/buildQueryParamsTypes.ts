import { createTypeAlias } from '@/templates/operationResponseTemplate.ts'
import { getQueryParamsTypeName } from '@/templates/operationTypeNameTemplate.ts'

import { generateParameterType } from '@/utils/generatePropertyType.ts'

import type { OperationWrapper, ParameterObjectWithRef } from '@openapi-to/core'

export function buildQueryParamsTypes(operation: OperationWrapper) {
  const queryParamsName = getQueryParamsTypeName(operation.accessor.operationName)

  const queryParameters: ParameterObjectWithRef[] = operation.accessor.queryParameters

  if (queryParameters.length === 0) {
    return
  }

  const queryTypes = generateParameterType(queryParameters, operation.accessor.operationName)

  return createTypeAlias(queryParamsName, queryTypes, [])
}
