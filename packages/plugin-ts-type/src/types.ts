import type { AST, OpenAPI, OpenapiToSingleConfig } from "@openapi-to/core";
import type Oas from "oas";
import type { TypeOldNode } from "./TypeOldNode.ts";

export type PluginConfig = {
  compare?: boolean;
};

export type Config = {
  oas: Oas;
  openapi: OpenAPI;
  ast: AST;
  pluginConfig?: PluginConfig;
  openapiToSingleConfig: OpenapiToSingleConfig;
  oldNode: TypeOldNode;
};
