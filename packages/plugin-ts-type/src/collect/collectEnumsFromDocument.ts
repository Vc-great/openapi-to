import type { EnumItem } from '@/EnumRegistry.ts'
import type { ComponentsParameters, ComponentsSchema, ParameterObjectWithRef } from '@openapi-to/core'
import { isBoolean, isPlainObject, lowerFirst, upperFirst } from 'lodash-es'
import type { MediaTypeObject, SchemaObject } from 'oas/types'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
type Reference = OpenAPIV3.ReferenceObject

export const collectEnumsFromPathParameters = (parameters: ParameterObjectWithRef[], operationName: string): EnumItem[] => {
  return parameters.flatMap((parameter) => {
    const schema = parameter.schema || {}
    if ('$ref' in schema) return []
    const name = operationName + upperFirst(parameter.name)
    return collectEnumsFromSchema(schema, name)
  })
}

export const collectEnumsFromPathRequestBodies = (
  requestBodies: MediaTypeObject | false | [string, MediaTypeObject, ...string[]],
  operationName: string,
): EnumItem[] => {
  if (requestBodies === false) return []
  const name = `${operationName}Body`
  if (Array.isArray(requestBodies)) {
    const [contentType, media] = requestBodies

    if (media?.schema) return collectEnumsFromSchema(media.schema, name)
  } else if (requestBodies) {
    if (requestBodies.schema) return collectEnumsFromSchema(requestBodies.schema, name)
  }
  return []
}

type Responses =
  | {
      description?: string
      label: string
      schema: SchemaObject
      type: string | string[]
    }[]
  | null
export const collectEnumsFromPathResponses = (responses: Responses, operationName: string): EnumItem[] => {
  if (!responses) {
    return []
  }

  const name = `${operationName}Response`
  return responses.flatMap((response) => collectEnumsFromSchema(response.schema, name))
}

export const collectEnumsFromComponentParameters = (parameters: ComponentsParameters): EnumItem[] => {
  const enums = []
  for (const [name, parameter] of Object.entries(parameters)) {
    if ('$ref' in parameter) continue
    if (parameter.schema) enums.push(...collectEnumsFromSchema(parameter.schema, name))
  }
  return enums
}

export const collectEnumsFromComponentRequestBody = (rb: OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject | Reference, name: string): EnumItem[] => {
  if ('$ref' in rb) return []
  const enums = []
  for (const contentType in rb.content) {
    const media = rb.content[contentType]
    if (media?.schema) enums.push(...collectEnumsFromSchema(media.schema, name))
  }
  return enums
}

export const collectEnumsFromComponentSchema = (schema: ComponentsSchema, name: string): EnumItem[] => {
  if ('$ref' in schema) return []
  return collectEnumsFromSchema(schema, name)
}

export function collectEnumsFromSchema(schema: ComponentsSchema, contextName: string, enums: EnumItem[] = []): EnumItem[] {
  if (!schema || typeof schema !== 'object') return enums
  if ('$ref' in schema) return enums

  if (schema.type === 'string' && Array.isArray(schema.enum)) {
    const enumName = `${contextName}`

    enums.push({
      name: enumName,
      enumValue: schema.enum,
      description: schema.description,
    })
    return enums
  }

  if (schema.type === 'object' && schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      collectEnumsFromSchema(propSchema, `${lowerFirst(contextName)}${upperFirst(propName)}`, enums)
    }
  }

  for (const key of ['allOf', 'anyOf', 'oneOf']) {
    const arr = (schema as any)[key]
    if (Array.isArray(arr)) {
      arr.forEach((item, idx) => collectEnumsFromSchema(item, `${contextName}_${key}_${idx}`, enums))
    }
  }

  // array.items
  if (schema.type === 'array' && schema.items && typeof schema.items === 'object') {
    const items = schema.items
    if ('$ref' in items) return enums

    if (isPlainObject(items)) {
      return collectEnumsFromSchema(items as ComponentsSchema, contextName, enums)
    }

    if (Array.isArray(items)) {
      items.forEach((item) => !isBoolean(item) && collectEnumsFromSchema(item as ComponentsSchema, contextName, enums))
    }
  }
  return enums
}
