import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AST, OpenAPI } from "@openapi-to/core";

import _ from "lodash";
import Oas from "oas";
import { describe } from "vitest";

import petstore from "../../mock/petstore.json";
import usermock from "../../mock/user.json";
import { DomainGenerator } from "./domainGenerator.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("domainGenerator", async () => {
  const openapiToSingleConfig: OpenapiToSingleConfig = {
    name: "",
    input: {
      path: ""
    },
    output: {
      dir: path.resolve(__dirname, "../mock"),
    },
    plugins: [],
  };

  test("domainGenerator", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    // const oas = new Oas(petStore);
    const oas = new Oas(usermock);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig = {};
    const context = {
      output: "",
    };
    const domainGenerator = new DomainGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    domainGenerator.build(context);
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });

  test("domainGenerator petstore", () => {
    const ast = new AST();
    // @ts-expect-error Not a canonical document
    // const oas = new Oas(petStore);
    const oas = new Oas(petstore);
    const openapi = new OpenAPI({}, oas);
    const pluginConfig = {};
    const context = {
      output: "",
    };
    const domainGenerator = new DomainGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      openapiToSingleConfig,
    });
    domainGenerator.build(context);
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();

    expect(text).toMatchSnapshot();
  });
});
