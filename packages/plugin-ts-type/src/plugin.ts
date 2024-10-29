import { AST, createPlugin, OpenAPI } from "@openapi-to/core";

import Oas from "oas";

import { TypeGenerator } from "./TypeGenerator.ts";
import { TypeOldNode } from "./TypeOldNode.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin(
  (pluginConfig?: PluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      const oldNode = new TypeOldNode(pluginConfig, openapiToSingleConfig);
      return {
        name: "plugin-ts-type",
        buildStart() {
          const typeGenerator = new TypeGenerator({
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
          return ast.saveSync();
        },
        buildEnd() {},
      };
    },
);
