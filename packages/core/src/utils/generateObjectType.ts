import CodeBlockWriter from 'code-block-writer'
import { type OptionalKind, type PropertySignatureStructure, type TypeElementMemberedNodeStructure, Writers } from 'ts-morph'

export function generateObjectType(properties: OptionalKind<PropertySignatureStructure>[]): string {
  const writer = new CodeBlockWriter()
  const statements: TypeElementMemberedNodeStructure = { properties }
  Writers.objectType(statements)(writer) //writer
  return writer.toString()
}
