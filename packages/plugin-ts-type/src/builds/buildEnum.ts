import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import { lowerFirst, upperFirst } from "lodash-es";
import {
  type StatementStructures,
  StructureKind,
  type TypeAliasDeclarationStructure,
  VariableDeclarationKind,
  type VariableStatementStructure
} from "ts-morph";
import type { EnumItem } from "../EnumRegistry";

export function buildEnum(enumAll: EnumItem[]): StatementStructures[] {
  return enumAll.flatMap(({ name, enumValue, description, extend }) => {
    const enumName = name

    const enumValues = enumValue
    if (!Array.isArray(enumValues)) return []

    const enumOptionsStatement: VariableStatementStructure = {
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      leadingTrivia: '\n',
      isExported: true,
      declarations: [
        {
          name: `${lowerFirst(enumName)}`,
          initializer: extend
            ? lowerFirst(extend)
            : (writer) => {
                writer.write('{')
                writer.newLine()
                enumValues.forEach((enumItem, index) => {
                  writer.write(`${enumItem}: { label:'${enumItem}',value:'${enumItem}' }`)
                  index !== enumValues.length - 1 && writer.write(',') && writer.newLine()
                })
                writer.newLine()
                writer.write('} as const')
              },
        },
      ],
      trailingTrivia: '',
    }

    const enumValueTypeStatement: TypeAliasDeclarationStructure = {
      leadingTrivia: '\n',
      kind: StructureKind.TypeAlias,
      isExported: true,
      name: `${upperFirst(enumName)}Value`,
      type: `(typeof ${lowerFirst(enumName)})[keyof typeof ${lowerFirst(enumName)}]['value']`,
      docs: jsDocTemplateFromSchema(description),
    }

    const enumItemTypeStatement: TypeAliasDeclarationStructure = {
      leadingTrivia: '\n',
      kind: StructureKind.TypeAlias,
      isExported: true,
      name: `${upperFirst(enumName)}Item`,
      type: `(typeof ${lowerFirst(enumName)})[keyof typeof ${lowerFirst(enumName)}]`,
      docs: jsDocTemplateFromSchema(description),
    }
    //
    return [enumOptionsStatement, enumValueTypeStatement, enumItemTypeStatement]
  })
}
