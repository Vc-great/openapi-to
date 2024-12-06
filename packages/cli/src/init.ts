import pathParser from "node:path";
import path from "node:path";

import { PackageManager } from "@openapi-to/core";
import { folderName, pathExistsSync, readSync, write } from "@openapi-to/core";

import c from "picocolors";
import process from "process";

import { spinner } from "./utils/spinner.ts";
import { commonPresetMeta, modulePresetMeta } from "./presetMeta.ts";

export async function init(): Promise<undefined> {
  spinner.start("📦 Initializing openapi-to");
  await createConfig();
  await createGitignore();
  spinner.succeed(`📦 initialized openapi-to`);
  return;
}

async function createConfig() {
  const packageJson = await new PackageManager(
    path.resolve(process.cwd(), "./package.json"),
  ).getPackageJSON();
  const extension = packageJson?.type === "module" ? ".ts" : ".js";
  const configName = `${folderName}/openapi.config${extension}`;
  const filePath = pathParser.resolve(process.cwd(), configName);
  spinner.start(`📀 Writing \`${configName}\` ${c.dim(filePath)}`);
  const presetMeta =
    packageJson?.type === "module" ? modulePresetMeta : commonPresetMeta;
  await write(filePath, presetMeta);
  spinner.succeed(`📀 Wrote \`${configName}\` ${c.dim(filePath)}`);
}

/**
 * 创建gitignore文件
 */
async function createGitignore() {
  const path = pathParser.resolve(process.cwd(), ".gitignore");
  const content = "# https://github.com/Vc-great/openapi-to\n.OpenAPI";
  spinner.start(`📀 Writing \`.OpenAPI to the .gitignore\` ${c.dim(path)}`);

  if (pathExistsSync(path)) {
    const fileContent: string = readSync(path);
    const hasOpenAPI = fileContent
      .split("\n")
      .some((item) => item.includes(".OpenAPI") && !item.includes("#"));
    !hasOpenAPI && (await write(`${fileContent}\n${content}`, path));
  } else {
    await write(content, path);
  }
  spinner.succeed(`📀 Wrote \`.OpenAPI to the .gitignore\` ${c.dim(path)}`);
}
