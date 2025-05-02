import { buildPathParamsTypes } from '@/builds/operation/buildPathParamsTypes'
import * as generatePropertyTypeModule from '@/utils/generatePropertyType'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/generatePropertyType', () => ({
  generateParameterType: vi.fn(),
}))

describe('buildPathParamsTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该在没有路径参数时返回 undefined', () => {
    const mockOperation = {
      accessor: {
        operationId: 'getUser',
        pathParameters: [],
        operation: {
          getParameters: () => [],
        },
      },
    }

    const result = buildPathParamsTypes(mockOperation as any)
    expect(result).toBeUndefined()
    expect(generatePropertyTypeModule.generateParameterType).not.toBeCalled()
  })

  it('应该为路径参数创建类型别名', () => {
    const mockPathParameters = [
      { name: 'userId', schema: { type: 'string' } },
      { name: 'postId', schema: { type: 'number' } },
    ]

    const mockOperation = {
      accessor: {
        operationId: 'getUserPost',
        operationName: 'getUserPost',
        pathParameters: mockPathParameters,
        operation: {
          getParameters: () => [],
        },
      },
    }

    const mockGeneratedType = `{
      userId: string,
      postId: number,
    }`

    vi.mocked(generatePropertyTypeModule.generateParameterType).mockReturnValue(mockGeneratedType)

    const result = buildPathParamsTypes(mockOperation as any)

    expect(generatePropertyTypeModule.generateParameterType).toBeCalledWith(mockPathParameters, 'getUserPost')

    expect(result).toBeDefined()

    // 注意函数使用 camelCase 而不是 upperFirst
    expect(result?.name).toEqual('GetUserPostPathParams')
  })
})
