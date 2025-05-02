import path from 'node:path'
import { definePlugin } from '@/plugin'
import { pluginEnum } from '@openapi-to/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 创建完整的 ts-morph 模拟
vi.mock('ts-morph', async () => {
  const mockSourceFile = {
    addStatements: vi.fn(),
    addModule: vi.fn(),
  }

  const mockProject = {
    createSourceFile: vi.fn(() => mockSourceFile),
  }

  // 添加 StructureKind 枚举
  const StructureKind = {
    ImportDeclaration: 'ImportDeclaration',
    Interface: 'Interface',
    TypeAlias: 'TypeAlias',
    Module: 'Module',
    VariableStatement: 'VariableStatement',
    ExportDeclaration: 'ExportDeclaration',
    // 添加其他可能需要的枚举值
  }

  return {
    Project: vi.fn(() => mockProject),
    StructureKind,
  }
})

// 模拟所有导入的构建和收集函数
vi.mock('@/builds/buildOperationTypes.ts', () => ({
  buildOperationTypes: vi.fn(() => [
    { kind: 'interface', name: 'TestInterface' },
    { kind: 'TypeAlias', name: 'TestType' },
  ]),
}))

vi.mock('@/EnumRegistry.ts', () => ({
  enumRegistry: {
    adds: vi.fn(),
    getAll: vi.fn(() => [
      { name: 'TestEnum', values: ['Value1', 'Value2'] },
      { name: 'StatusEnum', values: ['Active', 'Inactive'] },
    ]),
    getEnumValueName: vi.fn((val, name) => `${name}${val}`),
  },
  EnumRegistry: vi.fn(),
}))

vi.mock('@/collect/collectEnumFormOperation.ts', () => ({
  collectEnumFormOperation: vi.fn(() => [
    { name: 'TestEnum', enumValue: 'Value' },
    { name: 'TestEnum2', enumValue: 'Value2' },
  ]),
}))

vi.mock('@/collect/collectRefsFromOperation.ts', () => ({
  collectRefsFromOperation: vi.fn(() => ['User', 'Post', 'Comment']),
}))

vi.mock('@/builds/buildTypeImports.ts', () => ({
  buildTypeImports: vi.fn(() => [{ kind: 'ImportDeclaration' }]),
}))

vi.mock('@/builds/buildEnum.ts', () => ({
  buildEnum: vi.fn(() => [{ kind: 'VariableStatement', name: 'TestEnum' }]),
}))

vi.mock('@/builds/components/buildSchemas.ts', () => ({
  buildSchemas: vi.fn(() => [
    { kind: 'Interface', name: 'TestModel' },
    { kind: 'TypeAlias', name: 'TestType' },
  ]),
}))

vi.mock('@/collect/collectRefsFromSchemas.ts', () => ({
  collectRefsFromSchema: vi.fn(() => ['RefModel1', 'RefModel2']),
}))

vi.mock('@/collect/collectEnumsFromDocument.ts', () => ({
  collectEnumsFromComponentSchema: vi.fn(() => [
    { name: 'StatusEnum', enumValue: 'Active' },
    { name: 'TypeEnum', enumValue: 'Normal' },
  ]),
  collectEnumsFromComponentParameters: vi.fn(() => [{ name: 'ParamEnum', enumValue: 'Param' }]),
  collectEnumsFromComponentRequestBody: vi.fn(() => [{ name: 'BodyEnum', enumValue: 'Body' }]),
}))

vi.mock('@/collect/collectRefsFromDocument.ts', () => ({
  collectRefsFromComponentParameters: vi.fn(() => ['ParamRef']),
  collectRefsFromComponentRequestBody: vi.fn(() => ['BodyRef']),
  collectRefsFromComponentResponse: vi.fn(() => ['ResponseRef']),
}))

vi.mock('@/builds/components/buildComponentParameters.ts', () => ({
  buildComponentParameters: vi.fn(() => ({ kind: 'Interface', name: 'ParamInterface' })),
}))

vi.mock('@/builds/components/buildComponentsRequestBody.ts', () => ({
  buildComponentsRequestBody: vi.fn(() => ({ kind: 'Interface', name: 'RequestBodyInterface' })),
}))

vi.mock('@/builds/components/buildComponentsResponse.ts', () => ({
  buildComponentsResponse: vi.fn(() => ({ kind: 'Interface', name: 'ResponseInterface' })),
}))

