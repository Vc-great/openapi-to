import { buildQueryParamsSchemas } from '@/builds/operation/buildQueryParamsSchemas.ts'
import * as generateParameterSchemaModule from '@/utils/generateParameterSchema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/generateParameterSchema', () => ({
  generateParameterSchema: vi.fn(),
}))

describe('buildQueryParamsSchemas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该在没有查询参数时返回 undefined', () => {
    const mockOperation = {
      accessor: {
        operationId: 'getUser',
        operationName: 'getUser',
        queryParameters: [],
      },
    }

    const result = buildQueryParamsSchemas(mockOperation as any)
    expect(result).toBeUndefined()
    expect(generateParameterSchemaModule.generateParameterSchema).not.toBeCalled()
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
      page: z.number(),
      limit: z.number(),
      search: z.string(),
    }`

    vi.mocked(generateParameterSchemaModule.generateParameterSchema).mockReturnValue(mockGeneratedType)

    const result = buildQueryParamsSchemas(mockOperation as any)

    expect(generateParameterSchemaModule.generateParameterSchema).toBeCalledWith(mockQueryParameters, 'listUsers')
    expect(result).toBeDefined()

    // 注意函数使用 upperFirst 而不是 camelCase
    expect(result?.declarations[0].name).toEqual('listUsersQueryParamsSchema')
  })
})
