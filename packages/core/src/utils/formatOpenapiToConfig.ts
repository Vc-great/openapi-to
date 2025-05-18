import { folderName } from '../folderName.ts'

import type { OpenapiToConfig, OpenapiToConfigServer, OpenapiToSingleConfig } from '../types/index.ts'

/**
 * openapiToConfig to openapiToSingleConfig
 * @param server
 * @param openapiToConfig
 */
export function formatOpenapiToConfig(root: string, server: OpenapiToConfigServer, openapiToConfig: OpenapiToConfig): OpenapiToSingleConfig {
  return {
    root,
    ...server,
    output: {
      dir: `${root}/${folderName}/${server.output.dir}`,
    },
    plugins: openapiToConfig.plugins,
  }
}
