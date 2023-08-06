// @ts-ignore
import { GenerateType } from "@/GenerateType";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Fomatter.json";
import tagItem from "../mock/apiItem.json";
import apiItemByGet from "../mock/apiItemByGet.json";
import { queryParams } from "../mock/queryParams";
import {
  uploadExpectedResult,
  uploadOpenApi3,
  uploadOpenApi3Formatter,
} from "../mock/apiItemUpload";
import {
  bodyRequestOpenApi3,
  bodyRequestOpenApi3Formatter,
  bodyRequestExpectedResult,
} from "../mock/bodyRequest";
import {
  pathRequestOpenApi3,
  pathRequestOpenApi3Formatter,
  pathRequestExpectedResult,
} from "../mock/pathRequest";
import {
  bodyResponseOpenApi3,
  bodyResponseExpectedResult,
  bodyResponseOpenApi3Formatter,
} from "../mock/bodyResponse";

import { refList } from "../mock/ref";

// @ts-ignore
let generateType = new GenerateType({}, openApi3, openApi3Formatter);

describe("", () => {});

test("getQueryParamsType", () => {
  const apiItem = apiItemByGet;
  // @ts-ignore
  const queryParamsExpected = generateType.getQueryParamsType(apiItem);
  expect(queryParamsExpected).toBe(queryParams);
});

describe("getBodyParamsType", () => {
  test("not have body params", () => {
    const apiItem = apiItemByGet;
    // @ts-ignore
    const bodyParamsExpected = generateType.getBodyParamsType(apiItem);
    expect(bodyParamsExpected).toBe(undefined);
  });

  test(" have json body params", () => {
    const generateType = new GenerateType(
      {},
      // @ts-ignore
      bodyRequestOpenApi3,
      bodyRequestOpenApi3Formatter
    );
    const apiItem = bodyRequestOpenApi3Formatter;
    // @ts-ignore
    const bodyParamsResult = generateType.getBodyParamsType(apiItem);
    expect(bodyParamsResult).toBe(bodyRequestExpectedResult);
  });

  test(" have upload  params", () => {
    const generateType = new GenerateType(
      {},
      // @ts-ignore
      uploadOpenApi3,
      uploadOpenApi3Formatter
    );
    const apiItem = uploadOpenApi3Formatter;
    // @ts-ignore
    const bodyParamsExpected = generateType.getBodyParamsType(apiItem);
    expect(bodyParamsExpected).toBe(uploadExpectedResult);
  });

  // test("have application/x-www-form-urlencoded params", () => {});

  //test("have $ref params", () => {});
});

test("getPathParamsType", () => {
  const generateType = new GenerateType(
    {},
    // @ts-ignore
    pathRequestOpenApi3,
    uploadOpenApi3Formatter
  );
  // @ts-ignore
  const bodyParamsExpected = generateType.getPathParamsType(
    // @ts-ignore
    pathRequestOpenApi3Formatter
  );
  expect(bodyParamsExpected).toBe(pathRequestExpectedResult);
});

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
  const generateType = new GenerateType(
    {},
    // @ts-ignore
    openApi3,
    openApi3Formatter
  );
  // @ts-ignore
  const resultExpected = generateType.getComponentTypeByRef(refList);
  expect(resultExpected).toBe(bodyResponseExpectedResult);
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
  expect(resultExpected).toBe("");
});

test("run", () => {
  const generateType = new GenerateType(
    {},
    // @ts-ignore
    openApi3,
    openApi3Formatter
  );
  // @ts-ignore
  const tagItemTypeString = generateType.run(tagItem.任务管理);
  expect(tagItemTypeString).toBe("");
});
