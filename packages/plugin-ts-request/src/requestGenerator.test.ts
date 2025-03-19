import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";
import { describe } from "vitest";

import petStore from "../mock/petstore.json";
import { RequestGenerator } from "./RequestGenerator";
import { RequestTypeEnum } from "./types.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
import type { PluginConfig } from "./types.ts";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("RequestGenerator", async () => {
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

  const context = {
    output: "",
  };

  test("all true getFullText", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig = {
      createZodDecorator: true,
      compare: true,
      zodDecoratorImportDeclaration: {
        moduleSpecifier: "./test/zod",
      },
      requestImportDeclaration: {
        moduleSpecifier: "./test/request",
      },
    };

    const requestGenerator = new RequestGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    requestGenerator.build(context);
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });

  test("all false  getFullText", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig: PluginConfig = {
      createZodDecorator: false,
      compare: false,
    };

    const requestGenerator = new RequestGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    requestGenerator.build(context);
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });

  test("requestType common getFullText", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig: PluginConfig = {
      requestType: RequestTypeEnum.COMMON,
    };

    const requestGenerator = new RequestGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    requestGenerator.build(context);
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();
    expect(text).toMatchSnapshot();
  });

  test("requestType commonWithArrayResponse getFullText", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig: PluginConfig = {
      requestType: RequestTypeEnum.COMMON_WITH_ARRAY_RESPONSE,
    };

    const requestGenerator = new RequestGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    requestGenerator.build(context);
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();
    expect(text).toMatchSnapshot();
  });
});
