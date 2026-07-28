import pathParser from "node:path";
import path from "node:path";
import { access, readFile, writeFile } from "node:fs/promises";

import { PackageManager, stateDirectoryName } from "@openapi-to/core";

import c from "picocolors";
import process from "node:process";

import { spinner } from "./utils/spinner.ts";
import { commonPresetMeta, modulePresetMeta } from "./presetMeta.ts";

const configFileNames = [
	"openapi.config.ts",
	"openapi.config.js",
	"openapi.config.cjs",
	"openapi.config.mjs",
];
const stateIgnoreRule = `/${stateDirectoryName}/`;

export async function init(): Promise<undefined> {
	spinner.start("📦 Initializing openapi-to");
	await createConfig();
	await createGitignore();
	spinner.succeed("📦 initialized openapi-to");
	return;
}

async function createConfig() {
	const packageJson = await new PackageManager(
		path.resolve(process.cwd(), "./package.json"),
	).getPackageJSON();
	const extension = packageJson?.type === "module" ? ".ts" : ".js";
	const configName = `openapi.config${extension}`;
	const filePath = pathParser.resolve(process.cwd(), configName);
	const existing = [];
	for (const candidate of configFileNames) {
		try {
			await access(pathParser.resolve(process.cwd(), candidate));
			existing.push(candidate);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	if (existing.length > 0) {
		throw new Error(
			`OpenAPI configuration already exists: ${existing.sort().join(", ")}.`,
		);
	}
	spinner.start(`📀 Writing \`${configName}\` ${c.dim(filePath)}`);
	const presetMeta =
		packageJson?.type === "module" ? modulePresetMeta : commonPresetMeta;
	await writeFile(filePath, presetMeta, { encoding: "utf8", flag: "wx" });
	spinner.succeed(`📀 Wrote \`${configName}\` ${c.dim(filePath)}`);
}

/**
 * 创建gitignore文件
 */
async function createGitignore() {
	const gitignorePath = pathParser.resolve(process.cwd(), ".gitignore");
	const content = `# https://github.com/Vc-great/openapi-to\n${stateIgnoreRule}\n`;
	spinner.start(
		`📀 Writing \`${stateIgnoreRule}\` to the .gitignore ${c.dim(gitignorePath)}`,
	);

	let fileContent = "";
	try {
		fileContent = await readFile(gitignorePath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const hasStateRule = fileContent
		.split(/\r?\n/)
		.some((line) => line.trim() === stateIgnoreRule);
	if (!hasStateRule) {
		const separator =
			fileContent.length === 0 || fileContent.endsWith("\n") ? "" : "\n";
		await writeFile(
			gitignorePath,
			`${fileContent}${separator}${content}`,
			"utf8",
		);
	}
	spinner.succeed(
		`📀 Wrote \`${stateIgnoreRule}\` to the .gitignore ${c.dim(gitignorePath)}`,
	);
}
