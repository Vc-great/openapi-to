import type { MediaTypeObject, ReferenceObject } from '@openapi-to/core'

import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import { isBoolean, isEmpty } from 'lodash-es'

import { type InterfaceDeclarationStructure, type JSDocStructure, type OptionalKind, StructureKind, type TypeAliasDeclarationStructure } from 'ts-morph'

type RequestBody = MediaTypeObject | ReferenceObject

export function requestBodyTemplate(requestName: string, requestBody: RequestBody): InterfaceDeclarationStructure | TypeAliasDeclarationStructure | undefined {
  if ('$ref' in requestBody && requestBody.$ref) {
    const refType = getUpperFirstRefAlias(requestBody.$ref)
    return createTypeAlias(requestName, refType, [])
  }
  const schema = 'schema' in requestBody ? requestBody.schema : undefined
  if (schema === undefined) {
    return createTypeAlias(requestName, 'unknown', [])
  }
  const $ref = typeof schema === 'object' && schema !== null && '$ref' in schema ? schema.$ref : undefined
  if ($ref) {
    return createTypeAlias(requestName, getUpperFirstRefAlias($ref), [])
  }
  if (isBoolean(schema) || isEmpty(schema)) {
    return createTypeAlias(requestName, schemaTemplate(schema, requestName), [])
  }

  // 创建文档注释
  const docs: OptionalKind<JSDocStructure>[] =
    !('$ref' in schema) && schema.description ? [{ tags: [{ tagName: 'description', text: schema.description }] }] : []

  // 处理数组类型
  if (!('$ref' in schema) && schema.type === 'array') {
    const type = schemaTemplate(schema, requestName)
    return createTypeAlias(requestName, type, docs)
  }

  // 处理二进制文件类型
  if (!('$ref' in schema) && schema.type === 'string' && schema.format === 'binary') {
    return createTypeAlias(requestName, 'Blob', docs)
  }

  // 处理对象类型（默认情况）
  return {
    kind: StructureKind.Interface,
    name: requestName,
    isExported: true,
    docs,
    properties: buildSchemaPropertiesTypes(schema, requestName) || [],
  }
}

function createTypeAlias(name: string, type: string, docs?: OptionalKind<JSDocStructure>[]): TypeAliasDeclarationStructure {
  return {
    kind: StructureKind.TypeAlias,
    name,
    type,
    isExported: true,
    docs,
  }
}
