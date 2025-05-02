import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'
import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { createVariable } from '@/templates/operationResponseTemplate.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getRefAlias } from '@openapi-to/core/utils'
import { upperFirst } from 'lodash-es'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { type InterfaceDeclarationStructure, type JSDocStructure, type OptionalKind, StructureKind, type TypeAliasDeclarationStructure } from 'ts-morph'

type MediaTypeObject = OpenAPIV3_1.MediaTypeObject | OpenAPIV3.MediaTypeObject
export function componentResponseTemplate(
  mediaTypeObject: MediaTypeObject,
  responseName: string,
): TypeAliasDeclarationStructure | InterfaceDeclarationStructure {
  const schema = mediaTypeObject.schema

  if (schema && '$ref' in schema && schema.$ref) {
    const refType = `${upperFirst(getRefAlias(schema.$ref))}Model`
    return createVariable(responseName, refType, [])
  }

  if (!schema) {
    return createVariable(responseName, 'unknown', [])
  }

  const docs: OptionalKind<JSDocStructure>[] = 'description' in schema ? jsDocTemplateFromSchema(schema.description, schema) : []
  if (schema && 'type' in schema && schema.type === 'object' && schema.properties) {
    return {
      kind: StructureKind.Interface,
      name: responseName,
      isExported: true,
      docs,
      properties: buildSchemaPropertiesTypes(schema, responseName) ?? [],
    }
  }

  const aliasedType = schemaTemplate(schema, responseName)
  return createVariable(responseName, aliasedType, docs)
}
