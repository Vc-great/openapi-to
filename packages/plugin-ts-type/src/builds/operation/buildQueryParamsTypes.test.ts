import { buildQueryParamsTypes } from '@/builds/operation/buildQueryParamsTypes'
import * as generatePropertyTypeModule from '@/utils/generatePropertyType'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/generatePropertyType', () => ({
  generateParameterType: vi.fn(),
}))

describe('buildQueryParamsTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该在没有查询参数时返回 undefined', () => {
    const mockOperation = {
      accessor: {
        operationId: 'getUser',
        queryParameters: [],
      },
    }

    const result = buildQueryParamsTypes(mockOperation as any)
    expect(result).toBeUndefined()
    expect(generatePropertyTypeModule.generateParameterType).not.toBeCalled()
  })

  it('应该为查询参数创建类型别名', () => {
    const mockQueryParameters = [
      { name: 'page', schema: { type: 'number' } },
      { name: 'limit', schema: { type: 'number' } },
      { name: 'search', schema: { type: 'string' } },
    ]

    const mockOperation = {
      accessor: {
        operationId: 'listUsers',
        operationName: 'listUsers',
        queryParameters: mockQueryParameters,
      },
    }

    const mockGeneratedType = `{
      page: number,
      limit: number,
      search: string,
    }`

    vi.mocked(generatePropertyTypeModule.generateParameterType).mockReturnValue(mockGeneratedType)

    const result = buildQueryParamsTypes(mockOperation as any)

    expect(generatePropertyTypeModule.generateParameterType).toBeCalledWith(mockQueryParameters, 'listUsers')
    expect(result).toBeDefined()

    // 注意函数使用 upperFirst 而不是 camelCase
    expect(result?.name).toEqual('ListUsersQueryParams')
  })
})
