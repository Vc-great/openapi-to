import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'
import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { getResponseErrorTypeName } from '@/templates/operationTypeNameTemplate.ts'

import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getRefAlias } from '@openapi-to/core/utils'
import { isEmpty, lowerFirst, upperFirst } from 'lodash-es'
import {
  type JSDocStructure,
  type OptionalKind,
  type StatementStructures,
  StructureKind,
  VariableDeclarationKind,
  type VariableStatementStructure,
} from 'ts-morph'
import type { JsonResponseObject } from '../types.ts'

export function operationResponseTemplate({ code, jsonSchema }: JsonResponseObject, operationName: string): StatementStructures {
  const isError = /^[3-5]\d{2}$/.test(code)
  const suffix = isError ? code : ''
  const typeName = `${operationName}${suffix}`
  const schema = jsonSchema?.schema

  const docs = jsDocTemplateFromSchema(jsonSchema?.description)

  if (!schema) {
    return createVariable(typeName, 'z.unknown()', docs)
  }

  if (schema.$ref) {
    const refType = `${lowerFirst(getRefAlias(schema.$ref))}Schema`
    return createVariable(typeName, refType, docs)
  }

  if (schema.type === 'object' && schema.properties) {
    const propertiesString = buildSchemaPropertiesTypes(schema, operationName)
    const docs = jsDocTemplateFromSchema(schema.description, schema)

    return createVariable(typeName, propertiesString, docs)
  }

  const baseName = `${operationName}${upperFirst(jsonSchema?.label || '')}`
  const aliasedType = schemaTemplate(schema, baseName)
  const zodHead = isEmpty(schema.enum) ? 'z' : ''
  return createVariable(typeName, zodHead + aliasedType, docs)
}

// ---------------- Helper: TypeAlias 构建 ----------------

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

// ---------------- Helper: 错误类型联合 ----------------

export function buildResponseErrorSchema(errorCodes: string[], operationName: string, responseObjects: JsonResponseObject[]): VariableStatementStructure {
  const relevantErrorTypes = errorCodes.filter((code) => responseObjects.some((res) => res.code === code)).map((code) => `${operationName}Response${code}`)

  return {
    kind: StructureKind.VariableStatement,
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    docs: [],
    declarations: [
      {
        name: getResponseErrorTypeName(operationName),

        initializer: relevantErrorTypes.length > 0 ? `z.union([${relevantErrorTypes.map((x) => x)}])` : 'z.unknown()',
      },
    ],
  }
}

// ---------------- Helper: 无成功响应时 fallback ----------------

export function buildDefaultSuccessSchema(name: string): VariableStatementStructure {
  return {
    kind: StructureKind.VariableStatement,
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    docs: [],
    declarations: [
      {
        name,
        initializer: 'z.unknown()',
      },
    ],
  }
}