vi.mock('@/templates/operationTypeNameTemplate.ts', () => ({
  getOperationTSTypeName: vi.fn(() => ({
    requestType: 'TestRequestType',
    responseType: 'TestResponseType',
  })),
}))

vi.mock('@/utils/getRefFilePath.ts', () => ({
  getRefFilePath: vi.fn((ref, basePath) => path.join(basePath, 'models', `${ref.toLowerCase()}.model.ts`)),
}))

vi.mock('@/utils/getUpperFirstRefAlias.ts', () => ({
  getUpperFirstRefAlias: vi.fn((ref) => ref),
}))

vi.mock('@openapi-to/core/utils', () => ({
  getRelativePath: vi.fn(() => '../relative/path'),
}))

describe('definePlugin', () => {
  let plugin: any
  let mockCtx: any

  beforeEach(() => {
    // 重置模拟函数
    vi.clearAllMocks()

    mockCtx = {
      openapiToSingleConfig: {
        output: { dir: '/test/output' },
        typeOutput: { dir: '/test/types' },
      },
      openapiHelper: {
        formatterName: vi.fn((name) => name),
      },
      setSourceFiles: vi.fn(),
      paths: {
        outputPath: '/test/output',
        typesPath: '/test/types',
      },
    }

    plugin = definePlugin()
  })

  it('should have the correct name', () => {
    expect(plugin.name).toBe(pluginEnum.TsType)
  })

  it('should have all required hooks', () => {
    expect(plugin.hooks.buildStart).toBeDefined()
    expect(plugin.hooks.tagStart).toBeDefined()
    expect(plugin.hooks.operation).toBeDefined()
    expect(plugin.hooks.tagEnd).toBeDefined()
    expect(plugin.hooks.componentsSchemas).toBeDefined()
    expect(plugin.hooks.componentsParameters).toBeDefined()
    expect(plugin.hooks.componentsRequestBodies).toBeDefined()
    expect(plugin.hooks.componentsResponses).toBeDefined()
    expect(plugin.hooks.buildEnd).toBeDefined()
  })

  describe('buildStart hook', () => {
    it('should set the component folder path', async () => {
      await plugin.hooks.buildStart(mockCtx)

      // 验证组件文件夹路径是否正确设置
      await plugin.hooks.buildEnd(mockCtx)
      const tsMorph = await import('ts-morph')
      expect(tsMorph.Project().createSourceFile).toHaveBeenCalledWith(path.join('/test/output', 'types', 'enum.model.ts'), '', { overwrite: true })
    })
  })

  describe('operation hook', () => {
    it('should process operations correctly', async () => {
      await plugin.hooks.buildStart(mockCtx)

      const mockTagData = {
        name: 'users',
      }

      await plugin.hooks.tagStart(mockTagData, mockCtx)

      const mockOperation = {
        tagName: 'users',
        accessor: {
          setOperationTSType: vi.fn(),
          operationId: 'getUsers',
          operationName: 'getUsers',
          operation: {
            method: 'GET',
          },
        },
      }

      await plugin.hooks.operation(mockOperation, mockCtx)

      // 验证操作处理
      const collectEnumFormOperation = await import('@/collect/collectEnumFormOperation.ts')
      expect(collectEnumFormOperation.collectEnumFormOperation).toHaveBeenCalledWith(mockOperation)

      // 验证文件创建
      const tsMorph = await import('ts-morph')
      expect(tsMorph.Project().createSourceFile).toHaveBeenCalledWith(path.join('/test/output', 'users', 'getUsers.types.ts'), '', { overwrite: true })

      // 验证设置 TS 类型
      expect(mockOperation.accessor.setOperationTSType).toHaveBeenCalled()

      // 验证 sourceFile 设置
      expect(mockCtx.setSourceFiles).toHaveBeenCalledWith([pluginEnum.TsType, 'users', 'getUsers'], expect.anything())
    })
  })

  describe('componentsSchemas hook', () => {
    it('should process component schemas correctly', async () => {
      await plugin.hooks.buildStart(mockCtx)

      const mockSchemas = {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
          },
        },
      }

      await plugin.hooks.componentsSchemas(mockSchemas, mockCtx)

      // 验证处理了每个 schema
      const buildSchemas = await import('@/builds/components/buildSchemas.ts')
      expect(buildSchemas.buildSchemas).toHaveBeenCalledTimes(2)

      // 验证文件创建
      const tsMorph = await import('ts-morph')
      expect(tsMorph.Project().createSourceFile).toHaveBeenCalledTimes(2)

      // 验证 sourceFile 设置
      expect(mockCtx.setSourceFiles).toHaveBeenCalledWith([pluginEnum.TsType, 'componentsSchemas', 'User'], expect.anything())
      expect(mockCtx.setSourceFiles).toHaveBeenCalledWith([pluginEnum.TsType, 'componentsSchemas', 'Post'], expect.anything())
    })
  })

  describe('componentsParameters hook', () => {
    it('should process component parameters correctly', async () => {
      await plugin.hooks.buildStart(mockCtx)

      const mockParameters = {
        UserParam: {
          in: 'query',
          schema: { type: 'string' },
        },
      }

      await plugin.hooks.componentsParameters(mockParameters, mockCtx)

      // 验证收集了枚举
      const collectEnumsFromDocument = await import('@/collect/collectEnumsFromDocument.ts')
      expect(collectEnumsFromDocument.collectEnumsFromComponentParameters).toHaveBeenCalledWith(mockParameters)

      // 验证构建参数
      const buildComponentParameters = await import('@/builds/components/buildComponentParameters.ts')
      expect(buildComponentParameters.buildComponentParameters).toHaveBeenCalledWith(mockParameters.UserParam, 'UserParam')

      // 验证 sourceFile 设置
      expect(mockCtx.setSourceFiles).toHaveBeenCalledWith([pluginEnum.TsType, 'componentsParameters', 'UserParam'], expect.anything())
    })
  })

  describe('componentsRequestBodies hook', () => {
    it('should process component request bodies correctly', async () => {
      await plugin.hooks.buildStart(mockCtx)

      const mockRequestBodies = {
        UserBody: {
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
      }

      await plugin.hooks.componentsRequestBodies(mockRequestBodies, mockCtx)

      // 验证收集了枚举
      const collectEnumsFromDocument = await import('@/collect/collectEnumsFromDocument.ts')
      expect(collectEnumsFromDocument.collectEnumsFromComponentRequestBody).toHaveBeenCalled()

      // 验证构建请求体
      const buildComponentsRequestBody = await import('@/builds/components/buildComponentsRequestBody.ts')
      expect(buildComponentsRequestBody.buildComponentsRequestBody).toHaveBeenCalledWith('UserBody', mockRequestBodies.UserBody)

      // 验证 sourceFile 设置
      expect(mockCtx.setSourceFiles).toHaveBeenCalledWith([pluginEnum.TsType, 'componentsRequestBodies', 'UserBody'], expect.anything())
    })
  })

  describe('componentsResponses hook', () => {
    it('should process component responses correctly', async () => {
      await plugin.hooks.buildStart(mockCtx)

      const mockResponses = {
        UserResponse: {
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
      }

      await plugin.hooks.componentsResponses(mockResponses, mockCtx)

      // 验证收集了枚举
      const collectEnumsFromDocument = await import('@/collect/collectEnumsFromDocument.ts')
      expect(collectEnumsFromDocument.collectEnumsFromComponentSchema).toHaveBeenCalled()

      // 验证构建响应
      const buildComponentsResponse = await import('@/builds/components/buildComponentsResponse.ts')
      expect(buildComponentsResponse.buildComponentsResponse).toHaveBeenCalledWith(mockResponses.UserResponse, 'ResponseUserResponse')

      // 验证 sourceFile 设置
      expect(mockCtx.setSourceFiles).toHaveBeenCalledWith([pluginEnum.TsType, 'componentsResponses', 'UserResponse'], expect.anything())
    })
  })

  describe('buildEnd hook', () => {
    it('should generate enum model file', async () => {
      await plugin.hooks.buildStart(mockCtx)
      await plugin.hooks.buildEnd(mockCtx)

      // 验证生成了枚举文件
      const buildEnum = await import('@/builds/buildEnum.ts')
      expect(buildEnum.buildEnum).toHaveBeenCalled()

      // 验证创建了枚举源文件
      const tsMorph = await import('ts-morph')
      expect(tsMorph.Project().createSourceFile).toHaveBeenCalledWith(path.join('/test/output', 'types', 'enum.model.ts'), '', { overwrite: true })

      // 验证 sourceFile 设置
      expect(mockCtx.setSourceFiles).toHaveBeenCalledWith([pluginEnum.TsType, 'enum.model'], expect.anything())
    })
  })
})
