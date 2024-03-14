import process from "process";

import { folderName } from "../folderName.ts";

import type {
  OpenapiToConfig,
  OpenapiToConfigServer,
  OpenapiToSingleConfig,
} from "../types.ts";

/**
 * openapiToConfig to openapiToSingleConfig
 * @param server
 * @param openapiToConfig
 */
export function formatOpenapiToConfig(
  server: OpenapiToConfigServer,
  openapiToConfig: OpenapiToConfig,
): OpenapiToSingleConfig {
  return {
    ...server,
    output: server.output ?? {
      dir: `${process.cwd()}/${folderName}/${server.input.name}`,
    },
    plugins: openapiToConfig.plugins,
  };
}
