import type { defineConfig, OpenapiToUserConfig } from '@openapi-to/core'

export type CosmiconfigResult = {
  filepath: string
  isEmpty?: boolean
  config: ReturnType<typeof defineConfig> | OpenapiToUserConfig
}





