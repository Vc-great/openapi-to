import { AST, createPlugin, OpenAPI } from "@openapi-to/core";

import Oas from "oas";

import { ZodGenerator } from "./ZodGenerator.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin(
  (pluginConfig?: PluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      return {
        name: "openapi-zod",
        buildStart() {
          const typeGenerator = new ZodGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
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
