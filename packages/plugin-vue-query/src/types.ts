
export type RequiredPluginConfig = Required<PluginConfig>

export interface PluginConfig {
  /**
   * Not open yet
   */
  infinite?: {
    pageNumParam?: string
  }
  requestConfigTypeImportDeclaration?: {
    namedImports: Array<string>
    moduleSpecifier: string
  }
  responseErrorTypeImportDeclaration?: {
    namedImports: Array<string>
    moduleSpecifier: string
  }
  /**
   * Whether to add an extension (such as .ts) in the import path
   */
  importWithExtension?: boolean
  placeholderData?:{
    value?:any,
    pathInclude?: Array<string|RegExp>
  }
}

export interface Operation {
  operationId: string // 如：Create
  method: string // 请求方法，如：post、get
  path: string // 接口路径，如：/pet
  summary?: string
  description?: string
  // 其它 OpenAPI 相关数据
}
