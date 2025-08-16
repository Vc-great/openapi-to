import { schemaTemplate } from '@/templates/schemaTemplate.ts'

import { camelCase, isArray, isBoolean, isString, map, negate, pickBy, upperFirst } from 'lodash-es'

import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import type { SchemaObjectAndJSONSchema } from '@/types.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import type { SchemaObject } from 'oas/types'
import { isRef } from 'oas/types'
import type { OptionalKind, PropertySignatureStructure } from 'ts-morph'

type OptionalKindOfPropertySignatureStructure = OptionalKind<PropertySignatureStructure>
type SchemaProperties = SchemaObject['properties']
type SchemaPropertyValue = SchemaProperties[keyof SchemaProperties]
type SchemaPropertyValueExcludeRef = Exclude<SchemaProperties[keyof SchemaProperties], { $ref: string }>

export function buildSchemaPropertiesTypes(baseSchema: SchemaObject, schemaModelName: string): OptionalKindOfPropertySignatureStructure[] | undefined {
  const properties = baseSchema.properties ?? {}
  const requiredList = resolveRequiredList(baseSchema.required)

  const typeStatements: OptionalKindOfPropertySignatureStructure[] = map(properties, (schema, propertyName) => {
    if (isBoolean(schema)) {
      return
    }

    if (schema && '$ref' in schema && schema.$ref) {
      return {
        name: propertyName,
        type: getUpperFirstRefAlias(schema.$ref),
      }
    }

    if (!('$ref' in schema)) {
      const isRequired = requiredList.includes(propertyName)

      const typeString = schemaTemplate(schema, propertyName, schemaModelName) // resolvePropertyType(schema, propertyName)
      const propertyKey = propertyName + (isRequired ? '' : '?')

      return {
        name: propertyKey,
        type: typeString,
        //todo
        docs: jsDocTemplateFromSchema(schema.description, schema,propertyName),
      }
    }
  }).filter(Boolean)

  // 支持 additionalProperties: true | SchemaObject
  if (baseSchema.additionalProperties) {
    const additionalPropType = resolveAdditionalPropertiesType(baseSchema)
    typeStatements.push({
      name: '[key: string]',
      type: additionalPropType,
    })
  }

  return typeStatements.length ? typeStatements : undefined
}

// -------------------- Helper Methods --------------------

function resolveRequiredList(required: unknown): string[] {
  if (isBoolean(required)) return []
  if (isArray(required)) return required.filter(isString)
  return []
}

function formatEnumName(propertyName: string): string {
  return `${upperFirst(camelCase(propertyName))}Enum`
}

function resolvePropertyType(schema: SchemaPropertyValueExcludeRef, name: string): string {
  /*  if (isRef(schema)) {
    return getUpperFirstRefAlias(schema.$ref)
  }*/
  return schemaTemplate(schema, name)
}

function resolveAdditionalPropertiesType(schema: SchemaObjectAndJSONSchema): string {
  if (!('additionalProperties' in schema && schema.additionalProperties)) {
    throw new Error('additionalProperties is undefined')
  }
  const additional = schema.additionalProperties
  if (isBoolean(additional)) {
    return 'Record<string, unknown>'
  }

  if (isRef(additional)) {
    return `Record<string, ${getUpperFirstRefAlias(additional.$ref)}>`
  }

  //todo
  return `Record<string, ${schemaTemplate(additional, '')}>`
}
