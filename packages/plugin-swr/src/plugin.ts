import { AST, createPlugin, OpenAPI, pluginEnum } from "@openapi-to/core";

import Oas from "oas";

import { SwrGenerator } from "./SwrGenerator.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin<PluginConfig>(
  (pluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });

      return {
        name: pluginEnum.SWR,
        buildStart(context) {
          const openapi = new OpenAPI({}, oas);
          const requestGenerator = new SwrGenerator({
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
