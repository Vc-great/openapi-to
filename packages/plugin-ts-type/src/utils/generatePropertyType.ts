import { jsDocTemplateFromParameter } from '@/templates/jsDocTemplateFromSchema.ts'
import { resolveBaseType } from '@/templates/schemaTemplate.ts'

import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'

import type { ParameterObjectWithRef } from '@openapi-to/core'
import { get, isEmpty, isString } from 'lodash-es'
import type { JSDocStructure, OptionalKind, PropertySignatureStructure } from 'ts-morph'
import { CodeBlockWriter } from 'ts-morph'
type OptionalKindOfPropertySignatureStructure = OptionalKind<PropertySignatureStructure>

/**
 * 将一组属性描述生成成带 JSDoc 注释的 TypeScript 对象字面量
 */
export function generatePropertyType(properties: OptionalKindOfPropertySignatureStructure[]): string {
  const writer = new CodeBlockWriter({ indentNumberOfSpaces: 4 })

  writer.block(() => {
    properties.forEach((prop, idx) => {
      writeJSDoc(writer, prop.docs)
      const name = prop.name
      const optional = prop.hasQuestionToken ? '?' : ''
      const type = prop.type ?? 'any'
      const comma = idx < properties.length - 1 ? ',' : ''
      writer.writeLine(`${name}${optional}: ${type}${comma}`)
    })
  })
  return writer.toString()
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
        writer.writeLine(` * @${tag.tagName}${text}`)
      })
    }
  })
  writer.writeLine(' */')
}

/**
 * 将一组属性描述生成成带 JSDoc 注释的 TypeScript 对象字面量
 */
export function generateParameterType(parameters: ParameterObjectWithRef[], operationName: string): string {
  const writer = new CodeBlockWriter({ indentNumberOfSpaces: 4 })

  writer.block(() => {
    parameters.forEach((prop, idx) => {
      const name = prop.name
      const comma = idx < parameters.length - 1 ? ',' : ''

      if ('$ref' in prop && prop.$ref) {
        const type = getUpperFirstRefAlias(prop.$ref)
        writer.writeLine(`${name}: ${type}${comma}`)
      } else {
        writeJSDoc(writer, jsDocTemplateFromParameter(prop))
        const optional = prop.required ? '' : '?'
        const type = prop.schema ? resolveBaseType(prop.schema, name, operationName) : 'string'

        writer.writeLine(`${name}${optional}: ${type}${comma}`)
      }
    })
  })
  return writer.toString()
}
