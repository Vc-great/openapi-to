import path from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";

import petStore from "../mock/petstore.json";
import { MswGenerator } from "./MswGenerator.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("MswGenerator", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
    name: "",
    root: "",
    input: {
      path: "",
    },
    output: {
      dir: path.resolve(__dirname, "../gen"),
    },
    plugins: [],
  };

  const context = {
    output: "",
  };
  const ast = new AST();
  // @ts-expect-error Not a canonical document
  const oas = new Oas(petStore);
  const openapi = new OpenAPI({}, oas);
  const pluginConfig = {};
  test("MswGenerator getFullText", () => {
    const requestGenerator = new MswGenerator({
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
