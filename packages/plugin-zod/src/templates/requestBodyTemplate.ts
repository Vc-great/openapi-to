import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'
import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'
import type { MediaTypeObject, ReferenceObject } from '@openapi-to/core'
import { isBoolean, isEmpty } from 'lodash-es'

import { type JSDocStructure, type OptionalKind, StructureKind, VariableDeclarationKind, type VariableStatementStructure } from 'ts-morph'

type RequestBody = MediaTypeObject | ReferenceObject

export function requestBodyTemplate(requestName: string, requestBody: RequestBody): VariableStatementStructure | undefined {
  const schema = 'schema' in requestBody && requestBody.schema
  const $ref = '$ref' in requestBody ? requestBody.$ref : schema && '$ref' in schema && schema.$ref

  // 处理引用类型
  if ($ref) {
    const refSchemaName = getlowerFirstRefAlias($ref)

    return createVariable(requestName, refSchemaName, [])
  }
  if (isBoolean(schema) || isEmpty(schema)) {
    return undefined
  }

  // 创建文档注释
  const docs: OptionalKind<JSDocStructure>[] = jsDocTemplateFromSchema(('description' in schema && schema.description) || '', schema)

  // 处理数组类型
  if (!('$ref' in schema) && schema.type === 'array') {
    const type = schemaTemplate(schema, requestName)
    return createVariable(requestName, type, docs)
  }

  // 处理二进制文件类型
  if (!('$ref' in schema) && schema.type === 'string' && schema.format === 'binary') {
    return createVariable(requestName, 'Blob', docs)
  }

  // 处理对象类型（默认情况）
  /* return {
    kind: StructureKind.Interface,
    name: requestName,
    isExported: true,
    docs,
    properties: buildSchemaPropertiesTypes(schema, requestName) || [],
  }*/

  const PropertiesString = buildSchemaPropertiesTypes(schema, requestName)

  return createVariable(requestName, PropertiesString, docs)
}

export function createVariable(name: string, initializer: string, docs?: OptionalKind<JSDocStructure>[]): VariableStatementStructure {
  return {
    kind: StructureKind.VariableStatement,
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    docs,
    declarations: [
      {
        name,
        initializer,
      },
    ],
  }
}
