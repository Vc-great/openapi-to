import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageDirectories = [
	"packages/core",
	"packages/cli",
	"packages/mcp",
	"packages/plugin-msw",
	"packages/plugin-swr",
	"packages/plugin-ts-request",
	"packages/plugin-ts-type",
	"packages/plugin-vue-query",
	"packages/plugin-zod",
	"packages/openapi",
];
const forbiddenTarballPaths = [
	/(^|\/)test-output(\/|$)/,
	/(^|\/)coverage(\/|$)/,
	/(^|\/)fixtures?(\/|$)/i,
	/(^|\/)\.agents(\/|$)/,
	/(^|\/)AGENTS\.md$/,
	/(^|\/)\.env(?:\.|$)/,
	/(^|\/)ownership-manifest/i,
	/\.log$/,
	/\.map$/,
];

function run(command, args, cwd, options = {}) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		env: {
			...process.env,
			CI: "1",
			NO_UPDATE_NOTIFIER: "1",
			...options.env,
		},
	});
	if (result.error) throw result.error;
	if (result.status !== (options.expectedStatus ?? 0)) {
		throw new Error(
			`${command} ${args.join(" ")} exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
		);
	}
	return result;
}

function pnpm(args, cwd) {
	const executable = process.env.npm_execpath;
	if (executable) return run(process.execPath, [executable, ...args], cwd);
	const suffix = process.platform === "win32" ? ".cmd" : "";
	return run(resolve(repositoryRoot, "node_modules", ".bin", `pnpm${suffix}`), args, cwd);
}

function parsePackResult(stdout) {
	const start = stdout.indexOf("{");
	if (start < 0) throw new Error(`pnpm pack did not return JSON: ${stdout}`);
	return JSON.parse(stdout.slice(start));
}

function exportTargets(value) {
	if (typeof value === "string") return [value];
	if (!value || typeof value !== "object") return [];
	return Object.values(value).flatMap(exportTargets);
}

function binPath(installationDirectory, name) {
	const suffix = process.platform === "win32" ? ".cmd" : "";
	return join(installationDirectory, "node_modules", ".bin", `${name}${suffix}`);
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "openapi-to-release-smoke-"));
const tarballDirectory = join(temporaryRoot, "tarballs");
const installationDirectory = join(temporaryRoot, "consumer");
await writeFile(join(temporaryRoot, ".keep"), "release smoke workspace\n");
await Promise.all([
	mkdir(tarballDirectory, { recursive: true }),
	mkdir(installationDirectory, { recursive: true }),
]);

let succeeded = false;
try {
	const packed = [];
	for (const directory of packageDirectories) {
		const packageDirectory = join(repositoryRoot, directory);
		const manifest = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
		const result = parsePackResult(
			pnpm(["pack", "--json", "--pack-destination", tarballDirectory], packageDirectory).stdout,
		);
		const archive = result.filename;
		const archiveStat = await stat(archive);
		const filePaths = result.files.map(({ path }) => path).sort();
		const forbidden = filePaths.filter((path) => forbiddenTarballPaths.some((pattern) => pattern.test(path)));
		if (forbidden.length > 0) {
			throw new Error(`${result.name} tarball contains forbidden files: ${forbidden.join(", ")}`);
		}
		for (const required of ["package.json"]) {
			if (!filePaths.includes(required)) throw new Error(`${result.name} tarball is missing ${required}`);
		}
		const packageTargets = [
			manifest.main,
			manifest.module,
			manifest.types,
			...exportTargets(manifest.exports),
			...Object.values(manifest.bin ?? {}),
		]
			.filter((target) => typeof target === "string" && !target.includes("*"))
			.map((target) => target.replace(/^\.\//, ""));
		for (const target of new Set(packageTargets)) {
			if (!filePaths.includes(target)) throw new Error(`${result.name} tarball is missing declared target ${target}`);
		}
		packed.push({
			name: result.name,
			version: result.version,
			filename: basename(archive),
			archive,
			size: archiveStat.size,
			files: filePaths,
		});
	}

	await writeFile(
		join(installationDirectory, "package.json"),
		JSON.stringify(
			{
				name: "openapi-to-release-smoke",
				private: true,
				type: "module",
				dependencies: Object.fromEntries(
					packed.map(({ name, archive }) => [name, `file:${archive}`]).sort(([left], [right]) =>
						left < right ? -1 : left > right ? 1 : 0,
					),
				),
				devDependencies: {
					"@modelcontextprotocol/sdk": "1.29.0",
					"@types/node": "^22.7.4",
					zod: "3.25.76",
				},
				pnpm: {
					overrides: Object.fromEntries(
						packed.map(({ name, archive }) => [name, `file:${archive}`]).sort(([left], [right]) =>
							left < right ? -1 : left > right ? 1 : 0,
						),
					),
				},
			},
			null,
			2,
		),
	);
	pnpm(["install", "--ignore-scripts", "--prefer-offline"], installationDirectory);

	const minimumDocument = `openapi: 3.0.3
info:
  title: Release Smoke
  version: 1.0.0
paths:
  /ping:
    get:
      operationId: ping
      responses:
        "200":
          description: OK
`;
	await writeFile(join(installationDirectory, "openapi.yaml"), minimumDocument);
	await writeFile(
		join(installationDirectory, "esm-smoke.mjs"),
		`import {
  compileOpenAPI,
  inspectOpenAPIDocument,
  diffOpenAPIDocuments,
  pluginSWR,
  pluginMSW,
} from "openapi-to";
import { definePlugin as swrPackage } from "@openapi-to/plugin-swr";
import { definePlugin as mswPackage } from "@openapi-to/plugin-msw";
const document = {
  openapi: "3.0.3",
  info: { title: "Release Smoke", version: "1.0.0" },
  paths: { "/ping": { get: { operationId: "ping", responses: { "200": { description: "OK" } } } } },
};
const compilation = await compileOpenAPI(document);
if (!compilation.success || !compilation.document) throw new Error("compileOpenAPI failed");
const inspection = inspectOpenAPIDocument(compilation.document);
if (inspection.pathCount !== 1 || inspection.operationCount !== 1) throw new Error("inspect failed");
const difference = diffOpenAPIDocuments(compilation.document, compilation.document);
if (difference.breaking || difference.changes.length !== 0) throw new Error("diff failed");
if (pluginSWR !== swrPackage || pluginMSW !== mswPackage || pluginSWR === pluginMSW) throw new Error("plugin identity failed");
if (pluginSWR().name !== "SWR" || pluginMSW().name !== "MSW") throw new Error("plugin name failed");
`,
	);
	await writeFile(
		join(installationDirectory, "cjs-smoke.cjs"),
		`const openapiTo = require("openapi-to");
const swr = require("@openapi-to/plugin-swr");
const msw = require("@openapi-to/plugin-msw");
const mcp = require("@openapi-to/mcp");
if (typeof openapiTo.compileOpenAPI !== "function") throw new Error("CJS core export missing");
if (openapiTo.pluginSWR !== swr.definePlugin || openapiTo.pluginMSW !== msw.definePlugin) throw new Error("CJS plugin identity failed");
if (openapiTo.pluginSWR === openapiTo.pluginMSW) throw new Error("CJS plugins collapsed");
if (typeof mcp.createOpenapiToMcpServer !== "function") throw new Error("MCP CJS export missing");
`,
	);
	await writeFile(
		join(installationDirectory, "types-smoke.ts"),
		`import {
  compileOpenAPI,
  inspectOpenAPIDocument,
  diffOpenAPIDocuments,
  pluginSWR,
  pluginMSW,
  type Diagnostic,
  type GeneratedArtifact,
  type GenerationManifest,
	  type GenerationResult,
	} from "openapi-to";
import { createOpenapiToMcpServer, type OpenapiToMcpServerOptions } from "@openapi-to/mcp";
const diagnostic: Diagnostic = { code: "SMOKE", severity: "info", message: "smoke" };
declare const artifact: GeneratedArtifact;
declare const manifest: GenerationManifest;
declare const generation: GenerationResult;
const mcpOptions: OpenapiToMcpServerOptions = { workspaceRoot: "." };
void [compileOpenAPI, inspectOpenAPIDocument, diffOpenAPIDocuments, pluginSWR, pluginMSW, diagnostic, artifact, manifest, generation, createOpenapiToMcpServer, mcpOptions];
`,
	);
	await writeFile(
		join(installationDirectory, "mcp-esm-smoke.mjs"),
		`import { createOpenapiToMcpServer } from "@openapi-to/mcp";
const server = createOpenapiToMcpServer({ workspaceRoot: process.cwd() });
if (typeof server.connect !== "function") throw new Error("MCP ESM export missing");
await server.close();
`,
	);
	await writeFile(
		join(installationDirectory, "mcp-stdio-smoke.mjs"),
		`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const transport = new StdioClientTransport({ command: process.argv[2], args: ["--workspace-root", process.cwd()], stderr: "pipe" });
const client = new Client({ name: "release-smoke", version: "1.0.0" });
await client.connect(transport);
const tools = await client.listTools();
if (tools.tools.map(({ name }) => name).join(",") !== "openapi_validate,openapi_inspect,openapi_diff") throw new Error("Unexpected no-config MCP tool matrix");
const result = await client.callTool({ name: "openapi_validate", arguments: { source: "openapi.yaml" } });
if (result.isError || result.structuredContent?.success !== true) throw new Error("MCP validate smoke failed");
await client.close();
`,
	);
	await writeFile(
		join(installationDirectory, "tsconfig.json"),
		JSON.stringify(
			{
				compilerOptions: {
					module: "NodeNext",
					moduleResolution: "NodeNext",
					target: "ES2022",
					strict: true,
					noEmit: true,
					skipLibCheck: false,
				},
				include: ["types-smoke.ts"],
			},
			null,
			2,
		),
	);

	run(process.execPath, ["esm-smoke.mjs"], installationDirectory);
	run(process.execPath, ["mcp-esm-smoke.mjs"], installationDirectory);
	run(process.execPath, ["cjs-smoke.cjs"], installationDirectory);
	run(
		resolve(repositoryRoot, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"),
		["-p", "tsconfig.json"],
		installationDirectory,
	);

	const aggregateVersion = packed.find(({ name }) => name === "openapi-to").version;
	const reportedVersions = {};
	for (const binary of ["openapi", "openapi-to"]) {
		const executable = binPath(installationDirectory, binary);
		if (process.platform !== "win32") await chmod(executable, 0o755);
		run(executable, ["--help"], installationDirectory);
		const version = run(executable, ["--version"], installationDirectory).stdout.trim();
		reportedVersions[binary] = version;
		if (!version.startsWith(`openapi/${aggregateVersion} `)) {
			throw new Error(`${binary} reported ${version}; expected openapi/${aggregateVersion}`);
		}
		for (const arguments_ of [
			["validate", "./openapi.yaml", "--json"],
			["inspect", "./openapi.yaml", "--json"],
		]) {
			const result = run(executable, arguments_, installationDirectory);
			JSON.parse(result.stdout);
		}
	}
	if (reportedVersions.openapi !== reportedVersions["openapi-to"]) {
		throw new Error(`Bin aliases report different versions: ${JSON.stringify(reportedVersions)}`);
	}
	const mcpExecutable = binPath(installationDirectory, "openapi-to-mcp");
	if (process.platform !== "win32") await chmod(mcpExecutable, 0o755);
	run(mcpExecutable, ["--help"], installationDirectory);
	const mcpVersion = run(mcpExecutable, ["--version"], installationDirectory).stdout.trim();
	const expectedMcpVersion = packed.find(({ name }) => name === "@openapi-to/mcp").version;
	if (mcpVersion !== expectedMcpVersion) throw new Error(`openapi-to-mcp reported ${mcpVersion}; expected ${expectedMcpVersion}`);
	run(process.execPath, ["mcp-stdio-smoke.mjs", mcpExecutable], installationDirectory);

	succeeded = true;
	process.stdout.write(
		`${JSON.stringify(
			{
				success: true,
				node: process.version,
				workspace: process.env.KEEP_RELEASE_SMOKE === "1" ? temporaryRoot : undefined,
				packages: packed.map(({ name, version, filename, size, files }) => ({
					name,
					version,
					filename,
					size,
					fileCount: files.length,
				})),
				versions: reportedVersions,
				checks: ["esm", "cjs", "types", "openapi-bin", "openapi-to-bin", "openapi-to-mcp-bin", "mcp-stdio", "validate-json", "inspect-json"],
			},
			null,
			2,
		)}\n`,
	);
} finally {
	if (process.env.KEEP_RELEASE_SMOKE !== "1") {
		await rm(temporaryRoot, { recursive: true, force: true });
	} else if (!succeeded) {
		process.stderr.write(`Release smoke workspace retained at ${temporaryRoot}\n`);
	}
}
