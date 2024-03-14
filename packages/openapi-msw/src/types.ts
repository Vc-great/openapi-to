import type { AST, OpenAPI, OpenapiToSingleConfig } from "@openapi-to/core";
import type Oas from "oas";

export type PluginConfig = object;

export type PluginOptions = {
  createZodDecorator: boolean;
};

export type Config = {
  oas: Oas;
  openapi: OpenAPI;
  ast: AST;
  pluginConfig: PluginConfig | undefined;
  openapiToSingleConfig: OpenapiToSingleConfig;
};
