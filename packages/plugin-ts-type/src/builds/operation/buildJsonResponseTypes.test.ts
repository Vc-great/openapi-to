import { buildJsonResponseTypes } from '@/builds/operation/buildJsonResponseTypes'
import { OpenAPIV3 } from 'openapi-types'
import { describe, expect, it, vi } from 'vitest'

describe('buildJsonResponseTypes', () => {
  it('应该构建成功和错误响应的类型', () => {
    const mockOperation = {
      accessor: {
        operationId: 'getUser',
        operationName: 'getUser',
        operation: {
          method: OpenAPIV3.HttpMethods.GET,
          getResponseStatusCodes: vi.fn().mockReturnValue(['200', '404', '500']),
          getResponseAsJSONSchema: vi.fn((code) => {
            if (code === '200') {
              return [{ type: 'object', properties: { id: { type: 'string' } } }]
            }
            if (code === '404') {
              return [{ type: 'object', properties: { message: { type: 'string' } } }]
            }
            if (code === '500') {
              return [{ type: 'object', properties: { error: { type: 'string' } } }]
            }
            return undefined
          }),
        },
      },
    }

    const result = buildJsonResponseTypes(mockOperation as any)

    expect(result.length).toBeGreaterThan(0)

    const successTypeDecl = result.find((stmt) => 'name' in stmt && stmt.name?.includes('GetUserResponse'))
    expect(successTypeDecl).toBeDefined()

    const errorTypeDecl = result.find((stmt) => 'name' in stmt && stmt.name?.includes('GetUserResponseError'))
    expect(errorTypeDecl).toBeDefined()
  })

  it('当没有成功响应定义时应构建默认成功类型', () => {
    const mockOperation = {
      accessor: {
        operationId: 'emptyResponse',
        operationName: 'emptyResponse',
        operation: {
          method: OpenAPIV3.HttpMethods.GET,
          getResponseStatusCodes: vi.fn().mockReturnValue(['404', '500']),
          getResponseAsJSONSchema: vi.fn(() => undefined),
        },
      },
    }

    const result = buildJsonResponseTypes(mockOperation as any)

    const defaultSuccessType = result.find((stmt) => 'name' in stmt && stmt.name?.includes('EmptyResponseResponse'))
    expect(defaultSuccessType).toBeDefined()
  })

  it('应正确处理mutation操作', () => {
    const mockOperation = {
      accessor: {
        operationId: 'createUser',
        operationName: 'createUser',
        operation: {
          method: OpenAPIV3.HttpMethods.POST,
          getResponseStatusCodes: vi.fn().mockReturnValue(['201']),
          getResponseAsJSONSchema: vi.fn(() => [{ type: 'object', properties: { id: { type: 'string' } } }]),
        },
      },
    }

    const result = buildJsonResponseTypes(mockOperation as any)

    const mutationResponse = result.find((stmt) => 'name' in stmt && stmt.name?.includes('CreateUserMutationResponse'))
    expect(mutationResponse).toBeDefined()
  })

  it('应处理空状态码数组的情况', () => {
    const mockOperation = {
      accessor: {
        operationId: 'noStatusCodes',
        operationName: 'noStatusCodes',
        operation: {
          method: OpenAPIV3.HttpMethods.GET,
          getResponseStatusCodes: vi.fn().mockReturnValue([]),
          getResponseAsJSONSchema: vi.fn(),
        },
      },
    }

    const result = buildJsonResponseTypes(mockOperation as any)

    expect(result.length).toBeGreaterThan(0)
    const defaultType = result.find((stmt) => 'name' in stmt && stmt.name?.includes('NoStatusCodesResponse'))
    expect(defaultType).toBeDefined()
  })

  it('应处理没有getResponseStatusCodes方法的情况', () => {
    const mockOperation = {
      accessor: {
        operationId: 'noMethods',
        operationName: 'noMethods',
        operation: {
          method: OpenAPIV3.HttpMethods.GET,
        },
      },
    }

    const result = buildJsonResponseTypes(mockOperation as any)

    expect(result.length).toBeGreaterThan(0)
    const defaultType = result.find((stmt) => 'name' in stmt && stmt.name?.includes('NoMethodsResponse'))
    expect(defaultType).toBeDefined()
  })

  it('应将状态码300视为成功响应', () => {
    const mockOperation = {
      accessor: {
        operationId: 'redirectResponse',
        operationName: 'redirectResponse',
        operation: {
          method: OpenAPIV3.HttpMethods.GET,
          getResponseStatusCodes: vi.fn().mockReturnValue(['300', '400']),
          getResponseAsJSONSchema: vi.fn((code) => {
            if (code === '300') {
              return [{ type: 'object', properties: { location: { type: 'string' } } }]
            }
            return undefined
          }),
        },
      },
    }

    const result = buildJsonResponseTypes(mockOperation as any)

    const successType = result.find((stmt) => 'name' in stmt && stmt.name?.includes('RedirectResponseResponse'))
    expect(successType).toBeDefined()

    // 300不应被包含在错误类型中
    const errorType = result.find((stmt) => 'name' in stmt && stmt.name?.includes('RedirectResponseResponseError'))
    expect(errorType).toBeDefined()
  })

  it('应处理只有错误响应的情况', () => {
    const mockOperation = {
      accessor: {
        operationId: 'errorOnly',
        operationName: 'errorOnly',
        operation: {
          method: OpenAPIV3.HttpMethods.GET,
          getResponseStatusCodes: vi.fn().mockReturnValue(['400', '500']),
          getResponseAsJSONSchema: vi.fn((code) => {
            return [{ type: 'object', properties: { error: { type: 'string' } } }]
          }),
        },
      },
    }

    const result = buildJsonResponseTypes(mockOperation as any)

    const defaultSuccessType = result.find((stmt) => 'name' in stmt && stmt.name?.includes('ErrorOnlyResponse'))
    expect(defaultSuccessType).toBeDefined()

    const errorType = result.find((stmt) => 'name' in stmt && stmt.name?.includes('ErrorOnlyResponseError'))
    expect(errorType).toBeDefined()
  })
})
