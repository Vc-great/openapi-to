import { buildComponentsRequestBody } from '@/builds/components/buildComponentsRequestBody.ts'
import { describe, expect, it } from 'vitest'
import { requestBodyTemplate } from './requestBodyTemplate.ts'

function typeOf(statement: unknown): string {
  expect(statement).toBeDefined()
  return String((statement as { type?: unknown }).type)
}

describe('request body Media Type Object without schema', () => {
  it('generates unknown for operation and component request body types', () => {
    expect(typeOf(requestBodyTemplate('AnyBody', {}))).toBe('unknown')
    expect(
      typeOf(
        buildComponentsRequestBody('AnyBody', {
          content: { 'application/json': {} },
        } as never),
      ),
    ).toBe('unknown')
  })
})
