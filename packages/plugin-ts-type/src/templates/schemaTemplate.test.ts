//@ts-nocheck
import type { SchemaObject } from 'oas/types'
import { describe, expect, it } from 'vitest'
import { schemaTemplate } from './schemaTemplate'

describe('schemaTemplate', () => {
  /*  it('should return "unknown" for undefined schema', () => {
    expect(schemaTemplate(undefined, 'testProperty')).toBe('unknown')
  })*/

  it('should handle $ref schema', () => {
    const schema: SchemaObject = { $ref: '#/components/schemas/TestRef' }
    expect(schemaTemplate(schema, 'testProperty')).toBe('TestRefModel')
  })

  it('should handle enum schema', () => {
    const schema: SchemaObject = { type: 'string', enum: ['value1', 'value2'] }
    expect(schemaTemplate(schema, 'testProperty')).toBe('TestPropertyEnumValue')
  })

  it('should handle oneOf schema', () => {
    const schema: SchemaObject = {
      oneOf: [{ type: 'string' }, { type: 'number' }],
    }
    expect(schemaTemplate(schema, 'testProperty')).toBe('string | number')
  })

  it('should handle allOf schema', () => {
    const schema: SchemaObject = {
      allOf: [{ type: 'string' }, { type: 'number' }],
    }
    expect(schemaTemplate(schema, 'testProperty')).toBe('string & number')
  })

  it('should handle nullable schema', () => {
    const schema: SchemaObject = { type: 'string', nullable: true }
    expect(schemaTemplate(schema, 'testProperty')).toBe('string | null')
  })

  it('should handle array schema', () => {
    const schema: SchemaObject = { type: 'array', items: { type: 'string' } }
    expect(schemaTemplate(schema, 'testProperty')).toBe('Array<string>')
  })

  it('should handle object schema with properties', () => {
    const schema: SchemaObject = {
      type: 'object',
      properties: {
        key1: { type: 'string' },
        key2: { type: 'number' },
      },
    }
    expect(schemaTemplate(schema, 'testProperty')).toBe(`{
    key1?: string;
    key2?: number;
}`)
  })

  it('should handle object schema without properties', () => {
    const schema: SchemaObject = { type: 'object' }
    expect(schemaTemplate(schema, 'testProperty')).toBe('Record<string, unknown>')
  })

  it('should return "unknown" for unsupported types', () => {
    const schema: SchemaObject = { type: 'unsupportedType' }
    expect(schemaTemplate(schema, 'testProperty')).toBe('unknown')
  })
})
