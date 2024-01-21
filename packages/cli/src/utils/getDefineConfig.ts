import type { CosmiconfigResult } from '../types.ts'
import _ from "lodash";
import type{ OpenapiToConfig} from "@openapi-to/core";

export function getDefineConfig(result: CosmiconfigResult):  OpenapiToConfig {
  const config = result?.config

  if(!_.isFunction(config)){
      throw new Error('definePlugin is not function')
  }

  return config
}
