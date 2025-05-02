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

  if (baseSchema.additionalProperties) {
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
      writer.writeLine(`${propertyName}: z.lazy(()=>${getlowerFirstRefAlias(schema.$ref)})${comma}`)
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

  return `z.object({${writer.toString()}})`
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
    return '.record(z.string(), z.unknown())'
  }

  if (isRef(additional)) {
    return `.record(z.string(), ${getlowerFirstRefAlias(additional.$ref)})`
  }

  //todo

  return `.record(z.string(),${schemaTemplate(additional, '')})`
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
