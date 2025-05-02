import { getRequestBodyTypeName } from '@/templates/operationTypeNameTemplate.ts'
import { requestBodyTemplate } from '@/templates/requestBodyTemplate.ts'
import type { OperationWrapper, ReferenceObject } from '@openapi-to/core'
import { get, isArray, isBoolean } from 'lodash-es'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { VariableStatementStructure } from 'ts-morph'

type MediaTypeObject = OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject

export function buildOperationRequestBodyTypes(operation: OperationWrapper): VariableStatementStructure | undefined {
  const bodyDataName = getRequestBodyTypeName(operation.accessor.operationName)

  // 获取请求体 schema
  const bodySchema = getRequestBodySchema(operation)

  if (!bodySchema) {
    return undefined
  }
  const a = requestBodyTemplate(bodyDataName, bodySchema)
  return requestBodyTemplate(bodyDataName, bodySchema)
}

// ---------------- 辅助函数 ----------------

function getRequestBodySchema(operation: OperationWrapper): MediaTypeObject | ReferenceObject | null {
  const requestBody = operation.accessor.operation.schema.requestBody
  // 处理引用类型 (operation.getRequestBody() 不能获取到引用类型)
  if (requestBody && '$ref' in requestBody && requestBody.$ref) {
    return requestBody
  }

  const mediaType = operation.accessor.operation.getRequestBody()

  // 处理不同的结构
  if (!isBoolean(mediaType) && !isArray(mediaType)) {
    return mediaType
  }

  if (Array.isArray(mediaType)) {
    return get(mediaType, '[1]', null)
  }

  return null
}
