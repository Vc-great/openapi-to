import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { createVariable } from '@/templates/operationResponseTemplate.ts'
import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'
import type { ComponentsSchema } from '@openapi-to/core'
import { lowerFirst } from 'lodash-es'
import type { InterfaceDeclarationStructure, TypeAliasDeclarationStructure, VariableStatementStructure } from 'ts-morph'
import { buildSchemaPropertiesTypes } from './buildSchemaPropertiesTypes.ts'

export type SchemaDeclarationStructure = InterfaceDeclarationStructure | TypeAliasDeclarationStructure

export function buildSchemas(schemaName: string, schema: ComponentsSchema): VariableStatementStructure | undefined {
  const variableName = `${lowerFirst(schemaName)}Schema`
  if (typeof schema !== 'object' || schema === null) return undefined

  if ('$ref' in schema && schema.$ref) {
    const refSchemaName = getlowerFirstRefAlias(schema.$ref)

    return createVariable(variableName, `z.lazy(()=>${refSchemaName})`, [])
  }

  if ('type' in schema && schema.type === 'object' && schema.properties) {
    const PropertiesString = buildSchemaPropertiesTypes(schema, variableName)

    const docs = jsDocTemplateFromSchema(schema.description, schema)
    return createVariable(variableName, PropertiesString, docs)
  }

  return undefined
}
