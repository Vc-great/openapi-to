import { describe, expect } from "vitest";

import { AST } from "./ast.ts";

describe("ast", () => {
  const ast = new AST();

  test("generateObject$2", () => {
    const objectStatements = [
      {
        key: "key",
        value: "1",
        docs: [
          {
            description: "这是一段文字描述",
            tags: [
              {
                tagName: "tag",
                text: "pet",
              },
              {
                tagName: "pet",
                text: "Everything about your Pets",
              },
            ],
          },
        ],
      },
      {
        key: "key2",
        value: "string",
        docs: [{ description: "描述2" }],
      },
    ];
    const objectString = ast.generateObject$2(objectStatements);
    expect(objectString).toMatchSnapshot();
  });
});
