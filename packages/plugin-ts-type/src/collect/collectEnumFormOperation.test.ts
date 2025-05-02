//@ts-nocheck
import { describe, expect, it, vi } from 'vitest'
import { collectEnumFormOperation } from './collectEnumFormOperation'
import * as collectEnumsModule from './collectEnumsFromDocument'

describe('collectEnumFormOperation', () => {
  // 模拟 collectEnumsFromDocument.ts 中的函数
  vi.mock('./collectEnumsFromDocument.ts', () => ({
    collectEnumsFromPathParameters: vi.fn().mockReturnValue(['paramEnum1', 'paramEnum2']),
    collectEnumsFromPathRequestBodies: vi.fn().mockReturnValue(['requestEnum']),
    collectEnumsFromPathResponses: vi.fn().mockImplementation((responses) => {
      if (responses && responses.length > 0) {
        return ['responseEnum']
      }
      return []
    }),
  }))

  it('应该收集操作中的所有枚举', () => {
    // 创建模拟的 OperationWrapper
    const mockOperation = {
      accessor: {
        operationName: 'testOperation',
        parameters: [{ name: 'param1', in: 'query' }],
        operation: {
          getResponseStatusCodes: vi.fn().mockReturnValue(['200', '404']),
          getResponseAsJSONSchema: vi.fn().mockImplementation((statusCode) => {
            if (statusCode === '200') {
              return [{ schema: { type: 'string', enum: ['OK', 'PARTIAL'] } }]
            }
            return [{ schema: { type: 'string', enum: ['NOT_FOUND'] } }]
          }),
          getRequestBody: vi.fn().mockReturnValue({
            schema: { type: 'object', properties: { type: { enum: ['A', 'B'] } } },
          }),
        },
      },
    }

    const result = collectEnumFormOperation(mockOperation)

    // 验证函数调用与结果
    expect(collectEnumsModule.collectEnumsFromPathParameters).toHaveBeenCalledWith(mockOperation.accessor.parameters, mockOperation.accessor.operationName)

    expect(collectEnumsModule.collectEnumsFromPathRequestBodies).toHaveBeenCalledWith(
      mockOperation.accessor.operation.getRequestBody(),
      mockOperation.accessor.operationName,
    )

    // 验证 getResponseAsJSONSchema 被调用了两次，对应两个状态码
    expect(mockOperation.accessor.operation.getResponseAsJSONSchema).toHaveBeenCalledTimes(2)

    // 验证最终结果
    expect(result).toEqual([
      'paramEnum1',
      'paramEnum2', // 参数枚举
      'requestEnum', // 请求体枚举
      'responseEnum',
      'responseEnum', // 响应枚举，每个状态码一个
    ])
  })

  it('应该处理没有响应的情况', () => {
    const mockOperation = {
      accessor: {
        operationName: 'emptyOperation',
        parameters: [],
        operation: {
          getResponseStatusCodes: vi.fn().mockReturnValue([]),
          getResponseAsJSONSchema: vi.fn(),
          getRequestBody: vi.fn().mockReturnValue(false),
        },
      },
    }

    const result = collectEnumFormOperation(mockOperation)

    expect(mockOperation.accessor.operation.getResponseStatusCodes).toHaveBeenCalled()
    expect(mockOperation.accessor.operation.getResponseAsJSONSchema).not.toHaveBeenCalled()

    expect(result).toEqual(['paramEnum1', 'paramEnum2', 'requestEnum'])
  })
})
