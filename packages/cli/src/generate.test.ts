//@ts-nocheck
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { LogMapper } from '@openapi-to/core'
import type { CLIOptions, OpenapiToSingleConfig } from '@openapi-to/core'
import { generate, type GenerateServerResult } from './generate.ts'

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

  function failureSummary(result: GenerateServerResult) {
    return {
      name: result.name,
      source: result.source,
      output: result.output,
      success: result.success,
      error: result.result.error
        ? {
            name: result.result.error.name,
            message: result.result.error.message,
          }
        : undefined,
      diagnostics: result.result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        cause: diagnostic.cause,
      })),
      manifestSummary: result.result.generationResult?.manifest.summary,
      written: result.result.generationResult?.written,
    }
  }

  test(
    'generate',
    async () => {
      const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'openapi-cli-generate-'))
      try {
        const configurations = [
          {
            ...openapiToSingleConfig2,
            root: temporaryRoot,
            output: { ...openapiToSingleConfig2.output, dir: path.join(temporaryRoot, 'server2') },
          },
          {
            ...openapiToSingleConfig1,
            root: temporaryRoot,
            output: { ...openapiToSingleConfig1.output, dir: path.join(temporaryRoot, 'server1') },
          },
        ]
        const results = await Promise.all(configurations.map((configuration) => generate(configuration, CLIOptions)))
        const failures = results.filter((result) => !result.success).map(failureSummary)
        expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
      }
    },
    1000 * 10,
  )
})
