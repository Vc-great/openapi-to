import { GenerateApi } from "@/GenerateApi";
import openApi3Fomatter from "../mock/openApi3Fomatter.json";
import _ from "lodash";
import functionArguments from "../mock/functionArguments.json";
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
const generateApi = new GenerateApi();

test("classDoc", () => {
  const tagItem = openApi3Fomatter["任务管理"];
  // @ts-ignore
  const doc = generateApi.generatorClassJSDoc(tagItem);
  const str =
    "/*\n" +
    "           *@tag名称 任务管理.\n" +
    "           *@tag描述 Task Controller.\n" +
    "           */";
  return expect(doc).toBe(str);
});

test("functionDoc", () => {
  const apiItem = _.head(openApi3Fomatter["任务管理"]);
  // @ts-ignore
  const doc = generateApi.generatorFuncJSDoc(apiItem);
  const str =
    "\n" +
    "    /*\n" +
    "    *@tag名称: 任务管理\n" +
    "    *@接口名称:查询dataUploadingTask \n" +
    "    */";
  return expect(doc).toBe(str);
});

describe("function arguments", () => {
  test("query", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(functionArguments.query);
    return expect(arg).toStrictEqual(queryArguments);
  });
  test("query and path", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(functionArguments.query_path);
    return expect(arg).toStrictEqual(queryPathArguments);
  });
  test("path", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(functionArguments.path);
    return expect(arg).toStrictEqual(pathArguments);
  });
  test("path and body", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(functionArguments.path_body);
    return expect(arg).toStrictEqual(pathBodyArguments);
  });
  test("body", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(functionArguments.body);
    return expect(arg).toStrictEqual(bodyArguments);
  });
});

//todo function content
describe("function content", () => {
  const apiItem = _.head(openApi3Fomatter["任务管理"]);
  test("query", () => {
    const [funcParams, requestParams] = queryArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent(
      apiItem,
      funcParams,
      requestParams
    );
    expect(funcContent).toBe(functionContentByQuery);
  });
  test("query and path", () => {
    const [funcParams, requestParams] = queryPathArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent(
      apiItem,
      funcParams,
      requestParams
    );
    expect(funcContent).toBe(functionContentByQueryPath);
  });
  test("path", () => {
    const [funcParams, requestParams] = pathArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent(
      apiItem,
      funcParams,
      requestParams
    );
    expect(funcContent).toBe(functionContentByPath);
  });
  test("path and body", () => {
    const [funcParams, requestParams] = pathBodyArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent(
      apiItem,
      funcParams,
      requestParams
    );
    expect(funcContent).toBe(functionContentByPathBody);
  });
  test("body", () => {
    const [funcParams, requestParams] = bodyArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent(
      apiItem,
      funcParams,
      requestParams
    );
    expect(funcContent).toBe(functionContentByBody);
  });
});

//todo class
test("class", () => {});
