import type { AST, OpenAPI, OpenapiToSingleConfig } from "@openapi-to/core";
import type Oas from "oas";

export const RequestTypeEnum = {
  AXIOS: "axios",
  COMMON: "common",
  COMMON_WITH_ARRAY_RESPONSE: "commonWithArrayResponse",
};

export type RequestType =
  (typeof RequestTypeEnum)[keyof typeof RequestTypeEnum];

export type PluginConfig = {
  createZodDecorator?: boolean;
  compare?: boolean;
  zodDecoratorImportDeclaration?: {
    moduleSpecifier: string;
  };
  requestImportDeclaration?: {
    moduleSpecifier: string;
  };
  requestType?: RequestType;
};

export type Config = {
  oas: Oas;
  openapi: OpenAPI;
  ast: AST;
  pluginConfig: PluginConfig | undefined;
  openapiToSingleConfig: OpenapiToSingleConfig;
};
