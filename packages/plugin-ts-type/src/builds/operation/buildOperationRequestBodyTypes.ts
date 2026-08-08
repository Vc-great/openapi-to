import { getRequestBodyTypeName } from '@/templates/operationTypeNameTemplate.ts'
import { requestBodyTemplate } from '@/templates/requestBodyTemplate.ts'
import type { InlineEnumSourcePath, InlineEnumSymbolResolver } from '@/utils/inlineEnumNaming.ts'
import type { OperationWrapper, ReferenceObject } from '@openapi-to/core'
import { get, isArray, isBoolean } from 'lodash-es'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { InterfaceDeclarationStructure, TypeAliasDeclarationStructure } from 'ts-morph'

type MediaTypeObject = OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject

export function buildOperationRequestBodyTypes(
  operation: OperationWrapper,
  inlineEnumSymbols?: InlineEnumSymbolResolver,
): InterfaceDeclarationStructure | TypeAliasDeclarationStructure | undefined {
  const bodyDataName = getRequestBodyTypeName(operation.accessor.operationName)

  // 获取请求体 schema
  const bodySchema = getRequestBodySchema(operation)

  if (!bodySchema) {
    return undefined
  }

  return requestBodyTemplate(bodyDataName, bodySchema.body, inlineEnumSymbols, bodySchema.sourcePath)
}

// ---------------- 辅助函数 ----------------

function getRequestBodySchema(
  operation: OperationWrapper,
): { body: MediaTypeObject | ReferenceObject; sourcePath: InlineEnumSourcePath } | null {
  const operationSourcePath = ['paths', operation.path, operation.method] as const
  const requestBody = operation.accessor.operation.schema.requestBody
  // 处理引用类型 (operation.getRequestBody() 不能获取到引用类型)
  if (requestBody && '$ref' in requestBody && requestBody.$ref) {
    return { body: requestBody, sourcePath: [...operationSourcePath, 'requestBody'] }
  }

  const mediaType = operation.accessor.operation.getRequestBody()

  // 处理不同的结构
  if (mediaType && !isBoolean(mediaType) && !isArray(mediaType)) {
    return { body: mediaType, sourcePath: [...operationSourcePath, 'requestBody', 'schema'] }
  }

  if (Array.isArray(mediaType)) {
    const body = get(mediaType, '[1]', null)
    const contentType = get(mediaType, '[0]', '')
    return body
      ? {
          body,
          sourcePath: [...operationSourcePath, 'requestBody', 'content', contentType, 'schema'],
        }
      : null
  }

  return null
}
