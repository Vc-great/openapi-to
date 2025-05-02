//@ts-nocheck
import { describe, expect, it } from 'vitest'
import { collectRefsFromSchema } from './collectRefsFromSchemas'

describe('collectRefsFromSchema', () => {
  it('应该收集直接的 $ref 引用', () => {
    const schema = {
      $ref: '#/components/schemas/User',
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toEqual(['#/components/schemas/User'])
    expect(refs).toHaveLength(1)
  })

  it('应该收集对象属性中的 $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        order: { $ref: '#/components/schemas/Order' },
        simple: { type: 'string' },
      },
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toContain('#/components/schemas/User')
    expect(refs).toContain('#/components/schemas/Order')
    expect(refs).toHaveLength(2)
  })

  it('应该收集数组项中的 $ref', () => {
    const schema = {
      type: 'array',
      items: { $ref: '#/components/schemas/Item' },
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toEqual(['#/components/schemas/Item'])
    expect(refs).toHaveLength(1)
  })

  it('应该收集数组项数组中的 $ref', () => {
    const schema = {
      type: 'array',
      items: [{ $ref: '#/components/schemas/Item1' }, { $ref: '#/components/schemas/Item2' }],
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toContain('#/components/schemas/Item1')
    expect(refs).toContain('#/components/schemas/Item2')
    expect(refs).toHaveLength(2)
  })

  it('应该收集 allOf 中的 $ref', () => {
    const schema = {
      allOf: [{ $ref: '#/components/schemas/Base' }, { type: 'object', properties: { name: { type: 'string' } } }],
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toEqual(['#/components/schemas/Base'])
    expect(refs).toHaveLength(1)
  })

  it('应该收集 anyOf 中的 $ref', () => {
    const schema = {
      anyOf: [{ $ref: '#/components/schemas/Option1' }, { $ref: '#/components/schemas/Option2' }],
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toContain('#/components/schemas/Option1')
    expect(refs).toContain('#/components/schemas/Option2')
    expect(refs).toHaveLength(2)
  })

  it('应该收集 oneOf 中的 $ref', () => {
    const schema = {
      oneOf: [{ $ref: '#/components/schemas/Option1' }, { $ref: '#/components/schemas/Option2' }],
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toContain('#/components/schemas/Option1')
    expect(refs).toContain('#/components/schemas/Option2')
    expect(refs).toHaveLength(2)
  })

  it('应该收集 not 中的 $ref', () => {
    const schema = {
      not: { $ref: '#/components/schemas/Invalid' },
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toEqual(['#/components/schemas/Invalid'])
    expect(refs).toHaveLength(1)
  })

  it('应该收集 additionalProperties 中的 $ref', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      additionalProperties: { $ref: '#/components/schemas/Property' },
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toEqual(['#/components/schemas/Property'])
    expect(refs).toHaveLength(1)
  })

  it('应该处理复杂嵌套的 schema', () => {
    const schema = {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        orders: {
          type: 'array',
          items: { $ref: '#/components/schemas/Order' },
        },
        preferences: {
          oneOf: [{ $ref: '#/components/schemas/Preferences' }, { type: 'null' }],
        },
        metadata: {
          allOf: [
            { $ref: '#/components/schemas/BaseMetadata' },
            {
              type: 'object',
              properties: {
                tags: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Tag' },
                },
              },
            },
          ],
        },
        additionalProperties: { $ref: '#/components/schemas/GenericProperty' },
      },
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toContain('#/components/schemas/User')
    expect(refs).toContain('#/components/schemas/Order')
    expect(refs).toContain('#/components/schemas/Preferences')
    expect(refs).toContain('#/components/schemas/BaseMetadata')
    expect(refs).toContain('#/components/schemas/Tag')
    expect(refs).toContain('#/components/schemas/GenericProperty')
    expect(refs).toHaveLength(6)
  })

  it('应该处理边缘情况 - null 和 undefined', () => {
    expect(collectRefsFromSchema(null)).toEqual([])
    expect(collectRefsFromSchema(undefined)).toEqual([])
  })

  it('应该处理边缘情况 - 非对象值', () => {
    expect(collectRefsFromSchema('string' as any)).toEqual([])
    expect(collectRefsFromSchema(123 as any)).toEqual([])
    expect(collectRefsFromSchema(true as any)).toEqual([])
  })

  it('应该处理布尔类型的 items', () => {
    const schema = {
      type: 'array',
      items: true,
    }

    const refs = collectRefsFromSchema(schema)
    expect(refs).toEqual([])
  })

  it('应该处理布尔类型的 not', () => {
    const schema = {
      not: false,
    }

    const refs = collectRefsFromSchema(schema)
    expect(refs).toEqual([])
  })

  it('应该在找到 $ref 后不继续递归', () => {
    const schema = {
      $ref: '#/components/schemas/User',
      // 这些属性不应该被遍历，因为找到了 $ref
      properties: {
        nested: { $ref: '#/components/schemas/Nested' },
      },
    }

    const refs = collectRefsFromSchema(schema)

    expect(refs).toEqual(['#/components/schemas/User'])
    expect(refs).not.toContain('#/components/schemas/Nested')
    expect(refs).toHaveLength(1)
  })
})
