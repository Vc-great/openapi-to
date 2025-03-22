import type { AST, OpenAPI, OpenapiToSingleConfig } from "@openapi-to/core";
import type Oas from "oas";

export const enum RequestTypeEnum {
  AXIOS = "axios",
  COMMON = "common",
  COMMON_WITH_ARRAY_RESPONSE = "commonWithArrayResponse",
}

export type RequestType = "axios" | "common" | "commonWithArrayResponse";

export type PluginConfig = {
  createZodDecorator?: boolean;
  compare?: boolean;
  zodDecoratorImportDeclaration?: {
    moduleSpecifier: string;
  };
  requestImportDeclaration?: {
    moduleSpecifier: string;
  };
  requestConfigTypeImportDeclaration?: {
    namedImports: Array<string>;
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
