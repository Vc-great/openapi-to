import { buildSchemaPropertiesTypes } from '@/builds/components/buildSchemaPropertiesTypes.ts'
import type { SchemaObjectAndJSONSchema } from '@/types.ts'
import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'

import type { Schema } from '@openapi-to/core'
import { isBoolean, isUndefined, upperFirst } from 'lodash-es'
import { type SchemaObject, isRef } from 'oas/types'

export function schemaTemplate(schema: Schema, propertyName: string, parentName?: string): string {
  if (isBoolean(schema) || isUndefined(schema)) {
    return '.unknown()'
  }

  // 引用类型
  if (isRef(schema)) {
    return refType(schema)
  }

  // 枚举类型
  if (schema.enum && schema.enum.length > 0) {
    return `z.enum([${schema.enum.map((x) => `'${x}'`)}])`
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
  const baseType = resolveBaseSchema(schema, propertyName, `${upperFirst(parentName)}${propertyName}`)

  // 处理 nullable
  if ('nullable' in schema && isBoolean(schema.nullable)) {
    return `${baseType}.nullable()`
  }

  return baseType
}

// 处理引用
function refType(schema: { $ref: string }): string {
  return `${getlowerFirstRefAlias(schema.$ref)}`
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
export function resolveBaseSchema(schema: Schema, propertyName: string, parentName: string): string {
  if (isBoolean(schema)) {
    return '.unknown()'
  }
  const type = 'type' in schema ? schema.type : ''

  switch (type) {
    case 'boolean':
      return '.boolean()'

    case 'string':
      //todo
      return formatterString(schema)

    case 'number':
    case 'integer':
      return formatterNumber(schema)

    case 'array':
      return resolveArraySchema(schema, propertyName, parentName)

    case 'object':
      return resolveObjectSchema(schema, parentName)

    default:
      return '.unknown()'
  }
}

// 数组类型
function resolveArraySchema(schema: SchemaObjectAndJSONSchema, propertyName: string, parentName: string): string {
  if ('type' in schema && schema.type !== 'array') {
    throw new Error(`Expected array type for property "${propertyName}", but got "${schema.type}"`)
  }

  if (!('items' in schema && schema.items)) return '.unknown()'

  const itemType = schemaTemplate(schema.items as SchemaObjectAndJSONSchema, propertyName, parentName)
  const hasRef = !isBoolean(schema.items) && schema.items && '$ref' in schema.items
  const hasEnum = !isBoolean(schema.items) && schema.items && 'enum' in schema.items && schema.items.enum
  return `.array(${hasRef || hasEnum ? '' : 'z'}${itemType})`
}

// 对象类型
function resolveObjectSchema(schema: Schema, parentName: string): string {
  if (isBoolean(schema)) {
    return '.unknown()'
  }
  if ('properties' in schema && schema.properties) {
    return buildSchemaPropertiesTypes(schema as SchemaObject, parentName)
  }
  return '.record(z.string(), z.unknown())'
}

function formatterString(schema: Schema) {
  if (!isBoolean(schema) && schema && 'format' in schema) {
    switch (schema.format) {
      case 'email':
        return '.string().email()'
      case 'uri':
      case 'url':
        return '.string().url()'
      case 'uuid':
        return '.string().uuid()'
      case 'date':
      case 'date-time':
      case 'datetime':
        return '.string().datetime()'
      case 'byte':
        return '.string().regex(/^[A-Za-z0-9+/=]*$/)' // base64
      case 'binary':
        return '.string()'
      case 'password':
        return '.string().min(1)'
      default:
        return '.string()'
    }
  }
  return '.string()'
}

function formatterNumber(schema: Schema) {
  let baseType = '.number()'

  // 处理整数类型
  if (
    (!isBoolean(schema) && 'type' in schema && schema.type === 'integer') ||
    (!isBoolean(schema) && 'format' in schema && ['int32', 'int64', 'integer', 'long', 'int'].includes(schema.format || ''))
  ) {
    baseType = '.number().int()'
  }

  // 添加范围限制
  if (!isBoolean(schema)) {
    if ('minimum' in schema && schema.minimum !== undefined) {
      baseType += `.min(${schema.minimum})`
    }
    if ('maximum' in schema && schema.maximum !== undefined) {
      baseType += `.max(${schema.maximum})`
    }
    if ('exclusiveMinimum' in schema && schema.exclusiveMinimum === true && 'minimum' in schema) {
      baseType += `.gt(${schema.minimum})`
    }
    if ('exclusiveMaximum' in schema && schema.exclusiveMaximum === true && 'maximum' in schema) {
      baseType += `.lt(${schema.maximum})`
    }
  }

  return baseType
}
