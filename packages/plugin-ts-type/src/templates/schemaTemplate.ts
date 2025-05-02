import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'

import { enumRegistry } from '@/EnumRegistry.ts'
import type { SchemaObjectAndJSONSchema } from '@/types.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import { generateObjectType } from '@openapi-to/core/utils'

import type { Schema } from '@openapi-to/core'
import { isBoolean, isUndefined, upperFirst } from 'lodash-es'
import { type SchemaObject, isRef } from 'oas/types'

export function schemaTemplate(schema: Schema, propertyName: string, parentName?: string): string {
  if (isBoolean(schema) || isUndefined(schema)) {
    return 'unknown'
  }

  // 引用类型
  if (isRef(schema)) {
    return refType(schema)
  }

  // 枚举类型
  if (schema.enum && schema.enum.length > 0) {
    return `${upperFirst(parentName)}${upperFirst(propertyName)}EnumValue`
  }

  // 合并类型 oneOf, anyOf, allOf
  if (schema.oneOf) {
    return unionType(schema, propertyName, `${upperFirst(parentName)}${propertyName}`)
  }
  if (schema.anyOf) {
    return unionType(schema, propertyName, `${upperFirst(parentName)}${propertyName}`)
  }
  if (schema.allOf) {
    return intersectionType(schema, propertyName, `${upperFirst(parentName)}${propertyName}`)
  }

  // 普通类型
  const baseType = resolveBaseType(schema, propertyName, `${upperFirst(parentName)}${propertyName}`)

  // 处理 nullable
  if ('nullable' in schema && isBoolean(schema.nullable)) {
    return `${baseType} | null`
  }

  return baseType
}

// 处理引用
function refType(schema: { $ref: string }): string {
  return `${getUpperFirstRefAlias(schema.$ref)}`
}

// union: oneOf / anyOf
function unionType(schemas: SchemaObjectAndJSONSchema, propertyName: string, parentName: string): string {
  if (('oneOf' in schemas && schemas.oneOf) || ('anyOf' in schemas && schemas.anyOf)) {
    const types = [...(schemas.oneOf ? schemas.oneOf : []), ...(schemas.anyOf ? schemas.anyOf : [])].map((s) =>
      schemaTemplate(s as SchemaObject, propertyName, parentName),
    )
    return types.join(' | ')
  }
  throw new Error(`Expected oneOf type for property "${propertyName}", but got "${'type' in schemas ? schemas.type : schemas}"`)
}

// intersection: allOf
function intersectionType(schemas: SchemaObjectAndJSONSchema, propertyName: string, parentName: string): string {
  if (!('allOf' in schemas && schemas.allOf)) {
    throw new Error(`Expected allOf type for property "${propertyName}", but got "${'type' in schemas ? schemas.type : schemas}"`)
  }
  const types = schemas.allOf.map((s) => schemaTemplate(s as SchemaObject, propertyName, parentName))
  return types.join(' & ')
}

// 基础类型
export function resolveBaseType(schema: Schema, propertyName: string, parentName: string): string {
  if (isBoolean(schema)) {
    return 'unknown'
  }
  const type = 'type' in schema ? schema.type : ''
  const numberTypes = ['int32', 'int64', 'float', 'double', 'integer', 'long', 'number', 'int']
  const stringTypes = ['string', 'email', 'password', 'url', 'byte', 'binary']
  const dateTypes = ['Date', 'date', 'dateTime', 'date-time', 'datetime']

  switch (type) {
    case 'boolean':
      return 'boolean'

    case 'string':
      return stringTypes.includes(('format' in schema && schema.format) || '') ? 'string' : 'string'

    case 'number':
    case 'integer':
      return numberTypes.includes(('format' in schema && schema.format) || '') ? 'number' : 'number'

    case 'array':
      return resolveArrayType(schema, propertyName, parentName)

    case 'object':
      return resolveObjectType(schema, parentName)

    default:
      return 'unknown'
  }
}

// 数组类型
function resolveArrayType(schema: SchemaObjectAndJSONSchema, propertyName: string, parentName: string): string {
  if ('type' in schema && schema.type !== 'array') {
    throw new Error(`Expected array type for property "${propertyName}", but got "${schema.type}"`)
  }

  if (!('items' in schema && schema.items)) return 'unknown'

  const itemType = schemaTemplate(schema.items as SchemaObjectAndJSONSchema, propertyName, parentName)
  return `Array<${itemType}>`
}

// 对象类型
function resolveObjectType(schema: Schema, parentName: string): string {
  if (isBoolean(schema)) {
    return 'unknown'
  }
  if ('properties' in schema && schema.properties) {
    const properties = buildSchemaPropertiesTypes(schema as SchemaObject, parentName) || []
    return generateObjectType(properties)
  }
  return 'Record<string, unknown>'
}
