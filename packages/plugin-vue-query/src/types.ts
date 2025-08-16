
export type RequiredPluginConfig = Required<PluginConfig>

export interface PluginConfig {
  infinite?: {
    // 根据关键字判断是否生成 useSWRInfinite 代码
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
   * 是否在 import 路径中添加扩展名（如 .ts）
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
