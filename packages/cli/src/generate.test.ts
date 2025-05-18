//@ts-nocheck
import { LogMapper } from '@openapi-to/core'

import { generate } from './generate.ts'

import type { CLIOptions, OpenapiToSingleConfig } from '@openapi-to/core'

describe('generate', () => {
  const openapiToSingleConfig1: OpenapiToSingleConfig = {
    name: 'server1',
    root: '',
    input: {
      path: 'https://petstore.swagger.io/v2/swagger.json',
    },
    output: {
      dir: '',
    },
    plugins: [
      function plugin1() {
        return {
          name: 'plugin1',
          async buildStart(context) {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                resolve()
              }, 1000)
            })
          },
          writeFile() {
            return []
          },
          buildEnd() {},
        }
      },
      function plugin2() {
        return {
          name: 'plugin2',
          async buildStart(context) {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                resolve()
              }, 1000)
            })
          },
          writeFile() {
            return []
          },
          buildEnd() {},
        }
      },
    ],
  }

  const openapiToSingleConfig2: OpenapiToSingleConfig = {
    name: 'server2',
    root: '',
    input: {
      path: 'https://petstore.swagger.io/v2/swagger.json',
    },
    output: {
      dir: '',
    },
    pluginNames: [],
    plugins: [
      function plugin1() {
        return {
          name: 'plugin1',
          async buildStart(context) {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                resolve()
              }, 3000)
            })
          },
          writeFile() {
            return []
          },
          buildEnd() {},
        }
      },
      function plugin2() {
        return {
          name: 'plugin2',
          async buildStart(context) {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                resolve()
              }, 3000)
            })
          },
          writeFile() {
            return []
          },
          buildEnd() {},
        }
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
      await Promise.all(map)
    },
    1000 * 10,
  )
})
