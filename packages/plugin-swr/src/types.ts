export interface PluginConfig {
  infinite?: {
    // 根据关键字判断是否生成 useSWRInfinite 代码
    pageNumParam?: string
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

export interface HookFile {
  fileName: string
  ast: any // 实际应为 ts-morph 的 SourceFile 类型
  operationId: string
  hookName: string
  keyName: string
}

export interface IndexFile {
  fileName: string
  ast: any
}

export interface GeneratorContext {
  operations: Operation[] // 全部 operation 信息
  pluginConfig: PluginConfig // 用户自定义插件配置
  outputDir: string // 输出目录
  strategy?: any // 通过 TypeStrategyFactory 注入的策略实例
  // 其它上下文参数，如 AST 工程实例、日志工具等
}
