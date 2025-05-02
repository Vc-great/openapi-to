import { promises } from 'fs-extra'
import { camelCase, find, head, isEmpty, isFunction } from 'lodash-es'
import type { TagObject } from 'oas/types'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { SourceFile } from 'ts-morph'
import type { OpenAPIHelper } from '../OpenAPIContext/OpenAPIHelper.ts'
import type { HookTagObject, OperationWrapper } from '../OpenAPIContext/types.ts'
import type { PluginEnumType } from '../enums.ts'
import type { ComponentHookType, ComponentHooks, OpenAPIDocument, OpenapiToSingleConfig } from '../types'
import type { HookContext, PluginDefinition } from './types.ts'

type Context = {
  openAPIHelper: OpenAPIHelper
  openAPIDocument: OpenAPIDocument
  openapiToSingleConfig: OpenapiToSingleConfig
  pluginNames: PluginEnumType
}

export async function runPluginsByTags(
  stages: PluginDefinition[][],
  { openAPIHelper, openAPIDocument, openapiToSingleConfig, pluginNames }: Context,
): Promise<{ failedPluginNames: string[]; sourceFiles: SourceFile[] }> {
  const failedPluginNamesSet = new Set<string>() // 收集失败的插件名称

  const ctx: HookContext = {
    _tagSourceFiles: new Map<string[], SourceFile>(),
    openapiHelper: openAPIHelper,
    openapiToSingleConfig: openapiToSingleConfig,
    openAPIDocument: openAPIDocument,
    pluginNames: pluginNames,
    getSourceFiles(name: string[]) {
      return ctx._tagSourceFiles.get(name)
    },
    setSourceFiles(name: string[], sourceFile: SourceFile) {
      ctx._tagSourceFiles.set(name, sourceFile)
    },
    store: new Map(),
    /*    clearSourceFiles() {
      ctx._tagSourceFiles.clear()
    },*/
  }

  // let currentSourceFiles: SourceFile[] = []

  // 按顺序执行每个stage
  for (const stage of stages) {
    try {
      // 1. 先顺序执行 buildStart 和 tagStart
      await executePluginHooks(stage, 'buildStart', (plugin) => plugin.hooks.buildStart?.(ctx), failedPluginNamesSet)

      // 2. 并发执行组件钩子和操作
      const components = openAPIHelper.oas.getDefinition().components
      const concurrentComponentTasks: Array<Awaited<any>> = [
        ...(isEmpty(components) ? [] : await executePluginComponents(stage, ctx, components, failedPluginNamesSet)),
      ]
      const concurrentTagStartTasks = []
      const concurrentTagOperationsTasks = []
      const concurrentTagTagEndTasks = []
      //
      for (const tagName in openAPIHelper.operationsByTag) {
        const operations = openAPIHelper.operationsByTag[tagName]!

        const tagData: HookTagObject = {
          ...find(head(operations)!.accessor.operation.getTags(), (x) => camelCase(x.name) === tagName)!,
        }
        if (!tagData) {
          throw new Error(`Tag with name "${tagName}" not found`)
        }
        concurrentTagStartTasks.push(await executePluginHooks(stage, 'tagStart', (plugin) => plugin.hooks.tagStart?.(tagData, ctx), failedPluginNamesSet))

        // 添加操作钩子并发任务（所有操作并发执行）
        const operationsTask = Promise.all(
          operations.map((operation) => executePluginHooks(stage, 'operation', (plugin) => plugin.hooks.operation?.(operation, ctx), failedPluginNamesSet)),
        )
        concurrentTagOperationsTasks.push(operationsTask)

        concurrentTagTagEndTasks.push(await executePluginHooks(stage, 'tagEnd', (plugin) => plugin.hooks.tagEnd?.(tagData, ctx), failedPluginNamesSet))
      }

      // 并发执行所有任务
      await Promise.all([...concurrentComponentTasks, ...concurrentTagStartTasks])
      await Promise.all(concurrentTagOperationsTasks)
      await Promise.all(concurrentTagTagEndTasks)

      // 3. 最后顺序执行buildEnd

      await executePluginHooks(stage, 'buildEnd', (plugin) => plugin.hooks.buildEnd?.(ctx), failedPluginNamesSet)
    } catch (error) {
      console.error(`Error executing plugin stage: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  return {
    sourceFiles: [...ctx._tagSourceFiles.values()].flat(),
    failedPluginNames: [...failedPluginNamesSet],
  }
}

/**
 * 通用钩子执行器，遍历插件并执行指定的钩子函数
 */
async function executePluginHooks(
  plugins: PluginDefinition[],
  hookName: string,
  hookExecutor: (plugin: PluginDefinition) => any,
  failedPluginNames: Set<string>,
) {
  for (const plugin of plugins) {
    try {
      await hookExecutor(plugin)
    } catch (error) {
      console.error(`Error executing plugin ${plugin.name} hook ${hookName}: ${error instanceof Error ? error.message : String(error)}`)
      failedPluginNames.add(plugin.name)
    }
  }
}

async function executePluginComponents(
  stage: PluginDefinition[],
  ctx: HookContext,
  components: OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject,
  failedPluginNames: Set<string>,
) {
  // 准备组件钩子任务
  const componentHooks: ComponentHookType[] = [
    { type: 'componentsSchemas', data: components.schemas },
    { type: 'componentsParameters', data: components.parameters },
    { type: 'componentsRequestBodies', data: components.requestBodies },
    { type: 'componentsResponses', data: components.responses },
  ]

  return Promise.all(
    componentHooks
      .filter(({ data }) => !isEmpty(data))
      .map(({ type, data }) =>
        executePluginHooks(
          stage,
          type,
          (plugin) => {
            const hookFn = plugin.hooks[type] as (typeof plugin.hooks)[typeof type]
            //todo any
            return isFunction(hookFn) ? hookFn(data as any, ctx) : undefined
          },
          failedPluginNames,
        ),
      )
      .filter(Boolean),
  )
}
