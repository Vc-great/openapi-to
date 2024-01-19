import _ from "lodash";
import Oas from "oas";
import petStore from "../mock/petstore.json";
import { RequestGenerator } from "./RequestGenerator";
import { AST, OpenAPI } from "@openapi-to/core";

describe("RequestGenerator", async () => {
  const defineConfig = {};

  const pluginConfig = {
    createZodDecorator: true,
  };

  test("requestGenerator", () => {
    const ast = new AST();
    const oas = new Oas(petStore);
    const openapi = new OpenAPI({}, oas);
    const requestGenerator = new RequestGenerator({
      oas,
      ast,
      openapi,
      pluginConfig,
      defineConfig,
    });
    requestGenerator.build();
    const text = _.chain(ast.sourceFile)
      .map((sourceFile) => sourceFile.getFullText())
      .join("\n")
      .value();
    expect(text).toMatchSnapshot();
  });
});
