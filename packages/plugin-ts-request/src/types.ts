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
  /**
   * 是否在 import 路径中添加扩展名（如 .ts）
   */
  importWithExtension?: boolean
}

export type OperationTypeOfTag = {
  namedImports: string[]
  moduleSpecifier: string
}
