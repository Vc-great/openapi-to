import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { execa } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { init } from "./init.ts";

describe.sequential("openapi init filesystem behavior", () => {
	let originalCwd: string;
	let root: string;

	beforeEach(async () => {
		originalCwd = process.cwd();
		root = await mkdtemp(path.join(os.tmpdir(), "openapi-init-"));
		process.chdir(root);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(root, { recursive: true, force: true });
	});

	it.each([
		["commonjs", "openapi.config.js"],
		["module", "openapi.config.ts"],
	])(
		"creates a trackable root config for a %s workspace",
		async (type, configName) => {
			await writeFile(
				path.join(root, "package.json"),
				`${JSON.stringify({ private: true, type }, null, 2)}\n`,
			);
			await writeFile(
				path.join(root, ".gitignore"),
				"dist/\n.openapi-to-cache/",
			);

			await init();

			const configPath = path.join(root, configName);
			const config = await readFile(configPath, "utf8");
			expect(config).toContain(
				type === "module" ? "export default" : "module.exports",
			);
			await expect(access(path.join(root, ".OpenAPI"))).rejects.toThrow();
			await expect(access(path.join(root, ".openapi-to"))).rejects.toThrow();
			const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
			expect(gitignore.match(/^\/\.openapi-to\/$/gm)).toHaveLength(1);
			expect(gitignore).toContain(
				".openapi-to-cache/\n# https://github.com/Vc-great/openapi-to\n/.openapi-to/\n",
			);

			await execa("git", ["init", "--quiet"], { cwd: root });
			await mkdir(path.join(root, ".openapi-to"));
			await writeFile(path.join(root, ".openapi-to", "state.json"), "{}\n");
			const ignoredState = await execa(
				"git",
				["check-ignore", "--quiet", ".openapi-to/state.json"],
				{ cwd: root, reject: false },
			);
			const trackedConfig = await execa(
				"git",
				["check-ignore", "--quiet", configName],
				{ cwd: root, reject: false },
			);
			expect(ignoredState.exitCode).toBe(0);
			expect(trackedConfig.exitCode).toBe(1);

			const configBefore = await readFile(configPath, "utf8");
			const gitignoreBefore = await readFile(
				path.join(root, ".gitignore"),
				"utf8",
			);
			await expect(init()).rejects.toThrow(/configuration already exists/i);
			expect(await readFile(configPath, "utf8")).toBe(configBefore);
			expect(await readFile(path.join(root, ".gitignore"), "utf8")).toBe(
				gitignoreBefore,
			);
		},
	);
});
