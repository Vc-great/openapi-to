import { map as _map, forEach, lowerFirst } from 'lodash-es'
import { SWR_SUFFIX } from '../constants.ts'
import { buildSwrHookAst } from '../templates/buildSwrHookAst'
import type { HookFile, SwrContext, TagContext } from '../types.ts'

import { SwrKeyGenerator } from './SwrKeyGenerator'

export class SwrHookBuilder {
  private keyGenerator: SwrKeyGenerator

  constructor(private tagContext: TagContext) {
    // 初始化 key 生成器
    this.keyGenerator = new SwrKeyGenerator(tagContext)
  }

  /**
   * 针对上下文中的所有 operation 生成 hook 文件
   */
  public buildHook(operation): HookFile {
    const { accessor, tagNameOfPinYin } = operation
    const key = this.keyGenerator.generate(accessor)

    // 调用模板工具构造 AST，生成 hook 文件对应数据结构
    const sourceAst = buildSwrHookAst(accessor, key, this.tagContext.strategy, this.tagContext.pluginConfig)
    return {
      fileName: lowerFirst(`${tagNameOfPinYin}.${SWR_SUFFIX}.ts`),
      ast: sourceAst,
      operationId: accessor.operation.getOperationId(),
      hookName: `use${accessor.operationName}`,
      keyName: key.keyFunctionName,
    }
  }
}
