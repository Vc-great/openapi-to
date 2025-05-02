import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'
import { getResponseErrorTypeName } from '@/templates/operationTypeNameTemplate.ts'

import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getRefAlias } from '@openapi-to/core/utils'
import { upperFirst } from 'lodash-es'
import { type JSDocStructure, type OptionalKind, type StatementStructures, StructureKind, type TypeAliasDeclarationStructure } from 'ts-morph'
import type { JsonResponseObject } from '../types.ts'

export function operationResponseTemplate({ code, jsonSchema }: JsonResponseObject, operationName: string): StatementStructures {
  const isError = /^[3-5]\d{2}$/.test(code)
  const suffix = isError ? code : ''
  const typeName = `${operationName}${suffix}`
  const schema = jsonSchema?.schema

  const docs: OptionalKind<JSDocStructure>[] = jsonSchema?.description
    ? [{ tags: [{ leadingTrivia: '\n', tagName: 'description', text: jsonSchema.description }] }]
    : []

  if (!schema) {
    return createTypeAlias(typeName, 'unknown', docs)
  }

  if (schema.$ref) {
    const refType = `${upperFirst(getRefAlias(schema.$ref))}Model`
    return createTypeAlias(typeName, refType, docs)
  }

  if (schema.type === 'object' && schema.properties) {
    return {
      kind: StructureKind.Interface,
      name: typeName,
      isExported: true,
      docs,
      properties: buildSchemaPropertiesTypes(schema, operationName) ?? [],
    }
  }

  const baseName = `${operationName}${upperFirst(jsonSchema?.label || '')}`
  const aliasedType = schemaTemplate(schema, baseName)
  return createTypeAlias(typeName, aliasedType, docs)
}

// ---------------- Helper: TypeAlias 构建 ----------------

export function createTypeAlias(name: string, type: string, docs?: OptionalKind<JSDocStructure>[]): TypeAliasDeclarationStructure {
  return {
    kind: StructureKind.TypeAlias,
    name,
    isExported: true,
    type,
    docs,
  }
}

// ---------------- Helper: 错误类型联合 ----------------

export function buildResponseErrorType(errorCodes: string[], operationName: string, responseObjects: JsonResponseObject[]): TypeAliasDeclarationStructure {
  const relevantErrorTypes = errorCodes.filter((code) => responseObjects.some((res) => res.code === code)).map((code) => `${operationName}Response${code}`)

  return {
    kind: StructureKind.TypeAlias,
    name: getResponseErrorTypeName(operationName),
    isExported: true,
    type: relevantErrorTypes.length > 0 ? relevantErrorTypes.join(' | ') : 'unknown',
  }
}

// ---------------- Helper: 无成功响应时 fallback ----------------

export function buildDefaultSuccessType(name: string): TypeAliasDeclarationStructure {
  return {
    kind: StructureKind.TypeAlias,
    name,
    type: 'unknown',
    isExported: true,
  }
}
