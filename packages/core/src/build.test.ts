import { describe, expect } from "vitest";

import petstore from "../mock/petstore.json";
import swagger2 from "../mock/swagger2.0.json";
import { requestRemoteData, swagger2ToOpenapi3 } from "./build.ts";
describe("build", () => {
  test("requestRemoteData success", async () => {
    const remoteUrl = "https://petstore.swagger.io/v2/swagger.json";
    const openapiDocument = await requestRemoteData(remoteUrl);
    expect(openapiDocument).toBeTypeOf("object");
  });

  test("swagger2ToOpenapi3 swagger2", async () => {
    // @ts-expect-error Not a canonical document
    const openapiDocument = await swagger2ToOpenapi3(swagger2);
    expect(openapiDocument).toBeTypeOf("object");
  });

  test("swagger2ToOpenapi3 openapiV3", async () => {
    // @ts-expect-error Not a canonical document
    const openapiDocument = await swagger2ToOpenapi3(petstore);
    expect(openapiDocument).toBeTypeOf("object");
  });
});
