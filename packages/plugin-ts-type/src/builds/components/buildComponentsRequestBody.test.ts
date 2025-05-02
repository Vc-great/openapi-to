//@ts-nocheck
import { createTypeAlias } from '@/templates/operationResponseTemplate.ts'
import { requestBodyTemplate } from '@/templates/requestBodyTemplate.ts'
import { getRefFileNameFormComponentRequestBodies } from '@/utils/formatterRef.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import { describe, expect, it, vi } from 'vitest'
import { buildComponentsRequestBody } from './buildComponentsRequestBody'
// 模拟依赖
vi.mock('@/utils/formatterRef', () => ({
  getRefFileNameFormComponentRequestBodies: vi.fn().mockImplementation((ref) => `MockFormatted_${ref.split('/').pop()}`),
}))

vi.mock('@/templates/operationResponseTemplate', () => ({
  createTypeAlias: vi.fn().mockImplementation((name, type, docs) => ({ name, type, docs })),
}))

vi.mock('@/templates/requestBodyTemplate', () => ({
  requestBodyTemplate: vi.fn().mockImplementation((name, body) => ({ name, bodyType: 'mocked' })),
}))

describe('buildComponentsRequestBody', () => {
  it('应该处理引用类型的请求体', () => {
    const requestBody = { $ref: '#/components/schemas/testBody' }
    const result = buildComponentsRequestBody('testBody', requestBody)

    expect(createTypeAlias).toHaveBeenCalledWith('RequestBodiesTestBodyModel', 'TestBodyModel', [])
    expect(result).toEqual({
      name: 'RequestBodiesTestBodyModel',
      type: 'TestBodyModel',
      docs: [],
    })
  })

  it('应该处理带有引用schema的请求体', () => {
    const requestBody = {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/testSchema',
          },
        },
      },
    }
    const result = buildComponentsRequestBody('testSchema', requestBody)

    expect(createTypeAlias).toHaveBeenCalledWith('RequestBodiesTestSchemaModel', 'TestSchemaModel', [])
    expect(result).toEqual({
      name: 'RequestBodiesTestSchemaModel',
      type: 'TestSchemaModel',
      docs: [],
    })
  })

  it('应该处理带有数组类型schema的请求体', () => {
    const requestBody = {
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/testSchema',
            },
          },
        },
      },
    }
    const result = buildComponentsRequestBody('testSchema', requestBody)

    expect(createTypeAlias).toHaveBeenCalledWith('RequestBodiesTestSchemaModel', 'TestSchemaModel[]', [])
    expect(result).toEqual({
      name: 'RequestBodiesTestSchemaModel',
      type: 'TestSchemaModel[]',
      docs: [],
    })
  })

  it('应该处理带有非引用数组类型schema的请求体', () => {
    const requestBody = {
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    }
    const result = buildComponentsRequestBody('test', requestBody)

    expect(requestBodyTemplate).toHaveBeenCalledWith('RequestBodiesTestModel', requestBody.content['application/json'])
    expect(result).toEqual({
      name: 'RequestBodiesTestModel',
      bodyType: 'mocked',
    })
  })

  it('应该返回undefined当content为空时', () => {
    const requestBody = { content: {} }
    const result = buildComponentsRequestBody('test', requestBody)
    expect(result).toBeUndefined()
  })
})
