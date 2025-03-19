import { AST, createPlugin, OpenAPI, pluginEnum } from "@openapi-to/core";

import Oas from "oas";

import { FakerGenerator } from "./FakerGenerator.ts";

import type { PluginConfig } from "./types.ts";

export const definePlugin = createPlugin<PluginConfig>(
  (pluginConfig) =>
    ({ openapiDocument, openapiToSingleConfig }) => {
      const ast = new AST();
      const oas = new Oas({ ...openapiDocument });
      const openapi = new OpenAPI({}, oas);
      return {
        name: pluginEnum.Faker,
        buildStart(context) {
          const fakerGenerator = new FakerGenerator({
            oas,
            ast,
            openapi,
            pluginConfig,
            openapiToSingleConfig,
          });
          fakerGenerator.build(context);
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
