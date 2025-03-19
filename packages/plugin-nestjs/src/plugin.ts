import { AST, createPlugin, OpenAPI, pluginEnum } from "@openapi-to/core";

import Oas from "oas";

import { DomainGenerator } from "./domainGenerator/domainGenerator.ts";
import { ControllerGenerator } from "./ControllerGenerator.ts";
import { RepositoryGenerator } from "./RepositoryGenerator.ts";
import { ServiceGenerator } from "./ServiceGenerator.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin<PluginConfig>(
  (pluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      return {
        name: pluginEnum.NestJs,
        buildStart(context) {
          new ControllerGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          }).build(context);

          new RepositoryGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          }).build(context);

          new ServiceGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          }).build(context);

          new DomainGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          }).build(context);
        },
        writeFile() {
          return ast.sourceFile.map((item) => {
            return {
              filePath: item.getFilePath(),
              fileText: item.getFullText(),
            };
          });
        },
        buildEnd() {},
      };
    },
);
