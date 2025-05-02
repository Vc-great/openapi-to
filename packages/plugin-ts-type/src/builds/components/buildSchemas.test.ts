//@ts-nocheck
import * as jsDocTemplateModule from '@/templates/jsDocTemplateFromSchema'
import * as getUpperFirstRefAliasModule from '@/utils/getUpperFirstRefAlias'
import type { ComponentsSchema } from '@openapi-to/core'
import { StructureKind } from 'ts-morph'
//@ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as buildSchemaPropertiesTypesModule from './buildSchemaPropertiesTypes'
import { buildSchemas } from './buildSchemas'

vi.mock('./buildSchemaPropertiesTypes')
vi.mock('@/templates/jsDocTemplateFromSchema')
vi.mock('@/utils/getUpperFirstRefAlias')

describe('buildSchemas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(buildSchemaPropertiesTypesModule.buildSchemaPropertiesTypes).mockReturnValue([
      { name: 'id', type: 'string' },
      { name: 'name?', type: 'string' },
    ])
    vi.mocked(jsDocTemplateModule.jsDocTemplateFromSchema).mockReturnValue(['jsdoc'])
    vi.mocked(getUpperFirstRefAliasModule.getUpperFirstRefAlias).mockImplementation((ref) => {
      return `Ref${ref.split('/').pop()}`
    })
  })

  it('should return empty array when schema is not an object or null', () => {
    expect(buildSchemas('test', null as unknown as ComponentsSchema)).toEqual([])
    expect(buildSchemas('test', 'string' as unknown as ComponentsSchema)).toEqual([])
  })

  it('should create a type alias for referenced schemas', () => {
    const schema: ComponentsSchema = {
      $ref: '#/components/schemas/User',
    }

    const result = buildSchemas('user', schema)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: StructureKind.TypeAlias,
      name: 'UserModel',
      isExported: true,
      type: 'RefUser',
    })
  })

  it('should create an interface for object schema with properties', () => {
    const schema: ComponentsSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      description: 'User model',
    }

    const result = buildSchemas('user', schema)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: StructureKind.Interface,
      name: 'UserModel',
      isExported: true,
      docs: ['jsdoc'],
      properties: [
        { name: 'id', type: 'string' },
        { name: 'name?', type: 'string' },
      ],
    })
  })

  it('should handle object schema with empty properties', () => {
    vi.mocked(buildSchemaPropertiesTypesModule.buildSchemaPropertiesTypes).mockReturnValue([])

    const schema: ComponentsSchema = {
      type: 'object',
      properties: {},
    }

    const result = buildSchemas('empty', schema)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: StructureKind.Interface,
      name: 'EmptyModel',
      properties: [],
    })
  })

  it('should handle object schema when properties return undefined', () => {
    vi.mocked(buildSchemaPropertiesTypesModule.buildSchemaPropertiesTypes).mockReturnValue(undefined)

    const schema: ComponentsSchema = {
      type: 'object',
      properties: {},
    }

    const result = buildSchemas('empty', schema)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: StructureKind.Interface,
      name: 'EmptyModel',
      properties: [],
    })
  })
})
