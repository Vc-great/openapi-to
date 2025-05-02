import { isEmpty } from 'lodash-es'
import { type ExportDeclarationStructure, StructureKind } from 'ts-morph'

export function buildExports(refNames: string[]) {
  const modelFolderName = './models'
  if (isEmpty(refNames)) {
    return []
  }

  return refNames.map((refName) => {
    return {
      kind: StructureKind.ExportDeclaration,
      moduleSpecifier: `./${refName}`,
    } as ExportDeclarationStructure
  })
}
