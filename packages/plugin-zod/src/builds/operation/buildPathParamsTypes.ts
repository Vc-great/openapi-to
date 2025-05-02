import { createVariable } from '@/templates/operationResponseTemplate.ts'
import { getOperationPathParamsName } from '@/templates/operationTypeNameTemplate.ts'

import { generateParameterSchema } from '@/utils/generateParameterSchema.ts'
import type { OperationWrapper, ParameterObjectWithRef } from '@openapi-to/core'
import { isEmpty } from 'lodash-es'

export function buildPathParamsTypes(operation: OperationWrapper) {
  const pathParameterName = getOperationPathParamsName(operation.accessor.operationName)

  const pathParameters: ParameterObjectWithRef[] = operation.accessor.pathParameters

  if (isEmpty(pathParameters)) {
    return
  }

  // 构建路径参数的属性类型
  const pathSchemaString = generateParameterSchema(pathParameters, operation.accessor.operationName)

  return createVariable(pathParameterName, pathSchemaString, [])
}
