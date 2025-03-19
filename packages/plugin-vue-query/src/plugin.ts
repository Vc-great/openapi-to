import { AST, createPlugin, OpenAPI, pluginEnum } from "@openapi-to/core";

import Oas from "oas";

import { Generator } from "./Generator.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin<PluginConfig>(
  (pluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      return {
        name: pluginEnum.VueQuery,
        buildStart(context) {
          const requestGenerator = new Generator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          });
          requestGenerator.build(context);
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
