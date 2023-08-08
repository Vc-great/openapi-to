import { generateApiCode } from "../src/create";
import path from "path";
const config = {
  output: path.resolve("./output"), //不使用命令行需要填写
  projects: [
    {
      title: "测试", //项目名称,用于生成目录
      path: "https://petstore.swagger.io/v2/swagger.json", //接口文档url
    },
  ],
};

test("", async () => {
  await generateApiCode(config);
  console.log("完成");
});
