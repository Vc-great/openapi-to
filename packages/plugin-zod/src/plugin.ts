import { AST, createPlugin, OpenAPI, pluginEnum } from "@openapi-to/core";

import Oas from "oas";

import { ZodGenerator } from "./ZodGenerator.ts";
import { ZodOldNode } from "./ZodOldNode.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin(
  (pluginConfig?: PluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      const oldNode = new ZodOldNode(
        pluginConfig,
        openapiToSingleConfig,
        openapi,
      );
      return {
        name: pluginEnum.Zod,
        buildStart() {
          const typeGenerator = new ZodGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
            oldNode,
          });
          typeGenerator.build();
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
