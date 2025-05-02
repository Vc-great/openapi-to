//@ts-nocheck
import { StructureKind } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import type { EnumItem } from '../EnumRegistry'
import { buildEnum } from './buildEnum'

describe('buildEnum', () => {
  it('should generate correct statements for a basic enum', () => {
    const enumItems: EnumItem[] = [
      {
        name: 'Status',
        enumValue: ['ACTIVE', 'INACTIVE', 'PENDING'],
      },
    ]

    const result = buildEnum(enumItems)

    // 应该生成3个语句：常量声明、值类型和项类型
    expect(result).toHaveLength(3)

    // 检查第一个语句 - 常量声明
    const varStatement = result[0]!
    expect(varStatement.kind).toBe(StructureKind.VariableStatement)
    expect(varStatement.isExported).toBe(true)
    expect(varStatement.declarations).toHaveLength(1)
    expect(varStatement.declarations[0].name).toBe('status')

    // 检查第二个语句 - 值类型声明
    const valueTypeStatement = result[1]!
    expect(valueTypeStatement.kind).toBe(StructureKind.TypeAlias)
    expect(valueTypeStatement.isExported).toBe(true)
    expect(valueTypeStatement.name).toBe('StatusValue')
    expect(valueTypeStatement.type).toBe("(typeof status)[keyof typeof status]['value']")

    // 检查第三个语句 - 项类型声明
    const itemTypeStatement = result[2]!
    expect(itemTypeStatement.kind).toBe(StructureKind.TypeAlias)
    expect(itemTypeStatement.isExported).toBe(true)
    expect(itemTypeStatement.name).toBe('StatusItem')
    expect(itemTypeStatement.type).toBe('(typeof status)[keyof typeof status]')
  })

  it('should generate statements with description', () => {
    const enumItems: EnumItem[] = [
      {
        name: 'Status',
        enumValue: ['ACTIVE', 'INACTIVE'],
        description: 'User status options',
      },
    ]

    const result = buildEnum(enumItems)

    // 值类型声明应该包含文档注释
    const valueTypeStatement = result[1]
    expect(valueTypeStatement.docs).toBeDefined()

    // 项类型声明也应该包含文档注释
    const itemTypeStatement = result[2]!
    expect(itemTypeStatement.docs).toBeDefined()
  })

  it('should generate statements with extend', () => {
    const enumItems: EnumItem[] = [
      {
        name: 'ExtendedStatus',
        enumValue: ['ACTIVE', 'INACTIVE'],
        extend: 'BaseStatus',
      },
    ]

    const result = buildEnum(enumItems)

    // 检查常量声明的初始化器
    const varStatement = result[0]
    expect(varStatement.kind).toBe(StructureKind.VariableStatement)
    expect(varStatement.declarations[0].initializer).toBe('baseStatus')
  })

  it('should handle empty array', () => {
    const result = buildEnum([])

    expect(result).toEqual([])
  })

  it('should handle non-array enumValue', () => {
    const enumItems: EnumItem[] = [
      {
        name: 'Status',
        enumValue: 'NOT_AN_ARRAY' as any,
      },
    ]

    const result = buildEnum(enumItems)

    expect(result).toEqual([])
  })

  it('should handle multiple enum items', () => {
    const enumItems: EnumItem[] = [
      {
        name: 'Status',
        enumValue: ['ACTIVE', 'INACTIVE'],
      },
      {
        name: 'Role',
        enumValue: ['ADMIN', 'USER', 'GUEST'],
      },
    ]

    const result = buildEnum(enumItems)

    // 应该为每个枚举项生成3个语句，总共6个
    expect(result).toHaveLength(6)

    // 检查第一个枚举的语句
    expect(result[0].kind).toBe(StructureKind.VariableStatement)
    expect(result[0].declarations[0].name).toBe('status')

    // 检查第二个枚举的语句
    expect(result[3].kind).toBe(StructureKind.VariableStatement)
    expect(result[3].declarations[0].name).toBe('role')
  })
})
