import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";
import path from "path";

import petStore from "../mock/petstore.json";
import { FakerGenerator } from "./FakerGenerator.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("faker", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
    input: {
      path: "",
      name: "",
    },
    output: {
      dir: path.resolve(__dirname, "../mock"),
    },
    plugins: [],
  };

  const context = {
    output: "",
  };

  test("getFullText", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig = {
      createZodDecorator: true,
      compare: false,
    };

    const requestGenerator = new FakerGenerator({
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

  test("compare getFullText", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig = {
      createZodDecorator: true,
      compare: true,
    };

    const requestGenerator = new FakerGenerator({
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
