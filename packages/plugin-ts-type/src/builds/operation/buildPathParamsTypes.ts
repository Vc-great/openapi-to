import { createTypeAlias } from '@/templates/operationResponseTemplate.ts'
import { getOperationPathParamsName } from '@/templates/operationTypeNameTemplate.ts'

import { generateParameterType } from '@/utils/generatePropertyType.ts'
import type { OperationWrapper, ParameterObjectWithRef } from '@openapi-to/core'
import { camelCase, isEmpty, upperFirst } from 'lodash-es'

export function buildPathParamsTypes(operation: OperationWrapper) {
  const pathParameterName = getOperationPathParamsName(operation.accessor.operationName)

  const pathParameters: ParameterObjectWithRef[] = operation.accessor.pathParameters

  if (isEmpty(pathParameters)) {
    return
  }

  // 构建路径参数的属性类型
  const pathTypes = generateParameterType(pathParameters, operation.accessor.operationName)

  return createTypeAlias(pathParameterName, pathTypes, [])
}
