//import * as assert from "assert";

import { GenerateCode } from "@/GenerateCode";
//import swagger2Json from "../mock/swagger2.json";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Fomatter.json";
import apiItemMockData from "../mock/apiItem.json";
//import generateCodeRunResult from "../mock/generateCodeRunResult.json";
import path from "path";
import { GenerateApi } from "@/GenerateApi";
//import configMockData from "../mock/config";
import swagger2 from "../mock/swagger2.json";
import openApi3SourceDataExpectedResult from "../mock/openApi3SourceData.json";
import openApi3FormatDataExpectedResult from "../mock/openApi3FormatData.json";

const config = {
  projectDir: "", //项目根目录
  title: "title", //项目名称,用于生成目录
  path: "", //项目路径
};

let generateCode = new GenerateCode(config);

beforeAll(() => {
  //generateCode = new GenerateCode(config);
});

//获取openapijson
describe("getOpenApiJson", () => {
  test("get http json", async () => {
    const config = {
      projectDir: "", //项目根目录
      title: "", //项目名称,用于生成目录
      path: "https://petstore.swagger.io/v2/swagger.json", //项目路径
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
    await generateCode.swagger2ToOpenapi3(swagger2);
    //expect(openApi3Data).toEqual(openApi3);
  });

  test("openApi3DataFormatter", () => {
    const openApi3FormatData = generateCode.openApi3DataFormatter(openApi3);
    expect(openApi3FormatData).toStrictEqual(openApi3Formatter);
  });
});

describe("getRequestName", () => {
  describe("get CRUD path", () => {
    test("has path", () => {
      const path = generateCode.getCrudRequestPath(apiItemMockData["任务管理"]);
      expect(path).toBe("tasks");
    });
  });

  describe("getPathLastParams", () => {
    test("{id}", () => {
      const params = generateCode.getPathLastParams("/task/{id}");
      expect(params).toBe("Id");
    });
    test("{_id}", () => {
      const params1 = generateCode.getPathLastParams("/task/{_id}");
      expect(params1).toBe("Id");
    });
    test("id", () => {
      const params2 = generateCode.getPathLastParams("/task/id");
      expect(params2).toBe("id");
    });
  });
});

describe("init && run", () => {
  const config = {
    projectDir: "", //项目根目录
    title: "", //项目名称,用于生成目录
    path: path.resolve(__dirname, "../mock/swagger2.json"), //项目路径
  };
  const generateCode = new GenerateCode(config);

  test("init ", async () => {
    const { openApi3SourceData, openApi3FormatData } =
      await generateCode.init();
    expect(openApi3SourceData).toEqual(openApi3SourceDataExpectedResult);
    expect(openApi3FormatData).toEqual(openApi3FormatDataExpectedResult);
  });

  test("register", () => {
    // @ts-ignore
    const instanceList = [new GenerateApi({}, openApi3, openApi3Formatter)];
    // @ts-ignore
    generateCode.register(instanceList);
    const instance = generateCode.registerClass;
    expect(instance).toStrictEqual(instanceList);
  });

  /* test("run", () => {
    //generateCode.run();
    // expect(data).toStrictEqual(generateCodeRunResult);
  });*/
});
