import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";

import petStore from "../mock/petstore.json";
import { RequestGenerator } from "./RequestGenerator";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("RequestGenerator", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
    input: {
      path: "",
      name: "",
    },
    output: path.resolve(__dirname, "../gen"),
    plugins: [],
  };

  const pluginConfig = {
    createZodDecorator: true,
  };
  const context = {
    output: "",
  };

  test("requestGenerator getFullText", () => {
    const ast = new AST();
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
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
