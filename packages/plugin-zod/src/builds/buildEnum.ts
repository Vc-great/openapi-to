import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { isString, lowerFirst } from 'lodash-es'
import { type StatementStructures, StructureKind, VariableDeclarationKind, type VariableStatementStructure } from 'ts-morph'
import type { EnumItem } from '../EnumRegistry'

export function buildEnum(enumAll: EnumItem[]): StatementStructures[] {
  return enumAll.flatMap(({ name, enumValue, description, extend }) => {
    const enumName = name

    if (!Array.isArray(enumValue)) return []

    const enumOptionsStatement: VariableStatementStructure = {
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      leadingTrivia: '\n',
      isExported: true,
      docs: jsDocTemplateFromSchema(description),
      declarations: [
        {
          name: `${lowerFirst(enumName)}`,
          initializer: extend
            ? lowerFirst(extend)
            : (writer) => {
                writer.write('z.enum([')
                enumValue.forEach((item, index) => {
                  writer.write(isString(item) ? `'${item}'` : item)
                  index !== enumValue.length - 1 && writer.write(', ')
                })

                writer.write(']')
              },
        },
      ],
      trailingTrivia: '',
    }

    //
    return [enumOptionsStatement]
  })
}
