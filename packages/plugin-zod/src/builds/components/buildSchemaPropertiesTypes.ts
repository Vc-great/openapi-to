import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import type { SchemaObjectAndJSONSchema } from '@/types.ts'
import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'

import { camelCase, forEach, get, isArray, isBoolean, isEmpty, isString, keys, upperFirst } from 'lodash-es'
import type { SchemaObject } from 'oas/types'
import { isRef } from 'oas/types'
import { CodeBlockWriter, type JSDocStructure, type OptionalKind, type PropertySignatureStructure } from 'ts-morph'

type OptionalKindOfPropertySignatureStructure = OptionalKind<PropertySignatureStructure>
type SchemaProperties = SchemaObject['properties']
type SchemaPropertyValue = SchemaProperties[keyof SchemaProperties]
type SchemaPropertyValueExcludeRef = Exclude<SchemaProperties[keyof SchemaProperties], { $ref: string }>

export function buildSchemaPropertiesTypes(baseSchema: SchemaObject, schemaModelName: string): string {
  const properties = baseSchema.properties ?? {}
  const requiredList = resolveRequiredList(baseSchema.required)
  const hasProperties = Object.keys(properties).length > 0
  const hasAdditionalProperties = baseSchema.additionalProperties

  // 如果只有 additionalProperties 而没有 properties
  if (hasAdditionalProperties && !hasProperties) {
    const additionalPropType = resolveAdditionalPropertiesType(baseSchema)
    const writer = new CodeBlockWriter({ indentNumberOfSpaces: 4 })
    writeJSDoc(writer, jsDocTemplateFromSchema(baseSchema.description, baseSchema))
    writer.writeLine(`z.record(z.string(), ${additionalPropType})`)
    return writer.toString()
  }

  const writer = new CodeBlockWriter({ indentNumberOfSpaces: 4 })
  writer.newLine()
  forEach(keys(properties), (propertyName, idx) => {
    const schema = properties[propertyName]
    if (isBoolean(schema) || !schema) {
      return
    }

    const length = keys(properties).length - 1
    const comma = idx < length ? ',' : ''

    if (schema && '$ref' in schema && schema.$ref) {
      const isRequired = requiredList.includes(propertyName)
      writer.writeLine(`${propertyName}: z.lazy(()=>${getlowerFirstRefAlias(schema.$ref)})${isRequired ? '' : '.optional()'}${comma}`)
    }

    if (!('$ref' in schema)) {
      const isRequired = requiredList.includes(propertyName)

      const schemaString = schemaTemplate(schema, propertyName, schemaModelName)
      const a = jsDocTemplateFromSchema(schema.description, schema)

      writeJSDoc(writer, jsDocTemplateFromSchema(schema.description, schema))

      const zodHead = schema.enum && schema.enum.length > 0 ? '' : 'z'

      writer.writeLine(`${propertyName}: ${zodHead}${schemaString}${isRequired ? '' : '.optional()'}${comma}`)
    }
  })

  let result = `z.object({${writer.toString()}})`

  // 如果同时有 additionalProperties，使用 .and() 组合
  if (hasAdditionalProperties) {
    const additionalPropType = resolveAdditionalPropertiesType(baseSchema)
    result += `.and(z.record(z.string(), ${additionalPropType}))`
  }

  return result
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
  // 检查 additionalProperties 是否存在
  if (!('additionalProperties' in schema) || schema.additionalProperties === undefined) {
    throw new Error('additionalProperties is undefined')
  }

  const additional = schema.additionalProperties

  // 处理 additionalProperties 为 false 的情况（不允许额外属性）
  if (additional === false) {
    throw new Error('additionalProperties is false, no additional properties allowed')
  }

  // 处理 additionalProperties 为 true 的情况（允许任意类型的额外属性）
  if (additional === true) {
    return 'z.unknown()'
  }

  // 处理 additionalProperties 为布尔值的情况
  if (isBoolean(additional)) {
    return 'z.unknown()'
  }

  // 处理 additionalProperties 为引用类型的情况
  if (isRef(additional)) {
    return `z.lazy(() => ${getlowerFirstRefAlias(additional.$ref)})`
  }

  // 处理 additionalProperties 为具体 schema 的情况
  if (additional && typeof additional === 'object') {
    // 处理枚举类型
    if ('enum' in additional && additional.enum && additional.enum.length > 0) {
      const enumValues = additional.enum.map((value) => `'${value}'`).join(', ')
      return `z.enum([${enumValues}])`
    }

    // 处理 oneOf/anyOf/allOf 组合类型
    if ('oneOf' in additional && additional.oneOf) {
      const types = additional.oneOf
        .map((s) => schemaTemplate(s as SchemaObjectAndJSONSchema, '', ''))
        .map(type => type.startsWith('z') ? type : `z${type}`)
        .join(', ')
      return `z.union([${types}])`
    }

    if ('anyOf' in additional && additional.anyOf) {
      const types = additional.anyOf
        .map((s) => schemaTemplate(s as SchemaObjectAndJSONSchema, '', ''))
        .map(type => type.startsWith('z') ? type : `z${type}`)
        .join(', ')
      return `z.union([${types}])`
    }

    if ('allOf' in additional && additional.allOf) {
      const types = additional.allOf
        .map((s) => schemaTemplate(s as SchemaObjectAndJSONSchema, '', ''))
        .map(type => type.startsWith('z') ? type : `z${type}`)
        .join('.and(')
      return types + '.and('.repeat(additional.allOf.length - 1).replace(/\.and\($/, ')')
    }

    // 使用 schemaTemplate 处理其他类型
    const schemaString = schemaTemplate(additional as SchemaObjectAndJSONSchema, '', '')

    // 确保返回的类型字符串格式正确
    if (schemaString.startsWith('.')) {
      return `z${schemaString}`
    } else if (schemaString.startsWith('z')) {
      return schemaString
    } else {
      return `z.${schemaString}`
    }
  }

  // 默认情况：未知类型
  return 'z.unknown()'
}

/**
 * 将 JSDocStructure 数组渲染成标准的多行 /** ... *\/ 注释
 */
function writeJSDoc(writer: CodeBlockWriter, docs?: (OptionalKind<JSDocStructure> | string)[]) {
  const tags = get(docs, '[0].tags', [])
  if (!docs || docs.length === 0 || isEmpty(tags)) return

  writer.writeLine('/**')
  //使用writer换行
  //writer.newLine()
  docs.forEach((doc) => {
    if (isString(doc)) {
      writer.writeLine(` * ${doc}`)
    }

    // 描述可能多行，用换行拆分
    if (!isString(doc) && isString(doc?.description)) {
      doc.description.split('\n').forEach((line) => writer.writeLine(` * ${line}`))
    }
    // 渲染 tags
    if (!isString(doc) && doc?.tags && doc?.tags.length > 0) {
      doc.tags.forEach((tag) => {
        const text = tag.text ? `${tag.text}` : ''
        writer.writeLine(` * @${tag.tagName} ${text}`)
      })
    }
  })
  writer.writeLine(' */')
}
