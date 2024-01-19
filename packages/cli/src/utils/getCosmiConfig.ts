/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { cosmiconfig } from 'cosmiconfig'
import {folderName} from './folderName.js'

import type { defineConfig, OpenapiToUserConfig } from '@openapi-to/core'

export type CosmiconfigResult = {
  filepath: string
  isEmpty?: boolean
  config: ReturnType<typeof defineConfig> | OpenapiToUserConfig
}
export async function getCosmiConfig(moduleName: string): Promise<CosmiconfigResult> {
  const searchPlaces = [
    `${moduleName}.config.js`,
  ]
  const explorer = cosmiconfig(moduleName, {
    cache: false,
    searchPlaces: [
      ...searchPlaces.map((searchPlace) => {
        return `${folderName}/${searchPlace}`
      })
    ]
  })

  const result = await explorer.search()
  if (result?.isEmpty || !result || !result.config) {
    throw new Error('Config not defined, create a openapi.config.js')
  }

  return result as CosmiconfigResult
}
