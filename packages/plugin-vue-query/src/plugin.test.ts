import { describe, expect } from 'vitest'

import petStore from '../mock/petstore.json'
import { definePlugin } from './plugin.ts'

import type { OpenapiToSingleConfig } from '@openapi-to/core'
describe('vue query plugin', () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
    name: '',
    root: '',
    input: {
      path: '',
    },
    output: {
      dir: '',
    },
    plugins: [],
  }

  test('plugin', () => {
    const lifeCycle = definePlugin({
      // @ts-expect-error Not a canonical document
      openapiDocument: petStore,
      openapiToSingleConfig: openapiToSingleConfig,
    })
    expect(lifeCycle).toBeTypeOf('object')
  })
})
