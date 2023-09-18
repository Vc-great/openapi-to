//@ts-nocheck
import { GenerateCode } from "../src/GenerateCode";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import openApi3FormatDataExpectedResult from "../mock/openApi3Formatter.json";
import path from "path";
import { GenerateTSRequest } from "../src/GenerateTSRequest";

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

describe("getRequestName", () => {
  describe("get CRUD path", () => {
    test("has path", () => {
      const path = generateCode.getCrudRequestPath(openApi3Formatter.pet);
      expect(path).toBe("/pet");
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

describe("init", () => {
  const config = {
    projectDir: "", //项目根目录
    title: "", //项目名称,用于生成目录
    path: path.resolve(__dirname, "../mock/openApi3.json"), //项目路径
  };
  const generateCode = new GenerateCode(config);

  test("init ", async () => {
    const { openApi3FormatData } = await generateCode.init();
    expect(openApi3FormatData).toEqual(openApi3FormatDataExpectedResult);
  });

  /* test("run", () => {
    //generateCode.run();
    // expect(data).toStrictEqual(generateCodeRunResult);
  });*/
});
