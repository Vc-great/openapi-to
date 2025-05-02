import { jsDocTemplateFromParameter, writeJSDoc } from '@/templates/jsDocTemplateFromSchema.ts'
import { resolveBaseSchema } from '@/templates/schemaTemplate.ts'

import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'

import type { ParameterObjectWithRef } from '@openapi-to/core'
import type { OptionalKind, PropertySignatureStructure } from 'ts-morph'
import { CodeBlockWriter } from 'ts-morph'

type OptionalKindOfPropertySignatureStructure = OptionalKind<PropertySignatureStructure>

/**
 * 将一组属性描述生成成带 JSDoc 注释的 TypeScript 对象字面量
 */
export function generateParameterSchema(parameters: ParameterObjectWithRef[], operationName: string): string {
  const writer = new CodeBlockWriter({ indentNumberOfSpaces: 4 })

  writer.block(() => {
    parameters.forEach((prop, idx) => {
      const name = prop.name
      const comma = idx < parameters.length - 1 ? ',' : ''

      if ('$ref' in prop && prop.$ref) {
        const refSchemaName = getlowerFirstRefAlias(prop.$ref)
        writer.writeLine(`${name}: ${refSchemaName}${comma}`)
      } else {
        writeJSDoc(writer, jsDocTemplateFromParameter(prop))
        const optional = prop.required ? '' : '.optional()'
        const schemaString = prop.schema ? resolveBaseSchema(prop.schema, name, operationName) : '.string()'

        writer.writeLine(`${name}: z${schemaString}${optional}${comma}`)
      }
    })
  })
  return `z.object(${writer.toString()})`
}
