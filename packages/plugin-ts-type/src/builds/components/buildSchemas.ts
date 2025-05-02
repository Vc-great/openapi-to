import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import type { ComponentsSchema } from '@openapi-to/core'
import { upperFirst } from 'lodash-es'
import { type InterfaceDeclarationStructure, type JSDocStructure, type OptionalKind, StructureKind, type TypeAliasDeclarationStructure } from 'ts-morph'
import { buildSchemaPropertiesTypes } from './buildSchemaPropertiesTypes.ts'

export type SchemaDeclarationStructure = InterfaceDeclarationStructure | TypeAliasDeclarationStructure

export function buildSchemas(schemaName: string, schema: ComponentsSchema): SchemaDeclarationStructure[] {
  const statements: SchemaDeclarationStructure[] = []
  const typeName = `${upperFirst(schemaName)}Model`
  if (typeof schema !== 'object' || schema === null) return []

  if ('$ref' in schema && schema.$ref) {
    const refType = getUpperFirstRefAlias(schema.$ref)

    statements.push(createTypeAlias(typeName, refType, []))
    return statements
  }

  if ('type' in schema && schema.type === 'object' && schema.properties) {
    statements.push({
      kind: StructureKind.Interface,
      name: typeName,
      isExported: true,
      docs: jsDocTemplateFromSchema(schema.description, schema),
      properties: buildSchemaPropertiesTypes(schema, schemaName) || [],
    })
    return statements
  }

  /*  const typeValue = schemaTemplate(schema, schemaName)
  statements.push(createTypeAlias(typeName, typeValue, jsDocTemplateFromSchema(schema.description, schema)))*/

  return statements
}

function createTypeAlias(name: string, type: string, docs?: OptionalKind<JSDocStructure>[]): TypeAliasDeclarationStructure {
  return {
    kind: StructureKind.TypeAlias,
    name,
    isExported: true,
    type,
    docs,
  }
}

function getSchemaJSDocs(schema: any): OptionalKind<JSDocStructure>[] | undefined {
  if (!schema.description) return undefined

  return [
    {
      tags: [
        {
          leadingTrivia: '\n',
          tagName: 'description',
          text: schema.description,
        },
      ],
    },
  ]
}
