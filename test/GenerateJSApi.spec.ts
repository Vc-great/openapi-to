// @ts-nocheck
import { GenerateJSApi } from "@/GenerateJSApi";
import _ from "lodash";
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
import openApi3Formatter from "../mock/openApi3Formatter.json";
import {
  queryParamsResultExpected,
  queryRequestOpenApi3Formatter as queryRequestByFuncJSDoc,
} from "../mock/queryParamsResultExpected";
import { GenerateType } from "@/GenerateType";
import { pathRequestOpenApi3 } from "../mock/pathRequest";
import {
  uploadExpected,
  uploadOpenApi3,
  uploadOpenApi3Formatter,
} from "../mock/apiItemUpload";

import { bodyParamsBodyExpected } from "../mock/getBodyParamsType";
import {
  bodyRequestOpenApi3,
  bodyRequestOpenApi3Formatter as bodyRequestOpenApi3Formatter2,
} from "../mock/bodyRequest";
const generateApi = new GenerateJSApi();

test("classDoc", () => {
  const doc = generateApi.generatorClassJSDoc(openApi3Formatter.pet);
  const str =
    "/**\n" +
    "           *@tagName pet.\n" +
    "           *@tagDescription pet.\n" +
    "           */";
  return expect(doc).toBe(str);
});

describe("functionDoc", () => {
  test("getQueryParamsType", () => {
    const query = generateApi.generatorFuncJSDoc(queryRequestByFuncJSDoc);
    const queryExpected =
      "/**\n" +
      "    *@apiSummary Finds Pets by status\n" +
      "    *@param query\n" +
      "            *@param {string} [query.1] -2\n" +
      "*@param {number} [query.id2] -ID\n" +
      "*@param {number} query.page -page\n" +
      "*@param {number} query.size -size\n" +
      "*@param {string[]} [query.sort] -\n" +
      "*@param {string[]} [query.time] -时间\n" +
      "*@param {number} [query.state] -状态\n" +
      "*@param {number} [query.id] -id\n" +
      "*@param {string} [query.name] -名称\n" +
      "*@param {string} [query.type] -类型\n" +
      "*@param {string} [query.code] -code\n" +
      "*@returns {Promise<[Object, FindByStatusResponse]>}\n" +
      "    */";
    return expect(query).toBe(queryExpected);
  });

  test("getPathParamsType", () => {
    const generateApi = new GenerateJSApi({}, {}, {});
    const pathDoc = generateApi.generatorFuncJSDoc(
      pathRequestOpenApi3Formatter
    );
    const pathExpected =
      "/**\n" +
      "    *@apiSummary pet\n" +
      "    *@param {number} id -id\n" +
      "*@param {number} id2 -id2\n" +
      "*@returns {Promise<[Object, CreateResponse]>}\n" +
      "    */";
    expect(pathDoc).toBe(pathExpected);
  });

  test("not have body params", () => {
    const bodyParams = generateApi.generateBodyParams(
      queryRequestOpenApi3Formatter
    );
    const bodyExpected = "";
    return expect(bodyParams).toBe(bodyExpected);
  });

  test("have json body params", () => {
    const generateApi = new GenerateJSApi(
      {},
      bodyRequestOpenApi3,
      bodyRequestOpenApi3Formatter2
    );
    const bodyParams = generateApi.generatorFuncJSDoc(
      bodyRequestOpenApi3Formatter2
    );

    const expected =
      "/**\n" +
      "    *@apiSummary pet\n" +
      "    *@param body\n" +
      "      *@param {string} [body.string] -文件\n" +
      "*@param {string} [body.byte] -byte\n" +
      "*@param {string} body.binary -binary\n" +
      "*@param {string} body.date -date\n" +
      "*@param {string} body.date2 -date-time\n" +
      "*@param {string} body.password -password\n" +
      "*@param {'a'|'b'} body.enums -enums\n" +
      "*@param {number} body.int32 -id\n" +
      "*@param {number} body.int64 -int64\n" +
      "*@param {number} body.number -number\n" +
      "*@param {number} body.double -double\n" +
      "*@param {number[]} body.arrayList -arrayList\n" +
      "*@param {ArrayRef[]} body.arrayRef -arrayRef\n" +
      "*@param {boolean} body.boolean -boolean\n" +
      "*@param {Time} body.time -time\n" +
      "*@param {Time} body.time2 -time\n" +
      "*@returns {Promise<[Object, CreateResponse]>}\n" +
      "    */";
    expect(bodyParams).toBe(expected);
  });

  test("have upload  params", () => {
    const generateApi = new GenerateJSApi(
      {},
      uploadOpenApi3,
      uploadOpenApi3Formatter
    );
    const uploadParams = generateApi.generatorFuncJSDoc(
      uploadOpenApi3Formatter
    );
    const uploadExpected =
      "/**\n" +
      "    *@apiSummary pet\n" +
      "    *@param body\n" +
      "      *@param {string} [body.file] -file\n" +
      "*@param {string} body.file1 -file\n" +
      "*@returns {Promise<[Object, CreateResponse]>}\n" +
      "    */";
    expect(uploadParams).toBe(uploadExpected);
  });
});

