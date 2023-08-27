//@ts-nocheck
import { GenerateType } from "../src/GenerateType";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";

import {
  queryParamsResultExpected,
  queryRequestOpenApi3Formatter,
} from "../mock/queryParamsResultExpected";
import {
  uploadExpected,
  uploadOpenApi3,
  uploadOpenApi3Formatter,
} from "../mock/apiItemUpload";
import {
  bodyRequestOpenApi3,
  bodyRequestOpenApi3Formatter,
} from "../mock/bodyRequest";
import {
  bodyResponseExpectedResult,
  bodyResponseOpenApi3,
  bodyResponseOpenApi3Formatter,
  ComponentTypeResponseExpectedResult,
} from "../mock/bodyResponse";
import { bodyParamsBodyExpected } from "../mock/getBodyParamsType";
import { enumOption } from "../mock/enum";

// @ts-ignore
let generateType = new GenerateType({}, openApi3, openApi3Formatter);

test("getResponseType", () => {
  const generateType = new GenerateType(
    {},
    // @ts-ignore
    bodyResponseOpenApi3,
    bodyResponseOpenApi3Formatter
  );
  // @ts-ignore
  const bodyResponseExpected = generateType.getResponseType(
    // @ts-ignore
    bodyResponseOpenApi3Formatter
  );
  expect(bodyResponseExpected).toBe(bodyResponseExpectedResult);
});

test("getComponentTypeByRef", () => {
  const generateType = new GenerateType({}, openApi3, openApi3Formatter);
  const resultExpected = generateType.getComponentTypeByRef([
    "#/components/schemas/refList",
  ]);
  expect(resultExpected).toBe(ComponentTypeResponseExpectedResult);
});

test("getEnumOption", () => {
  const generateType = new GenerateType(
    {},
    // @ts-ignore
    openApi3,
    openApi3Formatter
  );
  const enumSchemas = [
    [
      "sourceType",
      {
        type: "string",
        description: "数据来源方式（db文件、视图、api接口、url等）",
        enum: ["DB_CONNECTION", "API_INTERFACE"],
      },
    ],
  ];
  // @ts-ignore
  const resultExpected = generateType.getEnumOption(enumSchemas);
  expect(resultExpected).toBe(enumOption);
});

test("run", () => {
  const generateType = new GenerateType({}, openApi3, openApi3Formatter);
  generateType.run(openApi3Formatter.pet);
});
