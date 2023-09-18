//@ts-nocheck
import { generateApiCode } from "../src/create";
import path from "path";

const config = {
  jsRequest: true,
  tsRequest: true,
  tsInterface: true,
  zod: true,
  zodDecorator: true, // ts request file use zod decorator
  output: path.resolve("./output"), //不使用命令行需要填写
  projects: [
    {
      title: "test", //项目名称,用于生成目录
      path: "https://petstore.swagger.io/v2/swagger.json", //接口文档url
    },
  ],
};

test("generateApiCode", async () => {
  await generateApiCode(config);
});