describe("function arguments", () => {
  test("query", () => {
    const arg = generateApi.generatorArguments(queryRequestOpenApi3Formatter);
    const expected = {
      formData: "",
      formDataHeader: "",
      funcParams: "query",
      paramsSerializer:
        "paramsSerializer(params) {\n            return qs.stringify(params)\n        }",
      requestParams: "params:query",
    };
    return expect(arg).toEqual(expected);
  });
  test("query and path", () => {
    const arg = generateApi.generatorArguments(
      queryPathRequestOpenApi3Formatter
    );
    const expected = {
      formData: "",
      formDataHeader: "",
      funcParams: "id,query",
      paramsSerializer:
        "paramsSerializer(params) {\n            return qs.stringify(params)\n        }",
      requestParams: "params:query",
    };
    return expect(arg).toEqual(expected);
  });
  test("path", () => {
    // @ts-ignore
    const arg = generateApi.generatorArguments(pathRequestOpenApi3Formatter);
    const expected = {
      funcParams: "id,id2",
      requestParams: "",
      paramsSerializer: "",
      formDataHeader: "",
      formData: "",
    };
    return expect(arg).toEqual(expected);
  });
  test("path and body", () => {
    const generateApi = new GenerateJSApi({}, openApi3, openApi3Formatter);
    // @ts-ignore
    const arg = generateApi.generatorArguments(
      pathBodyRequestOpenApi3Formatter
    );
    const expected = {
      formData: "",
      formDataHeader: "",
      funcParams: "id,body",
      paramsSerializer: "",
      requestParams: "data:body",
    };
    return expect(arg).toEqual(expected);
  });
  test("body", () => {
    const generateApi = new GenerateJSApi({}, openApi3, openApi3Formatter);
    // @ts-ignore
    const arg = generateApi.generatorArguments(bodyRequestOpenApi3Formatter);
    const expected = {
      formData: "",
      formDataHeader: "",
      funcParams: "body",
      paramsSerializer: "",
      requestParams: "data:body",
    };
    return expect(arg).toEqual(expected);
  });
});

describe("function content", () => {
  const apiItem = _.head(openApi3Formatter.pet);
  test("query", () => {
    const apiItem = _.head(openApi3Formatter.pet);
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams: "query",
      requestParams: "params:query",
    });

    const expected =
      " uploadImage(query){\n" +
      "      return request.post({\n" +
      "        url:`/pet/${petId}/uploadImage`,\n" +
      "params:query\n" +
      "      })\n" +
      "    }";
    expect(funcContent).toBe(expected);
  });
  test("query and path", () => {
    const [funcParams, requestParams] = queryPathArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams: "id,query",
      paramsSerializer:
        "paramsSerializer(params) {\n            return qs.stringify(params)\n        }",
      requestParams: "params:query",
    });
    const expected =
      " uploadImage(id,query){\n" +
      "      return request.post({\n" +
      "        url:`/pet/${petId}/uploadImage`,\n" +
      "params:query,\n" +
      "paramsSerializer(params) {\n" +
      "            return qs.stringify(params)\n" +
      "        }\n" +
      "      })\n" +
      "    }";
    expect(funcContent).toBe(expected);
  });
  test("path", () => {
    const [funcParams, requestParams] = pathArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams: "id,id2",
      requestParams,
    });
    //todo 多path
    const expected =
      " uploadImage(id,id2){\n" +
      "      return request.post({\n" +
      "        url:`/pet/${petId}/uploadImage`\n" +
      "      })\n" +
      "    }";
    expect(funcContent).toBe(expected);
  });
  test("path and body", () => {
    const [funcParams, requestParams] = pathBodyArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams: "id,body",
      requestParams: "data:body",
    });
    //todo path
    const expected =
      " uploadImage(id,body){\n" +
      "      return request.post({\n" +
      "        url:`/pet/${petId}/uploadImage`,\n" +
      "data:body\n" +
      "      })\n" +
      "    }";
    expect(funcContent).toBe(expected);
  });
  test("body", () => {
    const [funcParams, requestParams] = bodyArguments;
    // @ts-ignore
    const funcContent = generateApi.generatorFuncContent({
      apiItem,
      funcParams: "body",
      requestParams: "data:body",
    });
    const expected =
      " uploadImage(body){\n" +
      "      return request.post({\n" +
      "        url:`/pet/${petId}/uploadImage`,\n" +
      "data:body\n" +
      "      })\n" +
      "    }";
    expect(funcContent).toBe(expected);
  });
});

test("run", () => {
  const tagItem = openApi3Formatter.pet;
  const generateApi = new GenerateJSApi({}, openApi3, openApi3Formatter);
  const result = generateApi.run(tagItem);
  console.log("-> 1");
});
