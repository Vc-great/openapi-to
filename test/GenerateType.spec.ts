import { GenerateType } from "@/GenerateType";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Fomatter.json";
//import apiItemMockData from "../mock/apiItem.json";
import apiItemByGet from "../mock/apiItemByGet.json";
import apiItemByPost from "../mock/apiItemByPost.json";
import { queryParams } from "../mock/queryParams";
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
    expect(bodyParamsExpected).toBe("");
  });

  test(" have body params", () => {
    const apiItem = apiItemByPost;
    // @ts-ignore
    const bodyParamsExpected = generateType.getBodyParamsType(apiItem);
    expect(bodyParamsExpected).toBe("");
  });
});

test("getPathParamsType", () => {});

test("getResponseType", () => {});
