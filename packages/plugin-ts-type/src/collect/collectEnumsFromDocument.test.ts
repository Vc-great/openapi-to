//@ts-nocheck
import { describe, expect, it } from 'vitest'
import {
  collectEnumsFromComponentParameters,
  collectEnumsFromComponentRequestBody,
  collectEnumsFromComponentSchema,
  collectEnumsFromPathParameters,
  collectEnumsFromPathRequestBodies,
  collectEnumsFromPathResponses,
  collectEnumsFromSchema,
} from './collectEnumsFromDocument'

describe('collectEnumsFromDocument', () => {
  describe('collectEnumsFromSchema', () => {
    it('应该从字符串枚举中收集枚举项', () => {
      const schema = {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
        description: '状态枚举',
      }

      const result = collectEnumsFromSchema(schema, 'Status')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'Status',
        enumValue: ['ACTIVE', 'INACTIVE', 'PENDING'],
        description: '状态枚举',
      })
    })

    it('应该处理对象属性中的枚举', () => {
      const schema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE'],
          },
          type: {
            type: 'string',
            enum: ['TYPE_A', 'TYPE_B'],
          },
        },
      }

      const result = collectEnumsFromSchema(schema, 'User')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('userStatus')
      expect(result[0].enumValue).toEqual(['ACTIVE', 'INACTIVE'])
      expect(result[1].name).toBe('userType')
      expect(result[1].enumValue).toEqual(['TYPE_A', 'TYPE_B'])
    })

    it('应该处理数组项中的枚举', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'string',
          enum: ['RED', 'GREEN', 'BLUE'],
        },
      }

      const result = collectEnumsFromSchema(schema, 'Colors')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Colors')
      expect(result[0].enumValue).toEqual(['RED', 'GREEN', 'BLUE'])
    })

    it('应该处理 allOf、anyOf、oneOf 中的枚举', () => {
      const schema = {
        allOf: [{ type: 'string', enum: ['ONE', 'TWO'] }, { type: 'object' }],
        anyOf: [{ type: 'string', enum: ['THREE', 'FOUR'] }],
        oneOf: [{ type: 'string', enum: ['FIVE', 'SIX'] }],
      }

      const result = collectEnumsFromSchema(schema, 'Combined')

      expect(result).toHaveLength(3)
      expect(result[0].enumValue).toEqual(['ONE', 'TWO'])
      expect(result[1].enumValue).toEqual(['THREE', 'FOUR'])
      expect(result[2].enumValue).toEqual(['FIVE', 'SIX'])
    })

    it('应该忽略引用类型', () => {
      const schema = { $ref: '#/components/schemas/Status' }
      const result = collectEnumsFromSchema(schema, 'Status')
      expect(result).toHaveLength(0)
    })

    it('应该处理无效输入', () => {
      expect(collectEnumsFromSchema(null, 'Test')).toHaveLength(0)
      expect(collectEnumsFromSchema(undefined, 'Test')).toHaveLength(0)
      expect(collectEnumsFromSchema('string' as any, 'Test')).toHaveLength(0)
    })
  })

  describe('collectEnumsFromPathParameters', () => {
    it('应该从路径参数中收集枚举', () => {
      const parameters = [
        {
          name: 'status',
          schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        },
        {
          name: 'type',
          schema: { type: 'string', enum: ['USER', 'ADMIN'] },
        },
        {
          name: 'reference',
          schema: { $ref: '#/components/schemas/Reference' },
        },
      ]

      const result = collectEnumsFromPathParameters(parameters, 'getUsers')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('getUsersStatus')
      expect(result[1].name).toBe('getUsersType')
    })

    it('应该处理没有 schema 的参数', () => {
      const parameters = [{ name: 'noSchema' }]

      const result = collectEnumsFromPathParameters(parameters, 'getUsers')
      expect(result).toHaveLength(0)
    })
  })

  describe('collectEnumsFromPathRequestBodies', () => {
    it('应该处理布尔值 false 请求体', () => {
      const result = collectEnumsFromPathRequestBodies(false, 'createUser')
      expect(result).toHaveLength(0)
    })

    it('应该处理对象请求体', () => {
      const requestBody = {
        schema: { type: 'string', enum: ['JSON', 'XML'] },
      }

      const result = collectEnumsFromPathRequestBodies(requestBody, 'createUser')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('createUserBody')
    })

    it('应该处理数组请求体', () => {
      const requestBody = [
        'application/json',
        {
          schema: { type: 'string', enum: ['JSON', 'XML'] },
        },
      ]

      const result = collectEnumsFromPathRequestBodies(requestBody, 'createUser')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('createUserBody')
    })

    it('应该处理无schema的请求体', () => {
      const requestBody = { content: {} }
      const result = collectEnumsFromPathRequestBodies(requestBody as any, 'createUser')
      expect(result).toHaveLength(0)
    })
  })

  describe('collectEnumsFromPathResponses', () => {
    it('应该从响应中收集枚举', () => {
      const responses = [
        {
          description: 'Success',
          label: 'OK',
          schema: { type: 'string', enum: ['SUCCESS', 'PARTIAL'] },
          type: 'string',
        },
      ]

      const result = collectEnumsFromPathResponses(responses, 'getUsers')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('getUsersResponse')
      expect(result[0].enumValue).toEqual(['SUCCESS', 'PARTIAL'])
    })

    it('应该处理空响应', () => {
      const result = collectEnumsFromPathResponses(null, 'getUsers')
      expect(result).toHaveLength(0)
    })
  })

  describe('collectEnumsFromComponentParameters', () => {
    it('应该从组件参数中收集枚举', () => {
      const parameters = {
        Status: { schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } },
        Type: { schema: { type: 'string', enum: ['USER', 'ADMIN'] } },
        Reference: { $ref: '#/components/parameters/OtherParam' },
      }

      const result = collectEnumsFromComponentParameters(parameters)
      expect(result).toHaveLength(2)
    })
  })

  describe('collectEnumsFromComponentRequestBody', () => {
    it('应该从组件请求体中收集枚举', () => {
      const requestBody = {
        content: {
          'application/json': {
            schema: { type: 'string', enum: ['JSON', 'XML'] },
          },
        },
      }

      const result = collectEnumsFromComponentRequestBody(requestBody, 'Format')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Format')
    })

    it('应该处理引用类型请求体', () => {
      const requestBody = { $ref: '#/components/requestBodies/UserBody' }
      const result = collectEnumsFromComponentRequestBody(requestBody, 'User')
      expect(result).toHaveLength(0)
    })
  })

  describe('collectEnumsFromComponentSchema', () => {
    it('应该从组件模式中收集枚举', () => {
      const schema = { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] }
      const result = collectEnumsFromComponentSchema(schema, 'Status')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Status')
    })

    it('应该处理引用类型模式', () => {
      const schema = { $ref: '#/components/schemas/Status' }
      const result = collectEnumsFromComponentSchema(schema, 'Status')
      expect(result).toHaveLength(0)
    })
  })
})
