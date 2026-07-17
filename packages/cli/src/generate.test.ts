//@ts-nocheck
import path from 'node:path'

import { LogMapper } from '@openapi-to/core'
import type { CLIOptions, OpenapiToSingleConfig } from '@openapi-to/core'
import { generate } from './generate.ts'

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

describe('generate', () => {
  const openapiToSingleConfig1: OpenapiToSingleConfig = {
    name: 'server1',
    root: '',
    input: {
      path: path.resolve(__dirname, '../mock', 'swagger.json'),
    },
    output: {
      dir: '',
    },
    plugins: [
      {
        name: 'plugin1',
        hooks: { buildStart: () => wait(10) },
      },
      {
        name: 'plugin2',
        hooks: { buildStart: () => wait(10) },
      },
    ],
  }

  const openapiToSingleConfig2: OpenapiToSingleConfig = {
    name: 'server2',
    root: '',
    input: {
      path: path.resolve(__dirname, '../mock', 'swagger.json'),
    },
    output: {
      dir: '',
    },
    pluginNames: [],
    plugins: [
      {
        name: 'plugin1',
        hooks: { buildStart: () => wait(30) },
      },
      {
        name: 'plugin2',
        hooks: { buildStart: () => wait(30) },
      },
    ],
  }
  const CLIOptions: CLIOptions = {
    logLevel: LogMapper.debug,
  }

  test(
    'generate',
    async () => {
      const map = [openapiToSingleConfig2, openapiToSingleConfig1].map((openapiToSingleConfig) => generate(openapiToSingleConfig, CLIOptions))
      const results = await Promise.all(map)
      expect(results.every((result) => result.success)).toBe(true)
    },
    1000 * 10,
  )
})
