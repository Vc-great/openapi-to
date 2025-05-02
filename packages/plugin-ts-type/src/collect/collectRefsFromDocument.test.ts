//@ts-nocheck
import { describe, expect, it, vi } from 'vitest'
import * as collectRefsFromSchemasModule from '../collect/collectRefsFromSchemas'
import {
  collectRefsFromComponentParameters,
  collectRefsFromComponentRequestBody,
  collectRefsFromComponentResponse,
  collectRefsFromOperationParameter,
  collectRefsFromOperationRequestBody,
  collectRefsFromOperationResponse,
} from './collectRefsFromDocument'

describe('collectRefsFromDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  vi.mock('../collect/collectRefsFromSchemas', () => ({
    collectRefsFromSchema: vi.fn().mockImplementation((schema) => {
      if (schema && schema.type === 'object') {
        return ['#/components/schemas/RefFromObject']
      }
      if (schema && schema.type === 'array') {
        return ['#/components/schemas/RefFromArray']
      }

      if (schema && '$ref' in schema && schema.$ref) {
        return [schema.$ref]
      }

      return []
    }),
  }))

  describe('collectRefsFromOperationParameter', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })
    it('应该从参数引用中收集引用', () => {
      const parameters = [
        { $ref: '#/components/parameters/Param1' },
        { $ref: '#/components/parameters/Param2' },
        { name: 'filter', schema: { $ref: '#/components/schemas/Filter' } },
      ]

      const result = collectRefsFromOperationParameter(parameters)

      expect(result).toContain('#/components/parameters/Param1')
      expect(result).toContain('#/components/parameters/Param2')
      expect(result).toContain('#/components/schemas/Filter')
      expect(result).toHaveLength(3)
    })

    it('应该从参数模式中收集深层引用', () => {
      const parameters = [
        { name: 'object', schema: { type: 'object' } },
        { name: 'array', schema: { type: 'array' } },
      ]

      const result = collectRefsFromOperationParameter(parameters)

      expect(collectRefsFromSchemasModule.collectRefsFromSchema).toHaveBeenCalledTimes(2)
      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toContain('#/components/schemas/RefFromArray')
      expect(result).toHaveLength(2)
    })

    it('应该处理没有模式的参数', () => {
      const parameters = [{ name: 'noSchema' }]
      const result = collectRefsFromOperationParameter(parameters)
      expect(result).toHaveLength(0)
    })
  })

  describe('collectRefsFromOperationRequestBody', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })
    it('应该处理请求体引用', () => {
      const oasOperation = {
        schema: {
          requestBody: { $ref: '#/components/requestBodies/UserBody' },
        },
        getRequestBody: vi.fn(),
      }

      const result = collectRefsFromOperationRequestBody(oasOperation)

      expect(result).toContain('#/components/requestBodies/UserBody')
      expect(result).toHaveLength(1)
    })

    it('应该从请求体模式中收集引用', () => {
      const oasOperation = {
        schema: {
          requestBody: {},
        },
        getRequestBody: vi.fn().mockReturnValue({
          schema: { $ref: '#/components/schemas/User' },
        }),
      }

      const result = collectRefsFromOperationRequestBody(oasOperation)

      expect(result).toContain('#/components/schemas/User')
      expect(result).toHaveLength(1)
    })

    it('应该从请求体模式中收集深层引用', () => {
      const oasOperation = {
        schema: {
          requestBody: {},
        },
        getRequestBody: vi.fn().mockReturnValue({
          schema: { type: 'object' },
        }),
      }

      const result = collectRefsFromOperationRequestBody(oasOperation)

      expect(collectRefsFromSchemasModule.collectRefsFromSchema).toHaveBeenCalledTimes(1)
      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toHaveLength(1)
    })

    it('应该处理数组形式的请求体', () => {
      const oasOperation = {
        schema: {
          requestBody: {},
        },
        getRequestBody: vi.fn().mockReturnValue(['application/json', { schema: { type: 'object' } }]),
      }

      const result = collectRefsFromOperationRequestBody(oasOperation)

      expect(collectRefsFromSchemasModule.collectRefsFromSchema).toHaveBeenCalledTimes(1)
      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toHaveLength(1)
    })
  })

  describe('collectRefsFromOperationResponse', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })
    it('应该从响应中收集引用', () => {
      const oasOperation = {
        getResponseStatusCodes: vi.fn().mockReturnValue(['200', '404']),
        getResponseAsJSONSchema: vi.fn().mockImplementation((statusCode) => {
          if (statusCode === '200') {
            return [{ schema: { $ref: '#/components/schemas/Success' } }]
          }
          return [{ schema: { $ref: '#/components/schemas/Error' } }]
        }),
      }

      const result = collectRefsFromOperationResponse(oasOperation)

      expect(collectRefsFromSchemasModule.collectRefsFromSchema).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })

    it('应该处理复杂响应模式', () => {
      const oasOperation = {
        getResponseStatusCodes: vi.fn().mockReturnValue(['200']),
        getResponseAsJSONSchema: vi.fn().mockReturnValue([{ schema: { type: 'object' } }, { schema: { type: 'array' } }]),
      }

      const result = collectRefsFromOperationResponse(oasOperation)

      expect(collectRefsFromSchemasModule.collectRefsFromSchema).toHaveBeenCalledTimes(2)
      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toContain('#/components/schemas/RefFromArray')
      expect(result).toHaveLength(2)
    })

    it('应该处理空响应', () => {
      const oasOperation = {
        getResponseStatusCodes: vi.fn().mockReturnValue(['204']),
        getResponseAsJSONSchema: vi.fn().mockReturnValue(null),
      }

      const result = collectRefsFromOperationResponse(oasOperation)

      expect(result).toHaveLength(0)
    })
  })

  describe('collectRefsFromComponentParameters', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })
    it('应该从组件参数中收集引用', () => {
      const parameters = {
        Param1: { $ref: '#/components/parameters/BaseParam' },
        Param2: { schema: { $ref: '#/components/schemas/Filter' } },
        Param3: { schema: { type: 'object' } },
      }

      const result = collectRefsFromComponentParameters(parameters)

      expect(result).toContain('#/components/parameters/BaseParam')
      expect(result).toContain('#/components/schemas/Filter')
      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toHaveLength(3)
    })
  })

  describe('collectRefsFromComponentRequestBody', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })
    it('应该处理引用请求体', () => {
      const rb = { $ref: '#/components/requestBodies/BaseBody' }
      const result = collectRefsFromComponentRequestBody(rb)
      expect(result).toContain('#/components/requestBodies/BaseBody')
      expect(result).toHaveLength(1)
    })

    it('应该从内容中收集模式引用', () => {
      const rb = {
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/User' } },
          'application/xml': { schema: { type: 'object' } },
        },
      }

      const result = collectRefsFromComponentRequestBody(rb)

      expect(result).toContain('#/components/schemas/User')
      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toHaveLength(2)
    })

    it('应该处理没有内容的请求体', () => {
      const rb = {}
      const result = collectRefsFromComponentRequestBody(rb)
      expect(result).toHaveLength(0)
    })
  })

  describe('collectRefsFromComponentResponse', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })
    it('应该处理引用响应', () => {
      const response = { $ref: '#/components/responses/BaseResponse' }
      const result = collectRefsFromComponentResponse(response)
      expect(result).toContain('#/components/responses/BaseResponse')
      expect(result).toHaveLength(1)
    })

    it('应该从内容中收集模式引用', () => {
      const response = {
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/Success' } },
          'application/xml': { schema: { type: 'object' } },
        },
      }

      const result = collectRefsFromComponentResponse(response)

      expect(result).toContain('#/components/schemas/Success')
      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toHaveLength(2)
    })

    it('应该从头部中收集引用', () => {
      const response = {
        headers: {
          'X-Rate-Limit': { $ref: '#/components/headers/RateLimit' },
          'X-Pagination': { schema: { $ref: '#/components/schemas/Pagination' } },
        },
      }

      const result = collectRefsFromComponentResponse(response)

      expect(result).toContain('#/components/headers/RateLimit')
      expect(result).toContain('#/components/schemas/Pagination')
      expect(result).toHaveLength(2)
    })

    it('应该从头部模式中收集深层引用', () => {
      const response = {
        headers: {
          'X-Meta': { schema: { type: 'object' } },
        },
      }

      const result = collectRefsFromComponentResponse(response)

      expect(result).toContain('#/components/schemas/RefFromObject')
      expect(result).toHaveLength(1)
    })
  })
})
