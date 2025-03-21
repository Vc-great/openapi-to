import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";
import { describe } from "vitest";

import petStore from "../mock/petstore.json";
import { RepositoryGenerator } from "./RepositoryGenerator.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("repositoryGenerator", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
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

  test("repository", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig = {};

    const controllerGenerator = new RepositoryGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    controllerGenerator.build(context);
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });
});
