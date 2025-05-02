import { buildIndexAst } from '../templates/buildIndexAst'
// builders/IndexGenerator.ts
import type { GeneratorContext, HookFile, IndexFile } from '../types'

export class IndexGenerator {
  constructor(
    private context: GeneratorContext,
    private hookFiles: HookFile[],
  ) {}

  public buildIndex(): IndexFile {
    // 调用模板工具构造 index 文件 AST，整合各个 hook 的导入、export 及命名空间构建
    const ast = buildIndexAst(this.hookFiles, this.context.strategy)
    // `${openapiToSingleConfig.output.dir}/${_.lowerFirst(openapiContext.currentTagNameOfPinYin)}-${SWR_SUFFIX}`
    return {
      fileName: 'index.ts',
      ast,
    }
  }
}
