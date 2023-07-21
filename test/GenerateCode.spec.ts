//import * as assert from "assert";

import { GenerateCode } from "@/GenerateCode";
import swagger2Json from "../mock/swagger2.json";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Fomatter.json";
import apiItemMockData from "../mock/apiItem.json";
import path from "path";
//import configMockData from "../mock/config";

const config = {
  projectDir: "", //项目根目录
  title: "title", //项目名称,用于生成目录
  path: "", //项目路径
};

let generateCode = new GenerateCode(config);

beforeAll(() => {
  console.log("beforeAll");
  //generateCode = new GenerateCode(config);
});

//todo 获取openapijson
describe("getOpenApiJson", () => {
  test("get http json", async () => {
    const config = {
      projectDir: "", //项目根目录
      title: "", //项目名称,用于生成目录
      path: "http://121.37.237.10:36882/v2/api-docs", //项目路径
    };

    const generateCode = new GenerateCode(config);
    const openApiJson = await generateCode.getSchema();
    expect(openApiJson).not.toEqual({});
  });

  test("get local json", async () => {
    const config = {
      projectDir: "", //项目根目录
      title: "", //项目名称,用于生成目录
      path: path.resolve(__dirname, "../mock/swagger2.json"), //项目路径
    };

    const generateCode = new GenerateCode(config);
    const openApiJson = await generateCode.getSchema();
    expect(openApiJson).not.toEqual({});
  });
});

describe("apiData formatter", () => {
  const config = {
    projectDir: "", //项目根目录
    title: "", //项目名称,用于生成目录
    path: path.resolve(__dirname, "../mock/swagger2.json"), //项目路径
  };

  const generateCode = new GenerateCode(config);
  test("swagger2ToOpenapi3", async () => {
    const openApi3Data = await generateCode.swagger2ToOpenapi3(swagger2Json);
    expect(openApi3Data).toEqual(openApi3);
  });

  test("openApi3DataFormatter", () => {
    const openApi3FormatData = generateCode.openApi3DataFormatter(openApi3);
    expect(openApi3FormatData).toEqual(openApi3Formatter);
  });
});

describe("getRequestName", () => {
  describe("get CRUD path", () => {
    test("has path", () => {
      const path = generateCode.getCrudRequestPath(apiItemMockData["任务管理"]);
      expect(path).toBe("/task");
    });
  });

  describe("getPathLastParams", () => {
    test("{id}", () => {
      const params = generateCode.getPathLastParams("/task/{id}");
      expect(params).toBe("Id");
    });
    test("{_id}", () => {
      const params1 = generateCode.getPathLastParams("/task/{_id}");
      expect(params1).toBe("_id");
    });
    test("id", () => {
      const params2 = generateCode.getPathLastParams("/task/id");
      expect(params2).toBe("id");
    });
  });

  test("dashToUpperCase", () => {
    const str = generateCode.dashToUpperCase("task-id");
    expect(str).toBe("TaskId");
  });
});

test("run ", async () => {
  const config = {
    projectDir: "", //项目根目录
    title: "", //项目名称,用于生成目录
    path: path.resolve(__dirname, "../mock/swagger2.json"), //项目路径
  };
  const generateCode = new GenerateCode(config);
  const { openApi3Data, openApi3FormatData } = await generateCode.init();
  expect(openApi3Data).toEqual(openApi3);
  expect(openApi3FormatData).toEqual(openApi3Formatter);
});

//todo 写入文件
