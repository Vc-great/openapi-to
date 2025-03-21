import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";

import petStore from "../mock/petstore.json";
import { ZodGenerator } from "./ZodGenerator.ts";
import { ZodOldNode } from "./ZodOldNode.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("zodGenerator", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
    name: "",
    root: "",
    input: {
      path: "",
    },
    output: {
      dir: path.resolve(__dirname, "../mock"),
    },
    plugins: [],
    pluginNames: [],
  };

  test("zodGenerator getFullText", () => {
    const pluginConfig = {
      compare: false,
    };
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const oldNode = new ZodOldNode(
      pluginConfig,
      openapiToSingleConfig,
      openapi,
    );
    const zodGenerator = new ZodGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
      oldNode,
    });
    zodGenerator.build();
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });

  test("compare zodGenerator getFullText", () => {
    const pluginConfig = {
      compare: true,
    };
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const oldNode = new ZodOldNode(
      pluginConfig,
      openapiToSingleConfig,
      openapi,
    );
    const zodGenerator = new ZodGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
      oldNode,
    });
    zodGenerator.build();
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });
});
