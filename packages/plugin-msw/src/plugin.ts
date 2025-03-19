import { AST, createPlugin, OpenAPI, pluginEnum } from "@openapi-to/core";

import Oas from "oas";

import { MswGenerator } from "./MswGenerator.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin<PluginConfig>(
  (pluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      return {
        name: pluginEnum.MSW,
        buildStart(context) {
          const mswGenerator = new MswGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          });
          mswGenerator.build(context);
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
