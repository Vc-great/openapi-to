import type { InterfaceDeclarationStructure, StatementStructures, TypeAliasDeclarationStructure } from 'ts-morph'

export enum RequestClientEnum {
  AXIOS = 'axios',
  COMMON = 'common',
}

export type RequestClient = 'axios' | 'common'

export type PluginConfig = {
  requestImportDeclaration?: {
    moduleSpecifier: string
  }
  requestConfigTypeImportDeclaration?: {
    namedImports: Array<string>
    moduleSpecifier: string
  }
  requestClient?: RequestClient
  parser?: 'zod'
}

export type OperationTypeOfTag = {
  namedImports: string[]
  moduleSpecifier: string
}
