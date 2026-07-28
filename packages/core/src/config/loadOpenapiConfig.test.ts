import { createHash } from "node:crypto";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	symlink,
	utimes,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadOpenapiConfig } from "./loadOpenapiConfig.ts";

describe("loadOpenapiConfig", () => {
	it.each([
		["ts", 'export default { servers: [], plugins: [], format: "ts" }\n'],
		["js", 'module.exports = { servers: [], plugins: [], format: "js" }\n'],
		["cjs", 'module.exports = { servers: [], plugins: [], format: "cjs" }\n'],
		["mjs", 'export default { servers: [], plugins: [], format: "mjs" }\n'],
	])("discovers a root openapi.config.%s file", async (extension, contents) => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), "openapi-config-discovery-"),
		);
		const configPath = path.join(root, `openapi.config.${extension}`);
		await writeFile(configPath, contents);
		await expect(
			loadOpenapiConfig({ cwd: root, localFileRoot: root }),
		).resolves.toMatchObject({
			config: { format: extension },
			filepath: configPath,
			sources: [expect.objectContaining({ path: await realpath(configPath) })],
		});
	});

	it("finds the nearest root configuration while searching upward from a child directory", async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), "openapi-config-parent-"),
		);
		const child = path.join(root, "packages", "consumer");
		await mkdir(child, { recursive: true });
		await writeFile(
			path.join(root, "openapi.config.ts"),
			'export default { servers: [], plugins: [], owner: "root" }\n',
		);
		await writeFile(
			path.join(root, "packages", "openapi.config.ts"),
			'export default { servers: [], plugins: [], owner: "nearest" }\n',
		);
		await expect(
			loadOpenapiConfig({ cwd: child, localFileRoot: root }),
		).resolves.toMatchObject({
			config: { owner: "nearest" },
			filepath: path.join(root, "packages", "openapi.config.ts"),
		});
	});

	it.each([".OpenAPI", ".openapi-to"])(
		"does not discover configuration below %s",
		async (directory) => {
			const root = await mkdtemp(
				path.join(os.tmpdir(), "openapi-config-unsupported-"),
			);
			await mkdir(path.join(root, directory));
			await writeFile(
				path.join(root, directory, "openapi.config.ts"),
				"export default { servers: [], plugins: [] }\n",
			);
			await expect(
				loadOpenapiConfig({ cwd: root, localFileRoot: root }),
			).rejects.toThrow(/not defined/);
		},
	);

	it("fails with a stable diagnostic before executing ambiguous root configurations", async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), "openapi-config-ambiguous-"),
		);
		const marker = path.join(root, "executed.txt");
		const executable = `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed'); export default { servers: [], plugins: [] };\n`;
		await writeFile(path.join(root, "openapi.config.ts"), executable);
		await writeFile(
			path.join(root, "openapi.config.js"),
			`require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); module.exports = { servers: [], plugins: [] };\n`,
		);
		await expect(
			loadOpenapiConfig({ cwd: root, localFileRoot: root }),
		).rejects.toMatchObject({
			diagnostics: [
				{
					code: "OPENAPI_CONFIG_AMBIGUOUS",
					message:
						"Multiple OpenAPI configuration files were found in the nearest configuration directory: openapi.config.js, openapi.config.ts.",
				},
			],
		});
		await expect(access(marker)).rejects.toThrow();
	});

	it("loads an explicitly selected file without checking discovery conflicts", async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), "openapi-config-explicit-"),
		);
		await writeFile(
			path.join(root, "openapi.config.ts"),
			'export default { servers: [], plugins: [], selected: "ts" }\n',
		);
		await writeFile(
			path.join(root, "openapi.config.js"),
			'module.exports = { servers: [], plugins: [], selected: "js" }\n',
		);
		await expect(
			loadOpenapiConfig({
				cwd: root,
				configPath: "openapi.config.js",
				localFileRoot: root,
			}),
		).resolves.toMatchObject({
			config: { selected: "js" },
			filepath: path.join(root, "openapi.config.js"),
		});
	});

	it("loads an explicit trusted config and blocks relative imports outside localFileRoot before execution", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "openapi-config-root-"));
		const outside = await mkdtemp(
			path.join(os.tmpdir(), "openapi-config-outside-"),
		);
		const safeConfig = path.join(root, "openapi.config.ts");
		await writeFile(
			safeConfig,
			"export default { servers: [], plugins: [] }\n",
		);
		await expect(
			loadOpenapiConfig({
				cwd: root,
				configPath: safeConfig,
				localFileRoot: root,
			}),
		).resolves.toMatchObject({ config: { servers: [], plugins: [] } });

		const marker = path.join(outside, "executed.txt");
		await writeFile(
			path.join(outside, "dependency.ts"),
			`import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed'); export default {};\n`,
		);
		await writeFile(
			path.join(root, "unsafe.config.ts"),
			`import dependency from ${JSON.stringify(path.join(outside, "dependency.ts"))}; export default { servers: [], plugins: [dependency] };\n`,
		);
		await expect(
			loadOpenapiConfig({
				cwd: root,
				configPath: path.join(root, "unsafe.config.ts"),
				localFileRoot: root,
			}),
		).rejects.toThrow(/inside the configured local file root/);
		await expect(access(marker)).rejects.toThrow();
	});

	it("rejects a config entry symlink escape", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "openapi-config-root-"));
		const outside = await mkdtemp(
			path.join(os.tmpdir(), "openapi-config-outside-"),
		);
		const target = path.join(outside, "openapi.config.js");
		await writeFile(target, "module.exports = { servers: [], plugins: [] }\n");
		const linked = path.join(root, "openapi.config.js");
		await symlink(target, linked);
		await expect(
			loadOpenapiConfig({ cwd: root, configPath: linked, localFileRoot: root }),
		).rejects.toThrow(/inside the configured local file root/);
	});

	it("fails closed when config metadata changes during bundling", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "openapi-config-race-"));
		const config = path.join(root, "openapi.config.ts");
		await writeFile(
			config,
			`/*${"x".repeat(4 * 1024 * 1024)}*/\nexport default { servers: [], plugins: [] }\n`,
		);
		const timer = setInterval(() => {
			void utimes(config, new Date(), new Date());
		}, 1);
		await expect(
			loadOpenapiConfig({ cwd: root, configPath: config, localFileRoot: root }),
		).rejects.toThrow(/changed while it was being loaded/);
		clearInterval(timer);
	});

	it("snapshots and hashes every loaded local configuration source", async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), "openapi-config-sources-"),
		);
		const dependency = path.join(root, "config-helper.ts");
		const config = path.join(root, "openapi.config.ts");
		await writeFile(dependency, 'export const targetName = "fixture"\n');
		await writeFile(
			config,
			'import { targetName } from "./config-helper.ts"\nexport default { servers: [], plugins: [], targetName }\n',
		);

		const loaded = await loadOpenapiConfig({ cwd: root, localFileRoot: root });
		expect(loaded.sources.map((source) => source.path)).toEqual(
			await Promise.all(
				[dependency, config].sort().map((source) => realpath(source)),
			),
		);
		for (const source of loaded.sources) {
			const contents = await readFile(source.path);
			expect(source.sha256).toBe(
				createHash("sha256").update(contents).digest("hex"),
			);
			expect(source.bytes).toBe(contents.byteLength);
		}
	});
});
