import type { OperationAccessor } from '@openapi-to/core'
import _ from 'lodash'
import type { OpenAPIV3 } from 'openapi-types'
import type { OptionalKind, ParameterDeclarationStructure, SourceFile } from 'ts-morph'
// templates/buildSwrHookAst.ts
import type { Operation, PluginConfig, TypeStrategy } from '../types'

export function buildSwrHookAst(operationAccessor: OperationAccessor, key: any, strategy: TypeStrategy, pluginConfig: PluginConfig): SourceFile {
  // 这里基于 ts-morph 创建 SourceFile 的 AST：
  // - 插入常规的 import 语句，如 petService、useSWRMutation、SWRMutationConfiguration 等；
  // - 根据 strategy.getTypeImport() 插入类型导入；
  // - 构造 key 生成函数，如 createMutationKey，并生成返回类型（通过 ReturnType）；
  // - 生成 hook 函数，如 useCreate，添加 JSDoc 注释（包含 summary、description）；
  // - 根据 infiniteKey 配置决定是否生成 useSWRInfinite 逻辑；
  // 返回构建好的 SourceFile 对象
  throw new Error('未实现：buildSwrHookAst 模板函数')
}
