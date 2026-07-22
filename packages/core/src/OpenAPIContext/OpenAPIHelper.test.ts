import { describe, expect, it } from 'vitest'
import Oas from 'oas'

import { OpenAPIHelper } from './OpenAPIHelper.ts'

describe('OpenAPIHelper operation grouping', () => {
  it('groups an operation without tags under default', () => {
    const helper = new OpenAPIHelper(new Oas({
      openapi: '3.1.0',
      info: { title: 'untagged', version: '1' },
      paths: { '/health': { get: { operationId: 'health', responses: { '204': { description: 'ok' } } } } },
    }))
    expect(Object.keys(helper.operationsByTag)).toEqual(['default'])
    expect(helper.operationsByTag.default?.[0]?.accessor.operationId).toBe('health')
  })

  it('uses the same normalized tag key consumed by plugin hooks', () => {
    const helper = new OpenAPIHelper(new Oas({
      openapi: '3.1.0',
      info: { title: 'tagged', version: '1' },
      paths: { '/users': { get: { operationId: 'users', tags: ['User APIs'], responses: { '200': { description: 'ok' } } } } },
    }))
    expect(Object.keys(helper.operationsByTag)).toEqual(['userApIs'])
  })

  it('keeps one accessor per helper while isolating equal paths in other documents', () => {
    const create = (operationId: string) => new OpenAPIHelper(new Oas({
      openapi: '3.1.0',
      info: { title: operationId, version: '1' },
      paths: { '/users': { get: { operationId, responses: { '200': { description: 'ok' } } } } },
    }))
    const first = create('targetA')
    const second = create('targetB')
    expect(first.getOperation('/users', 'get')).toBe(first.getOperation('/users', 'get'))
    expect(first.getOperation('/users', 'get')).not.toBe(second.getOperation('/users', 'get'))
    expect(second.getOperation('/users', 'get')?.operationId).toBe('targetB')
  })

  it('does not treat path-level parameters as an operation', () => {
    const helper = new OpenAPIHelper(new Oas({
      openapi: '3.1.0',
      info: { title: 'parameters', version: '1' },
      paths: {
        '/users/{id}': {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          get: { operationId: 'getUser', responses: { '200': { description: 'ok' } } },
        },
      },
    }))
    expect(helper.getAllOperations().map(({ accessor }) => accessor.operationId)).toEqual(['getUser'])
  })
})
