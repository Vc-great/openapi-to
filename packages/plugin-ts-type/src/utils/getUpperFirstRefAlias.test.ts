import * as coreUtils from '@openapi-to/core/utils'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getUpperFirstRefAlias } from './getUpperFirstRefAlias'

// 模拟 getRefAlias 函数
vi.mock('@openapi-to/core/utils', () => ({
  getRefAlias: vi.fn(),
}))

describe('getUpperFirstRefAlias 函数测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('当 $ref 包含 parameters 时应返回带 Parameter 前缀的结果', () => {
    ;(coreUtils.getRefAlias as any).mockReturnValue('user')

    const result = getUpperFirstRefAlias('#/components/parameters/User')

    expect(coreUtils.getRefAlias).toHaveBeenCalledWith('#/components/parameters/User')
    expect(result).toBe('ParameterUserModel')
  })

  test('当 $ref 包含 requestBodies 时应返回带 RequestBodies 前缀的结果', () => {
    ;(coreUtils.getRefAlias as any).mockReturnValue('product')

    const result = getUpperFirstRefAlias('#/components/requestBodies/Product')

    expect(coreUtils.getRefAlias).toHaveBeenCalledWith('#/components/requestBodies/Product')
    expect(result).toBe('RequestBodiesProductModel')
  })

  test('当 $ref 包含 responses 时应返回带 Responses 前缀的结果', () => {
    ;(coreUtils.getRefAlias as any).mockReturnValue('error')

    const result = getUpperFirstRefAlias('#/components/responses/Error')

    expect(coreUtils.getRefAlias).toHaveBeenCalledWith('#/components/responses/Error')
    expect(result).toBe('ResponsesErrorModel')
  })

  test('当 $ref 包含未知组件类型时应返回不带前缀的结果', () => {
    ;(coreUtils.getRefAlias as any).mockReturnValue('schema')

    const result = getUpperFirstRefAlias('#/components/schemas/Schema')

    expect(coreUtils.getRefAlias).toHaveBeenCalledWith('#/components/schemas/Schema')
    expect(result).toBe('SchemaModel')
  })

  test('当 $ref 没有足够部分时应正确处理', () => {
    ;(coreUtils.getRefAlias as any).mockReturnValue('simple')

    const result = getUpperFirstRefAlias('simple')

    expect(coreUtils.getRefAlias).toHaveBeenCalledWith('simple')
    expect(result).toBe('SimpleModel')
  })
})
