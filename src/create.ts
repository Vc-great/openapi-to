// @ts-nocheck
import path from "path";
import fs from "fs-extra";
import configTemplate from "../template/config";
import { success } from "./color-console";
import { GenerateCode } from "./GenerateCode";
import { GenerateType } from "./GenerateType";
import { GenerateForm } from "./GenerateForm";
import { GenerateTable } from "./GenerateTable";
import { GenerateApi } from "./GenerateApi";
import { ConfigTemplate } from "./types";

// 命令运行时的目录
const cwd = process.cwd();
const configPath = path.join(cwd, ".OpenAPI/OpenAPI.config.js");

//生成配置文件
export const createFile = () => {
  createGitignore();
  createConfig();
};

//生成代码
export const createCode = async () => {
  success("读取配置文件...");
  //读取配置文件
  const config: ConfigTemplate = import(configPath);
  success("读取配置文件成功。");
  //todo 增加容错处理
  config.projects.map((item) => {
    const generateCode = new GenerateCode({
      ...item,
      projectDir: cwd,
    });
    const { openApi3SourceData, openApi3FormatData } =
      await generateCode.init();
    generateCode.register(
      [GenerateType, GenerateForm, GenerateTable, GenerateApi].map(
        (item) => new item(config, openApi3SourceData, openApi3FormatData)
      )
    );
    generateCode.run();
  });
};

export function generateCode(config: ConfigTemplate) {
  config.projects.map((item) => {
    const generateCode = new GenerateCode({
      ...item,
      projectDir: cwd,
    });
    const { openApi3SourceData, openApi3FormatData } =
      await generateCode.init();
    generateCode.register(
      [GenerateType, GenerateForm, GenerateTable, GenerateApi].map(
        (item) => new item(config, openApi3SourceData, openApi3FormatData)
      )
    );
    generateCode.run();
  });
}

/***
 * 创建yapi配置文件
 * @returns {*}
 */
function createConfig() {
  const dir = path.join(cwd, ".OpenAPI");
  const configFileDir = path.join(cwd, ".OpenAPI/OpenAPI.config.js");

  if (fs.pathExistsSync(dir) && fs.pathExistsSync(configFileDir)) {
    return success("OpenAPI.config.js文件存在，请填写配置文件。");
  }

  fs.ensureDirSync(dir, {});

  if (fs.pathExistsSync(configFileDir)) {
    success("OpenAPI.config.js文件存在，请填写配置文件。");
  } else {
    fs.outputFileSync(configFileDir, configTemplate);
    success("初始化成功，请填写配置文件。");
  }
}

/**
 * 创建gitignore文件
 */
function createGitignore() {
  const gitignorePath = path.join(cwd, ".gitignore");

  if (fs.pathExistsSync(gitignorePath)) {
    //文件存在
    const fileContent = fs.readFileSync(gitignorePath, {
      encoding: "utf8",
      flag: "r",
    });
    const hasYapi = fileContent
      .split("\n")
      .some((item) => item.includes(".yapi") && !item.includes("#"));

    if (!hasYapi) {
      fs.writeFileSync(
        gitignorePath,
        `${fileContent}\n# 根据yapi文件生成api\n.yapi`,
        "utf8"
      );
      success("向.gitignore文件添加.yapi成功");
    }
  } else {
    //文件不存在
    fs.writeFileSync(gitignorePath, `# 根据yapi文件生成api\n.yapi`, "utf8");
    success("创建.gitignore文件成功");
  }
}
