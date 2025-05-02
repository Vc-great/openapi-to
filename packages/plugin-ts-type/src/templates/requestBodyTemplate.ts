import type { MediaTypeObject, ReferenceObject } from '@openapi-to/core'

import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import { isBoolean, isEmpty } from 'lodash-es'

import { type InterfaceDeclarationStructure, type JSDocStructure, type OptionalKind, StructureKind, type TypeAliasDeclarationStructure } from 'ts-morph'

type RequestBody = MediaTypeObject | ReferenceObject

export function requestBodyTemplate(requestName: string, requestBody: RequestBody): InterfaceDeclarationStructure | TypeAliasDeclarationStructure | undefined {
  const schema = 'schema' in requestBody && requestBody.schema
  const $ref = '$ref' in requestBody ? requestBody.$ref : schema && '$ref' in schema && schema.$ref

  // 处理引用类型
  if ($ref) {
    const refType = getUpperFirstRefAlias($ref)
    return createTypeAlias(requestName, refType, [])
  }
  if (isBoolean(schema) || isEmpty(schema)) {
    return undefined
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
