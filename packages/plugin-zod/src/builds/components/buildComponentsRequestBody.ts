import { createVariable } from '@/templates/operationResponseTemplate.ts'
import { requestBodyTemplate } from '@/templates/requestBodyTemplate.ts'

import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'
import type { ReferenceObject, RequestBodyObject } from '@openapi-to/core'
import { head, lowerFirst, values } from 'lodash-es'
import type { VariableStatementStructure } from 'ts-morph'

export function buildComponentsRequestBody(requestName: string, requestBody: ReferenceObject | RequestBodyObject): VariableStatementStructure | undefined {
  const name = `${lowerFirst(requestName)}Schema`
  // 处理引用类型
  if (requestBody && '$ref' in requestBody && requestBody.$ref) {
    return createVariable(name, getlowerFirstRefAlias(requestBody.$ref), [])
  }

  if ('content' in requestBody) {
    const body = head(values(requestBody.content))
    if (!body) {
      return undefined
    }

    if (body.schema && '$ref' in body.schema) {
      const refType = getlowerFirstRefAlias(body.schema.$ref)
      return createVariable(name, refType, [])
    }

    // 数组类型且items有引用
    if (body.schema && 'type' in body.schema && body.schema.type === 'array' && body.schema.items && '$ref' in body.schema.items) {
      const refType = getlowerFirstRefAlias(body.schema.items.$ref)
      return createVariable(name, `${refType}`, [])
    }

    // 数组类型但items没有引用
    if (body.schema && 'type' in body.schema && body.schema.type === 'array' && body.schema.items) {
      return requestBodyTemplate(name, body)
    }
  }
}
