import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";

import petStore from "../mock/petstore.json";
import { ZodGenerator } from "./ZodGenerator.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("zodGenerator", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
    input: {
      path: "",
      name: "",
    },
    output: {
      dir: "",
    },
    plugins: [],
  };

  const pluginConfig = {
    createZodDecorator: true,
  };

  test("zodGenerator getFullText", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);

    const zodGenerator = new ZodGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    zodGenerator.build();
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });
});
