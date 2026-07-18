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

  it('emits one redacted JSON object per line and honors log level', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const logger = createStderrLogger({ format: 'json', level: 'warn' })
    logger.info('ignored', { value: 1 })
    logger.warn('tool completed', { tool: 'openapi_validate', url: 'https://user:pass@example.test/spec?token=secret', content: 'hidden' })
    expect(write).toHaveBeenCalledTimes(1)
    const output = String(write.mock.calls[0]?.[0])
    expect(() => JSON.parse(output)).not.toThrow()
    expect(output).toContain('tool completed')
    expect(output).not.toContain('pass')
    expect(output).not.toContain('token=secret')
    expect(output).not.toContain('hidden')
  })
})
