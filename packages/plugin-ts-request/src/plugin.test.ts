//@ts-nocheck
import path from 'node:path'
import { pluginEnum } from '@openapi-to/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildImports } from './builds/buildImports.ts'
import { buildMethodBody } from './builds/buildMethodBody.ts'
import { buildMethodParameters } from './builds/buildMethodParameters.ts'
import { definePlugin } from './plugin'
import { jsDocTemplateFromMethod } from './template/jsDocTemplateFromMethod.ts'

// 模拟依赖
const mockAddFunction = vi.fn()
const mockAddStatements = vi.fn()
const mockCreateSourceFile = vi.fn(() => ({
  addFunction: mockAddFunction,
  addStatements: mockAddStatements,
}))

vi.mock('ts-morph', () => {
  return {
    Project: vi.fn(() => ({
      createSourceFile: mockCreateSourceFile,
    })),
    StructureKind: {
      Function: 'Function',
      ImportDeclaration: 'ImportDeclaration',
    },
  }
})

vi.mock('../src/builds/buildImports.ts', () => ({
  buildImports: vi.fn(() => []),
}))

vi.mock('../src/builds/buildMethodBody.ts', () => ({
  buildMethodBody: vi.fn(() => 'return fetch();'),
}))

vi.mock('../src/builds/buildMethodParameters.ts', () => ({
  buildMethodParameters: vi.fn(() => []),
}))

vi.mock('../src/template/jsDocTemplateFromMethod.ts', () => ({
  jsDocTemplateFromMethod: vi.fn(() => [{ description: '测试文档' }]),
}))

vi.mock('@openapi-to/core/utils', () => ({
  getRelativePath: vi.fn(() => '../types'),
  formatterModuleSpecifier: vi.fn((specifier, withExt) => specifier + (withExt ? '.ts' : '')),
}))

describe('definePlugin', () => {
  type MockOperation = {
    accessor: {
      operationName: string
      getFirstTagName: string
      setOperationRequest: ReturnType<typeof vi.fn>
      operationTSType: {
        pathParams: string
        queryParams: string
        body: string
        responseSuccess: string
        filePath: string
      }
      operationZodSchema: {
        body: string
        responseSuccess: string
        filePath: string
      }
    }
  }

  type MockContext = {
    openapiToSingleConfig: {
      output: {
        dir: string
      }
    }
    setSourceFiles: ReturnType<typeof vi.fn>
    getSourceFiles: ReturnType<typeof vi.fn>
    logger: {
      info: ReturnType<typeof vi.fn>
    }
  }

  type MockTagData = {
    name: string
    formattedTagName: string
    description: string
  }

  let mockOperation: MockOperation
  let mockContext: MockContext
  let mockTagData: MockTagData

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks()

    // 准备测试数据
    mockOperation = {
      accessor: {
        operationName: 'testOperation',
        getFirstTagName: 'testTag',
        setOperationRequest: vi.fn(),
        operationTSType: {
          pathParams: 'PathParams',
          queryParams: 'QueryParams',
          body: 'RequestBody',
          responseSuccess: 'ResponseSuccess',
          filePath: '/path/to/types.ts',
        },
        operationZodSchema: {
          body: 'requestBodySchema',
          responseSuccess: 'responseSuccessSchema',
          filePath: '/path/to/schemas.ts',
        },
      },
    }

    mockContext = {
      openapiToSingleConfig: {
        output: {
          dir: '/output',
        },
      },
      setSourceFiles: vi.fn(),
      getSourceFiles: vi.fn(),
      logger: {
        info: vi.fn(),
      },
    }

    mockTagData = {
      name: 'testTag',
      formattedTagName: 'TestTag',
      description: '测试标签描述',
    }
  })

  it('应该创建具有正确属性的插件', () => {
    const plugin = definePlugin({})

    expect(plugin.name).toBe(pluginEnum.Request)
    expect(plugin.dependencies).toContain(pluginEnum.TsType)
    expect(plugin.dependencies).not.toContain(pluginEnum.Zod)
  })

  it('当 parser 为 zod 时应包含 Zod 依赖', () => {
    const plugin = definePlugin({ parser: 'zod' })

    expect(plugin.dependencies).toContain(pluginEnum.Zod)
  })

  it('应正确处理 buildStart 钩子', async () => {
    const plugin = definePlugin({})
    await plugin.hooks.buildStart(mockContext)

    // 这里暂时没有多少逻辑可测试，但确保钩子能正常执行
    expect(true).toBeTruthy()
  })

  it('应正确处理 tagStart 钩子', async () => {
    const plugin = definePlugin({})
    await plugin.hooks.tagStart(mockTagData, mockContext)

    // 验证钩子可以正常执行
    expect(true).toBeTruthy()
  })

  it('应正确处理 operation 钩子', async () => {
    const plugin = definePlugin({})
    // 先调用operation钩子
    await plugin.hooks.operation(mockOperation, mockContext)
    // 验证是否设置了操作请求信息
    expect(mockOperation.accessor.setOperationRequest).toHaveBeenCalledWith({
      filePath: path.join('/output', 'testTag', 'test-operation.service.ts'),
      requestName: 'testOperationService',
    })

    // 验证是否创建了源文件
    expect(mockCreateSourceFile).toHaveBeenCalled()
    expect(mockCreateSourceFile).toHaveBeenCalledWith(path.join('/output', 'testTag', 'test-operation.service.ts'), '', { overwrite: true })

    // 验证是否调用了必要的生成函数
    expect(buildMethodParameters).toHaveBeenCalledWith(mockOperation, {})
    expect(buildMethodBody).toHaveBeenCalledWith(mockOperation, {})
    expect(jsDocTemplateFromMethod).toHaveBeenCalledWith(mockOperation)

    // 验证是否设置了源文件
    expect(mockContext.setSourceFiles).toHaveBeenCalledWith([pluginEnum.Request, 'testOperation'], expect.anything())
  })

  it('应在使用 zod 解析器时生成正确的导入语句', async () => {
    const plugin = definePlugin({ parser: 'zod' })

    await plugin.hooks.operation(mockOperation, mockContext)

    // 验证 buildImports 是否用正确的参数调用
    expect(buildImports).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          isTypeOnly: true,
          namedImports: expect.any(Array),
        }),
        expect.objectContaining({
          namedImports: expect.any(Array),
        }),
      ]),
      { parser: 'zod' },
    )
  })

  it('应正确处理 tagEnd 钩子', async () => {
    const plugin = definePlugin({})
    await plugin.hooks.tagEnd(mockTagData, mockContext)

    // 当前这个钩子主要包含注释掉的代码，确保能正常执行即可
    expect(true).toBeTruthy()
  })
})
