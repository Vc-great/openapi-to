import type { AST, OpenAPI, OpenapiToSingleConfig } from "@openapi-to/core";
import type Oas from "oas";
import type { ImportDeclarationStructure } from "ts-morph";

export type PluginConfig = {
  database?: "typeorm";
};

export type Config = {
  oas: Oas;
  openapi: OpenAPI;
  ast: AST;
  pluginConfig: PluginConfig | undefined;
  openapiToSingleConfig: OpenapiToSingleConfig;
};

export type ImportStatementsOmitKind = Omit<
  ImportDeclarationStructure,
  "kind" | "namedImports"
> & { namedImports: string[] };
