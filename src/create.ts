// @ts-nocheck
import path from "path";
import fse from "fs-extra";
import { configTemplate } from "./configTemplate";
import { errorLog, successLog } from "./log";
import { GenerateCode } from "./GenerateCode";
import { GenerateTSInterface } from "./GenerateTSInterface";
import { GenerateTSRequest } from "./GenerateTSRequest";
import { GenerateJSRequest } from "./GenerateJSRequest";
import { ConfigTemplate } from "./types";
import { pathToFileURL } from "node:url";
import { updateVersionMessage } from "./version";
import { GenerateRequestObject } from "./GenerateRequestObject";
// 命令运行时的目录
const cwd = process.cwd();
const configPath = pathToFileURL(
  path.resolve(cwd, ".openAPI/openAPI.config.js")
);

//生成配置文件
export const createFile = () => {
  createGitignore();
  createConfig();
};

//生成代码
export const createCode = async () => {
  successLog("读取配置文件...");
  //读取配置文件
  const [e, config] = await import(configPath).then(
    (res) => [undefined, res.default],
    (err) => [err, undefined]
  );
  if (e) {
    errorLog(`读取配置文件出错,请检查!,${e}`);
    return;
  }
  successLog("读取配置文件成功。");
  //todo 增加容错处理
  await generateApiCode(config);
};

export async function generateApiCode(config: ConfigTemplate) {
  const map = config.projects.map(async (item) => {
    const output = config.output
      ? path.join(config.output, item.title)
      : path.join(cwd, `.openAPI/${item.title}`);
    //创建目录
    const dir = fse.ensureDirSync(output);
    //
    const generateCode = new GenerateCode({
      ...item,
      output: output,
      projectDir: cwd,
    });
    const { openApi3SourceData, openApi3FormatData } =
      await generateCode.init();
    generateCode.register(
      [
        GenerateTSInterface,
        GenerateTSRequest,
        GenerateJSRequest,
        GenerateRequestObject,
      ].map(
        (item) =>
          new item(
            {
              ...item,
              output: output,
              projectDir: cwd,
            },
            openApi3SourceData,
            openApi3FormatData
          )
      )
    );
    generateCode.allRun();
  });
  await Promise.all(map);
  updateVersionMessage();
}
/***
 * 创建yapi配置文件
 * @returns {*}
 */
function createConfig() {
  const dir = path.join(cwd, ".openAPI");
  const configFileDir = path.join(cwd, ".openAPI/openAPI.config.js");

  if (fse.pathExistsSync(dir) && fse.pathExistsSync(configFileDir)) {
    return successLog("openAPI.config.js文件存在，请填写配置文件。");
  }

  fse.ensureDirSync(dir, {});

  if (fse.pathExistsSync(configFileDir)) {
    successLog("openAPI.config.js文件存在，请填写配置文件。");
  } else {
    fse.outputFileSync(configFileDir, configTemplate);
    successLog("初始化成功，请填写配置文件。");
  }
}

/**
 * 创建gitignore文件
 */
function createGitignore() {
  const gitignorePath = path.join(cwd, ".gitignore");

  if (fse.pathExistsSync(gitignorePath)) {
    //文件存在
    const fileContent = fse.readFileSync(gitignorePath, {
      encoding: "utf8",
      flag: "r",
    });
    const hasDir = fileContent
      .split("\n")
      .some((item) => item.includes(".openAPI") && !item.includes("#"));

    if (!hasDir) {
      fse.writeFileSync(
        gitignorePath,
        `${fileContent}\n# 根据openAPI接口文档生成api\n.openAPI`,
        "utf8"
      );
      successLog("向.gitignore文件添加.yapi成功");
    }
  } else {
    //文件不存在
    fse.writeFileSync(
      gitignorePath,
      `# 根据openAPI接口文档生成api\n.openAPI`,
      "utf8"
    );
    successLog("创建.gitignore文件成功");
  }
}
