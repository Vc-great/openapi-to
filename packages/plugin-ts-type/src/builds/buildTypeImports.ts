import { isEmpty } from 'lodash-es'
import { type ImportDeclarationStructure, StructureKind } from 'ts-morph'

export function buildTypeImports(refNames: string[], moduleSpecifier: string) {
  if (isEmpty(refNames)) {
    return []
  }
  const typeModel: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    namedImports: [...refNames],
    isTypeOnly: true,
    moduleSpecifier,
  }

  return [typeModel]
}
