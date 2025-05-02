import type { HookTagObject } from '@openapi-to/core'
import { upperFirst } from 'lodash-es'
import { type ModuleDeclarationStructure, type StatementStructures, StructureKind } from 'ts-morph'

export function buildNamespaceType(tagData: HookTagObject, typeStatements: StatementStructures[]): ModuleDeclarationStructure {
  return {
    kind: StructureKind.Module,
    docs: [
      {
        tags: [
          {
            tagName: 'tag',
            text: tagData.name,
          },
          {
            tagName: 'description',
            text: tagData.description,
          },
          {
            tagName: 'externalDocs description',
            text: tagData.externalDocs?.description,
          },
          {
            tagName: 'externalDocs url',
            text: tagData.externalDocs?.url,
          },
        ].filter((x) => x.text),
      },
    ],
    isExported: true,
    name: upperFirst(tagData.name),
    statements: typeStatements,
  }
}
