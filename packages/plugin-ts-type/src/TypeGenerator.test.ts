import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";

import petStore from "../mock/petstore.json";
import { TypeGenerator } from "./TypeGenerator.ts";
import { TypeOldNode } from "./TypeOldNode.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("typerGenerator", async () => {
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
  };

  test("TypeGenerator getFullText", () => {
    const pluginConfig = {
      compare: false,
    };
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const oldNode = new TypeOldNode(pluginConfig, openapiToSingleConfig);
    const typerGenerator = new TypeGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
      oldNode,
    });
    typerGenerator.build();
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });

  test("compare TypeGenerator getFullText", () => {
    const pluginConfig = {
      compare: true,
    };
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const oldNode = new TypeOldNode(pluginConfig, openapiToSingleConfig);
    const typerGenerator = new TypeGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
      oldNode,
    });
    typerGenerator.build();
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });
});
