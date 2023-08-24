//@ts-nocheck
import { generateApiCode } from "../src/create";
import path from "path";

const config = {
  output: path.resolve("./output"), //不使用命令行需要填写
  projects: [
    {
      title: "数据上报及异常跟踪服务", //项目名称,用于生成目录
      path: "http://121.37.237.10:36882/v2/api-docs", //接口文档url
    },
  ],
};

test("generateApiCode", async () => {
  await generateApiCode(config);
});
