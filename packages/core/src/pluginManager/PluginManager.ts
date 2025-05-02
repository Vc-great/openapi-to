import Oas from 'oas'
import { OpenAPIHelper } from '../OpenAPIContext/OpenAPIHelper.ts'

import { type PluginEnumType, PluginStatus } from '../enums.ts'
import type { OpenAPIDocument, OpenapiToSingleConfig } from '../types'
import type { PluginDefinition } from './types.ts'

import type { SourceFile } from 'ts-morph'
import { ts } from 'ts-morph'
import { sortPluginsByStages } from './graph.ts'
import { runPluginsByTags } from './runPluginsByTags.ts'
export type PluginStatusValue = `${PluginStatus}`
type Executed = {
  name: string
  status: PluginStatusValue
}

export class PluginManager {
  executed: Array<Executed> = []
  readonly plugins: Array<PluginDefinition> = []
  filesCreated = 0
  constructor(
    private readonly openapiToSingleConfig: OpenapiToSingleConfig,
    private readonly openAPIDocument: OpenAPIDocument,
  ) {
    this.openapiToSingleConfig = openapiToSingleConfig
    this.openAPIDocument = openAPIDocument
    this.plugins = this.openapiToSingleConfig.plugins
  }

  get pluginsByStages() {
    return sortPluginsByStages(this.plugins)
  }

  get pluginNames(): PluginEnumType {
    return this.plugins.map((plugin) => plugin.name) as PluginEnumType
  }

  async execute(): Promise<{ sourceFiles: SourceFile[]; failedPluginNames: string[] }> {
    const openAPIHelper = new OpenAPIHelper(new Oas({ ...this.openAPIDocument }))
    const sourceFileAll = []
    const failedPluginNameSet = new Set<string>()

    const { sourceFiles, failedPluginNames } = await runPluginsByTags(this.pluginsByStages, {
      openAPIHelper: openAPIHelper,
      openapiToSingleConfig: this.openapiToSingleConfig,
      openAPIDocument: this.openAPIDocument,
      pluginNames: this.pluginNames,
    })
    sourceFileAll.push(...sourceFiles)
    failedPluginNames.forEach((name) => failedPluginNameSet.add(name))

    return { sourceFiles: sourceFileAll, failedPluginNames: [...failedPluginNameSet] }
  }

  get formatText() {
    return {
      // 缩进与换行
      indentSize: 2,
      indentStyle: ts.IndentStyle.Smart,
      convertTabsToSpaces: true,
      newLineCharacter: '\n',

      // 引号与尾随逗号（来自 manipulationSettings）
      quoteKind: 'single',
      useTrailingCommas: true,

      // 空格规则
      insertSpaceAfterCommaDelimiter: true,
      insertSpaceBeforeFunctionParenthesis: false,
      insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
      insertSpaceAfterSemicolonInForStatements: true,
      insertSpaceBeforeTypeAnnotation: false,

      // 大括号放置
      placeOpenBraceOnNewLineForFunctions: false,
      placeOpenBraceOnNewLineForControlBlocks: false,

      // 分号策略
      semicolons: ts.SemicolonPreference.Insert,
    }
  }

  async writeFiles(sourceFiles: SourceFile[]): Promise<void> {
    const batchSize = 100
    for (let i = 0; i < sourceFiles.length; i += batchSize) {
      const batch = sourceFiles.slice(i, i + batchSize)
      await Promise.all(
        batch.map((sourceFile) => {
          sourceFile.formatText(this.formatText)
          return sourceFile.save()
        }),
      )
    }
  }

  async run(): Promise<void> {
    const { sourceFiles, failedPluginNames } = await this.execute()

    this.executed = this.plugins.map((plugin) => {
      return {
        name: plugin.name,
        status: failedPluginNames.includes(plugin.name) ? PluginStatus.Failed : PluginStatus.Succeeded,
      }
    })
    await this.writeFiles(sourceFiles)

    this.filesCreated = sourceFiles.length
  }
}
