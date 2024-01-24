import _ from "lodash";

import type { OpenapiToConfig } from "@openapi-to/core";
import type { CosmiconfigResult } from "../types.ts";

export function getDefineConfig(result: CosmiconfigResult): OpenapiToConfig {
  const config = result?.config;

  if (!_.toPlainObject(config)) {
    throw new Error("openapi.config file does not have an export config.");
  }

  return config;
}
