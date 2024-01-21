import type { defineConfig } from '@openapi-to/core'

export type CosmiconfigResult = {
  filepath: string
  isEmpty?: boolean
  config: ReturnType<typeof defineConfig>
}





