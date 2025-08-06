import type { ParameterObject, Schema } from '@openapi-to/core'
import { get, isBoolean, isEmpty, isString } from 'lodash-es'
import type { CodeBlockWriter, JSDocStructure, OptionalKind } from 'ts-morph'

//https://openapi.apifox.cn/#externalDocumentationObject
type ExternalDocs = {
  //	对引用的外部文档的简短描述。CommonMark syntax可以被用来呈现富文本格式.
  description: string
  //必选. 外部文档的URL地址，这个值必须是URL地址格式。
  url: string
}
type Tags = Array<{ tagName: string; text: string }>

export function jsDocTemplateFromSchema(description?: string, schema?: Schema, propertyName?: string): OptionalKind<JSDocStructure>[] {
  const tags: Tags = []

  // 添加主要描述
  if (description) {
    tags.push({ tagName: 'description', text: description })
  }

  if (isBoolean(schema)) {
    return formatterTags(tags)
  }
  // 处理 schema 属性
  if (schema && !('$ref' in schema)) {
    // 默认值
    if ('default' in schema) {
      tags.push({ tagName: 'default', text: `${schema.default}` })
    }

    // 最小值
    if ('minimum' in schema) {
      const exclusiveText = schema.exclusiveMinimum ? ` - ${propertyName}>${schema.minimum}` : `- ${propertyName}≥${schema.minimum}`
      tags.push({ tagName: 'minimum', text: `${schema.minimum}${exclusiveText}` })
    }

    // 最大值
    if ('maximum' in schema) {
      const exclusiveText = schema.exclusiveMaximum ? ` - ${propertyName}<${schema.maximum}` : ` - ${propertyName}≤${schema.maximum}`
      tags.push({ tagName: 'maximum', text: `${schema.maximum}${exclusiveText}` })
    }
    //minLength
    if ('minLength' in schema) {
      tags.push({ tagName: 'minLength', text: `${schema.minLength}` })
    }

    //maxLength
    if ('maxLength' in schema) {
      tags.push({ tagName: 'maxLength', text: `${schema.maxLength}` })
    }

    // 格式
    if (schema.format) {
      tags.push({ tagName: 'format', text: schema.format })
    }

    // 示例
    if ('example' in schema) {
      tags.push({ tagName: 'example', text: schema.example })
    }

    // 只读/只写
    if ('readOnly' in schema && isBoolean(schema.readOnly)) {
      tags.push({ tagName: 'readOnly', text: '' })
    }

    if ('writeOnly' in schema && isBoolean(schema.writeOnly)) {
      tags.push({ tagName: 'writeOnly', text: '' })
    }

    // 弃用标记
    if ('deprecated' in schema && isBoolean(schema.deprecated)) {
      tags.push({ tagName: 'deprecated', text: '' })
    }

    //nullable
    if ('nullable' in schema && isBoolean(schema.nullable)) {
      tags.push({ tagName: 'nullable', text: '' })
    }
    //externalDocs
    if ('externalDocs' in schema && schema.externalDocs) {
      const externalDocs = schema.externalDocs as ExternalDocs
      tags.push({ tagName: 'externalDocsUrl', text: externalDocs?.url || '' })
      tags.push({ tagName: 'externalDocsDescription', text: externalDocs?.description || '' })
    }
  }
  return formatterTags(tags)
}
function formatterTags(tags: Tags) {
  return tags.length > 0
    ? [
        {
          tags: tags.map((item) => {
            return {
              ...item,
              leadingTrivia: tags.length === 1 ? '\n' : '',
            }
          }),
        },
      ]
    : []
}

export function jsDocTemplateFromParameter(parameter: ParameterObject) {
  const tags: Array<{ tagName: string; text: string }> = []

  if (isBoolean(parameter.allowEmptyValue)) {
    tags.push({ tagName: 'allowEmptyValue', text: `${parameter.allowEmptyValue}` })
  }
  //style
  if (parameter.style) {
    tags.push({ tagName: 'style', text: `${parameter.style}` })
  }

  //explode
  if (isBoolean(parameter.explode)) {
    const text = parameter.explode ? ': param=1&param=2' : ' : param=1,2'
    tags.push({ tagName: 'explode', text: `${parameter.explode}${text}` })
  }

  //allowReserved
  if (isBoolean(parameter.allowReserved)) {
    const text = parameter.allowReserved
      ? 'Allow parameter values to contain reserved characters'
      : 'Parameter values are not allowed to contain reserved characters'
    tags.push({ tagName: 'allowReserved', text: `${parameter.allowReserved}${text}` })
  }

  const docTags = [...tags, ...get(jsDocTemplateFromSchema(parameter.description, parameter.schema, parameter.name), '[0].tags', [])]

  return docTags.length > 0
    ? [
        {
          tags: docTags,
        },
      ]
    : []
}

/**
 * 将 JSDocStructure 数组渲染成标准的多行 /** ... *\/ 注释
 */
export function writeJSDoc(writer: CodeBlockWriter, docs?: (OptionalKind<JSDocStructure> | string)[]) {
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
