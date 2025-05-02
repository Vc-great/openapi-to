//@ts-nocheck
import openapiV3 from '../../mock/openapiV3.json'
import type { OpenAPIDocument, OpenapiToSingleConfig } from '../types'
import { PluginManager } from './PluginManager'

describe('PluginManager', () => {
  const mockOpenAPIDocument = openapiV3

  const mockOpenapiToSingleConfig: OpenapiToSingleConfig = {
    output: {
      dir: '',
    },
    name: 'test',
    root: 'test',
    input: {
      path: '',
    },
    plugins: [
      {
        name: 'pluginA',
        dependencies: [],
        hooks: {
          tagStart: async (context) => {
            console.log('pluginA tagStart executed')
          },
          operation: async () => {
            // Mock implementation for pluginA
            console.log('pluginA executed')
          },
          tagEnd: async (context) => {
            console.log('pluginA tagEnd executed')
          },
        },
      },
    ],
  }

  it('should initialize plugins and sort them by stages', () => {
    const pluginManager = new PluginManager(mockOpenapiToSingleConfig, mockOpenAPIDocument as unknown as OpenAPIDocument)
    pluginManager.execute()
  })
})
