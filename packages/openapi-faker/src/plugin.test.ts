import { describe, expect } from "vitest";

import petStore from "../mock/petstore.json";
import { definePlugin } from "./plugin.ts";

import type { OpenapiToSingleConfigOfPlugin } from "@openapi-to/core";
describe("ts request plugin", () => {
  const openapiToSingleConfig: OpenapiToSingleConfigOfPlugin = {
    input: {
      path: "",
      name: "",
    },
    output: "",
    plugins: [],
  };

  test("plugin", () => {
    const lifeCycle = definePlugin({
      createZodDecorator: true,
    })({
      // @ts-expect-error Not a canonical document
      openapiDocument: petStore,
      openapiToSingleConfig: openapiToSingleConfig,
    });
    expect(lifeCycle).toBeTypeOf("object");
  });
});
