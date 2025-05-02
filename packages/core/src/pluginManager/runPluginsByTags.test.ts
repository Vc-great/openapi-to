//@ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HookTagObject, OperationWrapper } from '../OpenAPIContext/types.ts'
import type { PluginEnumType } from '../enums.ts'
import type { OpenAPIDocument, OpenapiToSingleConfig } from '../types'
import { runPluginsByTags } from './runPluginsByTags'
import type { PluginDefinition } from './types.ts'

// 模拟 lodash-es
vi.mock('lodash-es', () => ({
  isEmpty: (obj: any) => !obj || Object.keys(obj).length === 0,
  isFunction: (fn: any) => typeof fn === 'function',
  camelCase: (str: string) => str.toLowerCase(),
  find: (arr: any[], predicate: Function) => arr.find((item) => predicate(item)),
  head: (arr: any[]) => arr[0],
}))

describe('runPluginsByTags', () => {
  // 基本测试数据
  let mockOpenAPIHelper: any
  let mockOpenAPIDocument: OpenAPIDocument
  let mockConfig: OpenapiToSingleConfig
  let mockPluginNames: PluginEnumType

  beforeEach(() => {
    // 初始化测试数据
    const mockTagData: HookTagObject = { name: 'testTag', description: 'Test tag' }

    const mockOperations = [
      {
        path: '/test',
        method: 'get',
        operation: {},
        accessor: {
          operation: {
            getTags: () => [mockTagData],
          },
        },
      } as unknown as OperationWrapper,
    ]

    mockOpenAPIHelper = {
      oas: {
        getDefinition: vi.fn().mockReturnValue({
          components: {
            schemas: { testSchema: {} },
            parameters: { testParam: {} },
            requestBodies: { testBody: {} },
            responses: { testResponse: {} },
          },
        }),
      },
      operationsByTag: {
        testTag: mockOperations,
      },
    }

    mockOpenAPIDocument = {} as OpenAPIDocument
    mockConfig = {} as OpenapiToSingleConfig
    mockPluginNames = {} as PluginEnumType
  })

  it('应正确执行单个阶段中的所有钩子', async () => {
    // 创建测试插件
    const plugin1: PluginDefinition = {
      name: 'plugin1',
      hooks: {
        buildStart: vi.fn(),
        tagStart: vi.fn(),
        componentsSchemas: vi.fn(),
        componentsParameters: vi.fn(),
        componentsRequestBodies: vi.fn(),
        componentsResponses: vi.fn(),
        operation: vi.fn(),
        tagEnd: vi.fn(),
        buildEnd: vi.fn(),
      },
    }

    const stages: PluginDefinition[][] = [[plugin1]]

    const result = await runPluginsByTags(stages, {
      openAPIHelper: mockOpenAPIHelper,
      openAPIDocument: mockOpenAPIDocument,
      openapiToSingleConfig: mockConfig,
      pluginNames: mockPluginNames,
    })

    // 验证所有钩子被调用
    expect(plugin1.hooks.buildStart).toHaveBeenCalled()
    expect(plugin1.hooks.tagStart).toHaveBeenCalled()
    expect(plugin1.hooks.componentsSchemas).toHaveBeenCalled()
    expect(plugin1.hooks.componentsParameters).toHaveBeenCalled()
    expect(plugin1.hooks.componentsRequestBodies).toHaveBeenCalled()
    expect(plugin1.hooks.componentsResponses).toHaveBeenCalled()
    expect(plugin1.hooks.operation).toHaveBeenCalled()
    expect(plugin1.hooks.tagEnd).toHaveBeenCalled()
    expect(plugin1.hooks.buildEnd).toHaveBeenCalled()

    // 验证返回结果
    expect(Array.isArray(result.sourceFiles)).toBeTruthy()
    expect(Array.isArray(result.failedPluginNames)).toBeTruthy()
    expect(result.failedPluginNames).toEqual([])
  })

  it('应按顺序执行多个阶段的插件', async () => {
    const executionOrder: string[] = []

    const plugin1: PluginDefinition = {
      name: 'plugin1',
      hooks: {
        buildStart: vi.fn().mockImplementation((ctx) => {
          executionOrder.push('plugin1:buildStart')
        }),
      },
    }

    const plugin2: PluginDefinition = {
      name: 'plugin2',
      hooks: {
        buildStart: vi.fn().mockImplementation((ctx) => {
          executionOrder.push('plugin2:buildStart')
        }),
      },
    }

    const stages: PluginDefinition[][] = [[plugin1], [plugin2]]

    await runPluginsByTags(stages, {
      openAPIHelper: mockOpenAPIHelper,
      openAPIDocument: mockOpenAPIDocument,
      openapiToSingleConfig: mockConfig,
      pluginNames: mockPluginNames,
    })

    expect(executionOrder).toEqual(['plugin1:buildStart', 'plugin2:buildStart'])
  })

  it('应正确处理上下文对象的源文件操作', async () => {
    const mockSourceFile = { getFullText: () => 'test' }

    const plugin: PluginDefinition = {
      name: 'testPlugin',
      hooks: {
        tagStart: vi.fn().mockImplementation((tagData, ctx) => {
          ctx.setSourceFiles(['testTag'], mockSourceFile)
        }),
        operation: vi.fn().mockImplementation((op, ctx) => {
          const file = ctx.getSourceFiles(['testTag'])
          expect(file).toEqual(mockSourceFile)
        }),
      },
    }

    const stages: PluginDefinition[][] = [[plugin]]

    const result = await runPluginsByTags(stages, {
      openAPIHelper: mockOpenAPIHelper,
      openAPIDocument: mockOpenAPIDocument,
      openapiToSingleConfig: mockConfig,
      pluginNames: mockPluginNames,
    })

    expect(plugin.hooks.tagStart).toHaveBeenCalled()
    expect(plugin.hooks.operation).toHaveBeenCalled()
    expect(result.sourceFiles).toContain(mockSourceFile)
  })

  it('应正确收集失败的插件名称', async () => {
    const errorPlugin: PluginDefinition = {
      name: 'errorPlugin',
      hooks: {
        buildStart: vi.fn().mockImplementation(() => {
          throw new Error('测试错误')
        }),
      },
    }

    const successPlugin: PluginDefinition = {
      name: 'successPlugin',
      hooks: {
        buildStart: vi.fn(),
      },
    }

    const stages: PluginDefinition[][] = [[errorPlugin, successPlugin]]

    const result = await runPluginsByTags(stages, {
      openAPIHelper: mockOpenAPIHelper,
      openAPIDocument: mockOpenAPIDocument,
      openapiToSingleConfig: mockConfig,
      pluginNames: mockPluginNames,
    })

    expect(result.failedPluginNames).toContain('errorPlugin')
    expect(result.failedPluginNames).not.toContain('successPlugin')
    expect(successPlugin.hooks.buildStart).toHaveBeenCalled()
  })

  it('应并发执行组件钩子', async () => {
    const executionTimes: Record<string, number> = {}
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const plugin: PluginDefinition = {
      name: 'concurrentPlugin',
      hooks: {
        componentsSchemas: vi.fn().mockImplementation(async () => {
          const start = Date.now()
          await delay(100)
          executionTimes.schemas = Date.now() - start
        }),
        componentsParameters: vi.fn().mockImplementation(async () => {
          const start = Date.now()
          await delay(100)
          executionTimes.parameters = Date.now() - start
        }),
      },
    }

    const stages: PluginDefinition[][] = [[plugin]]
    const startTime = Date.now()

    await runPluginsByTags(stages, {
      openAPIHelper: mockOpenAPIHelper,
      openAPIDocument: mockOpenAPIDocument,
      openapiToSingleConfig: mockConfig,
      pluginNames: mockPluginNames,
    })

    const totalTime = Date.now() - startTime

    // 如果是并发执行，总时间应该接近单个操作的时间
    expect(totalTime).toBeLessThan(200)
    expect(plugin.hooks.componentsSchemas).toHaveBeenCalled()
    expect(plugin.hooks.componentsParameters).toHaveBeenCalled()
  })
})
