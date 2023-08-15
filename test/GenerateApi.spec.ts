// @ts-nocheck
import { GenerateApi } from "@/GenerateApi";
import openApi3Fomatter from "../mock/openApi3Fomatter.json";
import _ from "lodash";
import functionArguments from "../mock/functionArguments.json";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Fomatter.json";
import {
  queryArguments,
  queryPathArguments,
  pathBodyArguments,
  pathArguments,
  bodyArguments,
  functionContentByQuery,
  functionContentByQueryPath,
  functionContentByBody,
  functionContentByPath,
  functionContentByPathBody,
} from "../mock/functionArgumentsExpected";
import { classApiStr } from "../mock/classApiStr";
import {
  queryRequestOpenApi3Formatter,
  queryRequestExpectedResult,
  queryPathRequestOpenApi3Formatter,
  queryPathRequestExpectedResult,
  pathRequestOpenApi3Formatter,
  pathRequestExpectedResult,
  pathBodyRequestOpenApi3Formatter,
  pathBodyRequestExpectedResult,
  bodyRequestExpected,
  bodyRequestOpenApi3Formatter,
} from "../mock/functionArguments";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Fomatter.json";

const generateApi = new GenerateApi();

test("classDoc", () => {
  const doc = generateApi.generatorClassJSDoc(openApi3Fomatter.pet);
  const str =
    "/**\n" +
    "           *@tagName pet.\n" +
    "           *@tagDescription pet.\n" +
    "           */";
  return expect(doc).toBe(str);
});

test("functionDoc", () => {
  const apiItem = _.head(openApi3Fomatter.pet);
  const doc = generateApi.generatorFuncJSDoc(apiItem);
  const str =
    "\n" +
    "    /**\n" +
    "    *@tagName pet\n" +
    "    *@apiSummary uploads an image \n" +
    "    */";
  return expect(doc).toBe(str);
});

describe("function arguments", () => {
  test("query", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(queryRequestOpenApi3Formatter);
    return expect(arg).toEqual(queryRequestExpectedResult);
  });
  test("query and path", () => {
    //   queryPathRequestExpectedResult,
    // @ts-ignore
    const arg = generateApi.generatorArguments(
      queryPathRequestOpenApi3Formatter
    );
    return expect(arg).toEqual(queryPathRequestExpectedResult);
  });
  test("path", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(pathRequestOpenApi3Formatter);
    return expect(arg).toEqual(pathRequestExpectedResult);
  });
  test("path and body", () => {
    const generateApi = new GenerateApi({}, openApi3, openApi3Formatter);
    // @ts-ignore
    const arg = generateApi.generatorArguments(
      pathBodyRequestOpenApi3Formatter
    );
    return expect(arg).toEqual(pathBodyRequestExpectedResult);
  });
  test("body", () => {
    const generateApi = new GenerateApi({}, openApi3, openApi3Formatter);
    // @ts-ignore
    const arg = generateApi.generatorArguments(bodyRequestOpenApi3Formatter);
    return expect(arg).toEqual(bodyRequestExpected);
  });
});

//todo function content
describe("function content", () => {
  const apiItem = _.head(openApi3Fomatter.pet);
  test("query", () => {
    const apiItem = _.head(openApi3Fomatter.pet);
    const [funcParams, requestParams] = queryArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams,
      requestParams,
    });
    expect(funcContent).toBe(functionContentByQuery);
  });
  test("query and path", () => {
    const [funcParams, requestParams] = queryPathArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams,
      requestParams,
    });
    expect(funcContent).toBe(functionContentByQueryPath);
  });
  test("path", () => {
    const [funcParams, requestParams] = pathArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams,
      requestParams,
    });
    expect(funcContent).toBe(functionContentByPath);
  });
  test("path and body", () => {
    const [funcParams, requestParams] = pathBodyArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams,
      requestParams,
    });
    expect(funcContent).toBe(functionContentByPathBody);
  });
  test("body", () => {
    const [funcParams, requestParams] = bodyArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams,
      requestParams,
    });
    expect(funcContent).toBe(functionContentByBody);
  });
});

test("run", () => {
  const tagItem = openApi3Fomatter.pet;
  const generateApi = new GenerateApi({}, openApi3, openApi3Formatter);
  generateApi.run(tagItem);
});
