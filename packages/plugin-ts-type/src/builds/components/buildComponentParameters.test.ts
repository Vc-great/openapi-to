//@ts-nocheck
import { buildComponentParameters } from '@/builds/components/buildComponentParameters.ts'
import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { createTypeAlias } from '@/templates/operationResponseTemplate.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import { describe, expect, it, vi } from 'vitest'

// 模拟依赖
vi.mock('@/utils/getUpperFirstRefAlias', () => ({
  getUpperFirstRefAlias: vi.fn().mockImplementation((ref) => `Mock${ref.split('/').pop()}Type`),
}))

vi.mock('@/templates/operationResponseTemplate', () => ({
  createTypeAlias: vi.fn().mockImplementation((name, type, docs) => ({ name, type, docs })),
}))

vi.mock('@/templates/schemaTemplate', () => ({
  schemaTemplate: vi.fn().mockImplementation((schema, name) => `MockSchemaType_${name}`),
}))

vi.mock('@/templates/jsDocTemplateFromSchema', () => ({
  jsDocTemplateFromSchema: vi.fn().mockImplementation((desc, schema, name) => [`Mock JSDoc for ${name}`]),
}))

describe('buildComponentParameters', () => {
  it('应该处理直接引用的参数', () => {
    const parameter = { $ref: '#/components/parameters/testParam' }
    const result = buildComponentParameters(parameter, 'test')

    expect(getUpperFirstRefAlias).toHaveBeenCalledWith('#/components/parameters/testParam')
    expect(createTypeAlias).toHaveBeenCalledWith('ParameterTestModel', 'MocktestParamType', [])
    expect(result).toEqual({
      name: 'ParameterTestModel',
      type: 'MocktestParamType',
      docs: [],
    })
  })

  it('应该处理带有引用schema的参数', () => {
    const parameter = {
      schema: {
        $ref: '#/components/schemas/testSchema',
      },
    }
    const result = buildComponentParameters(parameter, 'test')

    expect(getUpperFirstRefAlias).toHaveBeenCalledWith('#/components/schemas/testSchema')
    expect(createTypeAlias).toHaveBeenCalledWith('ParameterTestModel', 'MocktestSchemaType', [])
    expect(result).toEqual({
      name: 'ParameterTestModel',
      type: 'MocktestSchemaType',
      docs: [],
    })
  })

  it('应该处理带有内联schema的参数', () => {
    const parameter = {
      description: 'Test parameter description',
      schema: {
        type: 'string',
        description: 'A test string',
      },
    }
    const result = buildComponentParameters(parameter, 'test')

    expect(schemaTemplate).toHaveBeenCalledWith(parameter.schema, 'ParameterTestModel')
    expect(jsDocTemplateFromSchema).toHaveBeenCalledWith('Test parameter description', parameter.schema, 'test')
    expect(createTypeAlias).toHaveBeenCalledWith('ParameterTestModel', 'MockSchemaType_ParameterTestModel', ['Mock JSDoc for test'])
    expect(result).toEqual({
      name: 'ParameterTestModel',
      type: 'MockSchemaType_ParameterTestModel',
      docs: ['Mock JSDoc for test'],
    })
  })

  it('应该返回undefined当参数无效时', () => {
    const result = buildComponentParameters({} as any, 'test')
    expect(result).toBeUndefined()
  })
})
