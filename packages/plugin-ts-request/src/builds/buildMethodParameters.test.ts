//@ts-nocheck
import { describe, expect, it } from 'vitest'
import { RequestClientEnum } from '../types'
import { buildMethodParameters } from './buildMethodParameters'

describe('buildMethodParameters 函数测试', () => {
  it('应该生成请求体和查询参数', () => {
    const operation = {
      accessor: {
        hasPathParameters: false,
        hasRequestBody: true,
        hasQueryParameters: true,
        isQueryParametersOptional: true,
        parameters: [],
        operationTSType: {
          body: 'Pet',
          queryParams: 'PetQuery',
        },
      },
    }

    const ctx = {} as any

    const result = buildMethodParameters(operation as any, ctx)

    expect(result).toHaveLength(3) // body参数、query参数、requestConfig参数

    const bodyParam = result.find((p) => p.name === 'data')
    expect(bodyParam?.type).toBe('Pet')

    const queryParam = result.find((p) => p.name === 'params')
    expect(queryParam?.type).toBe('PetQuery')
    expect(queryParam?.hasQuestionToken).toBe(true)
  })

  it('应该生成路径参数', () => {
    const operation = {
      accessor: {
        hasPathParameters: true,
        hasRequestBody: false,
        hasQueryParameters: false,
        parameters: [{ in: 'path', name: 'petId' }],
        operationTSType: {
          pathParams: 'PetParams',
        },
      },
    }

    const ctx = {} as any

    const result = buildMethodParameters(operation as any, ctx)

    const pathParam = result.find((p: any) => p.name === 'petId')
    expect(pathParam).toBeDefined()
    expect(pathParam?.type).toContain("PetParams['petId']")
  })

  it('应该生成带有自定义请求配置类型的参数', () => {
    const operation = {
      accessor: {
        hasPathParameters: false,
        hasRequestBody: false,
        hasQueryParameters: false,
        parameters: [],
        operationTSType: () => ({}),
      },
    }

    const ctx = {} as any
    const pluginConfig = {
      requestClient: RequestClientEnum.COMMON,
      requestConfigTypeImportDeclaration: {
        namedImports: ['CustomConfig'],
      },
    }

    const result = buildMethodParameters(operation, pluginConfig)

    const configParam = result.find((p: any) => p.name === 'requestConfig')
    expect(configParam?.type).toBe('Partial<CustomConfig>')
  })
})
