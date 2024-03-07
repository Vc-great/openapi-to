import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";

import petStore from "../mock/petstore.json";
import { FakerGenerator } from "./FakerGenerator.ts";

import type { OpenapiToSingleConfigOfPlugin } from "@openapi-to/core";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("faker", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfigOfPlugin = {
    input: {
      path: "",
      name: "",
    },
    output: path.resolve(__dirname, "../gen"),
    plugins: [],
  };

  const context = {
    output: "",
  };
  const ast = new AST();
  // @ts-expect-error Not a canonical document
  const oas = new Oas(petStore);
  const openapi = new OpenAPI({}, oas);

  test("getFullText", () => {
    const pluginConfig = {
      createZodDecorator: true,
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