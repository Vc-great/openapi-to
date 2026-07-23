import { describe, expect, it } from 'vitest'
import type { Operation } from 'oas/operation'

import { OperationAccessor } from './OperationAccessor.ts'
import { classifyResponseStatusCodes, selectSuccessResponseStatusCode } from './responseStatus.ts'

describe('response status selection', () => {
  it.each([
    [['200'], '200'],
    [['201'], '201'],
    [['202'], '202'],
    [['204'], '204'],
    [['206'], '206'],
    [['2XX'], '2XX'],
    [['default'], 'default'],
    [['default', '206', '201'], '201'],
  ])('selects %j as %s', (codes, expected) => {
    expect(selectSuccessResponseStatusCode(codes)).toBe(expected)
  })

  it('uses default as an error fallback when a documented 2xx exists', () => {
    expect(classifyResponseStatusCodes(['default', '404', '201'])).toEqual({ success: ['201'], error: ['404', 'default'] })
  })

  it('reads the selected success response instead of hard-coding 200', () => {
    const operation = {
      getResponseStatusCodes: () => ['204', '201'],
      getResponseByStatusCode: (code: string) => code === '201' ? { content: { 'application/json': {} } } : { content: { 'text/plain': {} } },
    } as unknown as Operation
    expect(new OperationAccessor(operation).getResponseContentType()).toEqual(['application/json'])
  })
})

describe('OperationAccessor instance isolation', () => {
  it('does not reuse an accessor for a different document with the same path and method', () => {
    const first = { path: '/users/{id}', method: 'get', getOperationId: () => 'targetA' } as unknown as Operation
    const second = { path: '/users/{id}', method: 'get', getOperationId: () => 'targetB' } as unknown as Operation
    const firstAccessor = OperationAccessor.getInstance(first)
    const secondAccessor = OperationAccessor.getInstance(second)
    expect(firstAccessor).not.toBe(secondAccessor)
    expect(firstAccessor.operationId).toBe('targetA')
    expect(secondAccessor.operationId).toBe('targetB')
    expect(OperationAccessor.getInstance(first)).toBe(firstAccessor)
  })
})
