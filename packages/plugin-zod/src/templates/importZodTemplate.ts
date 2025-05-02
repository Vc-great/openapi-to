import { type ImportDeclarationStructure, StructureKind } from 'ts-morph'

export const importZodTemplate: ImportDeclarationStructure = {
  kind: StructureKind.ImportDeclaration,
  namedImports: ['z'],
  moduleSpecifier: 'zod',
}
