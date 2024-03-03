import { AST, createPlugin, OpenAPI } from "@openapi-to/core";

import Oas from "oas";

import { RequestGenerator } from "./RequestGenerator.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin<PluginConfig>(
  (pluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      return {
        name: "openapi-ts-request",
        buildStart(context) {
          const requestGenerator = new RequestGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          });
          requestGenerator.build(context);
        },
        writeFile() {
          return ast.saveSync();
        },
        buildEnd() {},
      };
    },
);
