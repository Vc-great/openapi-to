import { getPlugins } from './getPlugins.ts'
import { isPromise } from '@openapi-to/core/utils'
import type { CLIOptions, OpenapiToConfig, OpenapiToUserConfig } from '@openapi-to/core'
import type { CosmiconfigResult } from './getCosmiConfig.ts'

export async function getConfig(result: CosmiconfigResult, CLIOptions: CLIOptions): Promise<OpenapiToConfig> {
  const config = result?.config

  let openapiToUserConfig = Promise.resolve(config) as Promise<OpenapiToUserConfig>

  // for ts or js files
  if (typeof config === 'function') {
    const possiblePromise = config(CLIOptions)
    openapiToUserConfig =isPromise(possiblePromise)?possiblePromise:Promise.resolve(possiblePromise)
  }

  let JSONConfig = await openapiToUserConfig


  JSONConfig = {
    ...JSONConfig,
    plugins: await getPlugins(JSONConfig.plugins)
  }

  return JSONConfig as OpenapiToConfig
}
