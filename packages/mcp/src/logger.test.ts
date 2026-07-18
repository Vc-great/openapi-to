import process from 'node:process'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createStderrLogger } from './logger.ts'

describe('MCP stderr logger', () => {
  afterEach(() => vi.restoreAllMocks())

  it('bounds messages and redacts URL credentials, queries, and secret-like values', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    createStderrLogger().warn('request https://user:pass@example.com/openapi.yaml?token=secret', {
      detail: 'cookie=session-value',
    })
    const output = String(write.mock.calls[0]?.[0])
    expect(output).toContain('https://example.com/openapi.yaml')
    expect(output).not.toContain('user:pass')
    expect(output).not.toContain('?token=secret')
    expect(output).not.toContain('session-value')
  })
})
