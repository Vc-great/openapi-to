import {
	access,
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);
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
	/(^|\/)\.openapi-to-transaction(?:\.json|\/|$)/,
	/(^|\/)\.openapi-to-write\.lock(\/|$)/,
	/(^|\/)tool-selection-cases\.json$/,
	/(^|\/)performance-baseline\.json$/,
	/(^|\/)(?:doctor|inspect|run-doctor|run-test-group)\.mjs$/,
	/(^|\/)(?:mcp-doctor|inspector)-(?:report|config)\.json$/i,
	/(^|\/)(?:staging|backup)(\/|$)/i,
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
	return run(
		resolve(repositoryRoot, "node_modules", ".bin", `pnpm${suffix}`),
		args,
		cwd,
	);
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
	return join(
		installationDirectory,
		"node_modules",
		".bin",
		`${name}${suffix}`,
	);
}

async function startRemoteFixtureServer(directory) {
	const serverPath = join(directory, "remote-openapi-server.mjs");
	await writeFile(
		serverPath,
		`import { createServer } from "node:http";
const json = JSON.stringify({
  openapi: "3.1.0",
  info: { title: "Remote JSON Service", version: "1" },
  paths: { "/remote-json": { get: { operationId: "remoteJson", responses: { "200": { description: "ok" } } } } },
});
const yaml = 'openapi: 3.1.0\\ninfo: { title: Remote YAML Service, version: "1" }\\npaths:\\n  /remote-yaml:\\n    get:\\n      operationId: remoteYaml\\n      responses: { "200": { description: ok } }\\n';
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  if (pathname === "/json") {
    response.setHeader("content-type", "text/plain");
    response.end(json);
  } else if (pathname === "/yaml") {
    response.setHeader("content-type", "application/json");
    response.end(yaml);
  } else {
    response.writeHead(404).end();
  }
});
server.listen(0, "127.0.0.1", () => process.stdout.write(String(server.address().port) + "\\n"));
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => server.close(() => process.exit(0)));
`,
	);
	const child = spawn(process.execPath, [serverPath], {
		cwd: directory,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const port = await new Promise((resolvePort, reject) => {
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error(`Remote fixture server did not start: ${stderr}`));
		}, 5_000);
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
			const line = stdout.split(/\r?\n/)[0];
			if (!/^\d+$/.test(line ?? "")) return;
			clearTimeout(timer);
			resolvePort(Number(line));
		});
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("exit", (code) => {
			if (code !== null && !stdout.includes("\n")) {
				clearTimeout(timer);
				reject(
					new Error(
						`Remote fixture server exited with ${code}: ${stderr}`,
					),
				);
			}
		});
	});
	return { child, baseURL: `http://127.0.0.1:${port}` };
}

const temporaryRoot = await mkdtemp(
	join(tmpdir(), "openapi-to-release-smoke-"),
);
const tarballDirectory = join(temporaryRoot, "tarballs");
const installationDirectory = join(temporaryRoot, "consumer");
await writeFile(join(temporaryRoot, ".keep"), "release smoke workspace\n");
await Promise.all([
	mkdir(tarballDirectory, { recursive: true }),
	mkdir(installationDirectory, { recursive: true }),
	mkdir(join(installationDirectory, ".OpenAPI"), { recursive: true }),
]);

let succeeded = false;
let remoteFixtureServer;
try {
	const packed = [];
	for (const directory of packageDirectories) {
		const packageDirectory = join(repositoryRoot, directory);
		const manifest = JSON.parse(
			await readFile(join(packageDirectory, "package.json"), "utf8"),
		);
		const result = parsePackResult(
			pnpm(
				["pack", "--json", "--pack-destination", tarballDirectory],
				packageDirectory,
			).stdout,
		);
		const archive = result.filename;
		const archiveStat = await stat(archive);
		const filePaths = result.files.map(({ path }) => path).sort();
		const forbidden = filePaths.filter((path) =>
			forbiddenTarballPaths.some((pattern) => pattern.test(path)),
		);
		if (
			result.name === "@openapi-to/mcp" &&
			filePaths.some((path) => path.startsWith("scripts/"))
		) {
			forbidden.push(
				...filePaths.filter((path) => path.startsWith("scripts/")),
			);
		}
		if (forbidden.length > 0) {
			throw new Error(
				`${result.name} tarball contains forbidden files: ${forbidden.join(", ")}`,
			);
		}
		for (const required of ["package.json"]) {
			if (!filePaths.includes(required))
				throw new Error(`${result.name} tarball is missing ${required}`);
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
			if (!filePaths.includes(target))
				throw new Error(
					`${result.name} tarball is missing declared target ${target}`,
				);
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
					packed
						.map(({ name, archive }) => [name, `file:${archive}`])
						.sort(([left], [right]) =>
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
						packed
							.map(({ name, archive }) => [name, `file:${archive}`])
							.sort(([left], [right]) =>
								left < right ? -1 : left > right ? 1 : 0,
							),
					),
				},
			},
			null,
			2,
		),
	);
	pnpm(
		["install", "--ignore-scripts", "--prefer-offline"],
		installationDirectory,
	);

	const minimumDocument = `openapi: 3.0.3
info:
  title: Order Service
  version: 1.0.0
paths:
  /orders/{id}:
    get:
      operationId: getById
      responses:
        "200":
          description: OK
`;
	const userDocument = {
		openapi: "3.1.0",
		info: { title: "User Service", version: "1.0.0" },
		paths: {
			"/users/{id}": {
				get: {
					operationId: "getById",
					responses: { 200: { description: "OK" } },
				},
			},
		},
	};
	await writeFile(
		join(installationDirectory, "user.json"),
		`${JSON.stringify(userDocument, null, 2)}\n`,
	);
	await writeFile(
		join(installationDirectory, "order.yaml"),
		minimumDocument,
	);
	await writeFile(
		join(installationDirectory, "legacy.yml"),
		minimumDocument.replace("Order Service", "Legacy Service").replace(
			"getById",
			"legacyGetById",
		),
	);
	await writeFile(
		join(installationDirectory, "openapi.yaml"),
		minimumDocument,
	);
	await writeFile(join(installationDirectory, "invalid.yaml"), "openapi: [\n");
	remoteFixtureServer =
		await startRemoteFixtureServer(installationDirectory);
	await writeFile(
		join(installationDirectory, ".OpenAPI/openapi.config.cjs"),
		`module.exports = {
  servers: [
    { name: "user-service", input: { path: "./user.json" }, output: { base: "workspace", dir: "src/api/generated/user", clean: true } },
    { name: "order-service", input: { path: "./order.yaml" }, output: { base: "workspace", dir: "src/api/generated/order", clean: true } },
    { name: "legacy-service", input: { path: "./legacy.yml" }, output: { dir: "legacy", clean: true } },
    { name: "remote-json", input: { path: "${remoteFixtureServer.baseURL}/json?service=remote&token=release-smoke", remote: { allowPrivateNetwork: true, allowedHosts: ["127.0.0.1"] } }, output: { base: "workspace", dir: "src/api/generated/remote-json", clean: true } },
    { name: "remote-yaml", input: { path: "${remoteFixtureServer.baseURL}/yaml", remote: { allowPrivateNetwork: true, allowedHosts: ["127.0.0.1"] } }, output: { base: "workspace", dir: "src/api/generated/remote-yaml", clean: true } }
  ],
  plugins: [{ name: "release-write-smoke", hooks: { buildStart(ctx) {
    ctx.addArtifact({ kind: "text", path: "client.txt", content: ctx.openapiToSingleConfig.name + "\\n" });
  } } }]
};
`,
	);
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
  type OutputBase,
	} from "openapi-to";
import { createOpenapiToMcpServer, type OpenapiToMcpServerOptions } from "@openapi-to/mcp";
const diagnostic: Diagnostic = { code: "SMOKE", severity: "info", message: "smoke" };
const outputBase: OutputBase = "workspace";
declare const artifact: GeneratedArtifact;
declare const manifest: GenerationManifest;
declare const generation: GenerationResult;
const mcpOptions: OpenapiToMcpServerOptions = { workspaceRoot: ".", configPath: "openapi.config.cjs", allowWrite: true };
void [compileOpenAPI, inspectOpenAPIDocument, diffOpenAPIDocuments, pluginSWR, pluginMSW, diagnostic, outputBase, artifact, manifest, generation, createOpenapiToMcpServer, mcpOptions];
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
		`import { access, readFile, readdir } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const analysisTools = ["openapi_validate", "openapi_inspect", "openapi_diff"];
const configuredTools = [...analysisTools, "openapi_list_targets", "openapi_search_operations", "openapi_get_operation", "openapi_generate_dry_run", "openapi_check_generation"];
const writeToolNames = [...configuredTools, "openapi_prepare_generation", "openapi_apply_generation"];
function assertToolMatrix(listed, expected) {
  if (listed.map(({ name }) => name).join(",") !== expected.join(",")) throw new Error("Unexpected packed MCP tool matrix");
  for (const tool of listed) {
    if (!tool.title || !tool.description || tool.inputSchema?.type !== "object" || tool.outputSchema?.type !== "object") throw new Error("Packed MCP schema metadata is incomplete");
    const write = tool.name === "openapi_apply_generation";
    if (tool.annotations?.readOnlyHint !== !write || tool.annotations?.destructiveHint !== write || tool.annotations?.idempotentHint !== (write ? false : tool.name !== "openapi_prepare_generation")) throw new Error("Packed MCP annotations are incorrect");
  }
}
const transport = new StdioClientTransport({ command: process.argv[2], args: ["--workspace-root", process.cwd()], stderr: "pipe" });
const client = new Client({ name: "release-smoke", version: "1.0.0" });
await client.connect(transport);
const tools = await client.listTools();
assertToolMatrix(tools.tools, analysisTools);
const result = await client.callTool({ name: "openapi_validate", arguments: { source: "openapi.yaml" } });
if (result.isError || result.structuredContent?.success !== true) throw new Error("MCP validate smoke failed");
await client.close();

const configuredTransport = new StdioClientTransport({ command: process.argv[2], args: ["--workspace-root", process.cwd(), "--config", ".OpenAPI/openapi.config.cjs", "--allow-private-network", "--allow-host", "127.0.0.1"], stderr: "pipe" });
const configuredClient = new Client({ name: "release-configured-smoke", version: "1.0.0" });
await configuredClient.connect(configuredTransport);
const configured = await configuredClient.listTools();
assertToolMatrix(configured.tools, configuredTools);
if (configured.tools.some(({ name }) => name === "openapi_prepare_generation" || name === "openapi_apply_generation")) throw new Error("Packed MCP exposed write tools without --allow-write");
const listedTargets = await configuredClient.callTool({ name: "openapi_list_targets", arguments: {} });
if (listedTargets.isError || listedTargets.structuredContent?.targets?.map(({ name }) => name).join(",") !== "user-service,order-service,legacy-service,remote-json,remote-yaml") throw new Error("Packed MCP target order failed");
const userSearch = await configuredClient.callTool({ name: "openapi_search_operations", arguments: { target: "user-service", query: "getById" } });
const orderSearch = await configuredClient.callTool({ name: "openapi_search_operations", arguments: { target: "order-service", query: "getById" } });
if (userSearch.isError || userSearch.structuredContent?.items?.[0]?.path !== "/users/{id}") throw new Error("Packed MCP user target search leaked or failed");
if (orderSearch.isError || orderSearch.structuredContent?.items?.[0]?.path !== "/orders/{id}") throw new Error("Packed MCP order target search leaked or failed");
const userContract = await configuredClient.callTool({ name: "openapi_get_operation", arguments: { target: "user-service", operationKey: "getById" } });
const orderContract = await configuredClient.callTool({ name: "openapi_get_operation", arguments: { target: "order-service", operationKey: "getById" } });
if (userContract.isError || userContract.structuredContent?.operation?.path !== "/users/{id}") throw new Error("Packed MCP user contract lookup leaked or failed");
if (orderContract.isError || orderContract.structuredContent?.operation?.path !== "/orders/{id}") throw new Error("Packed MCP order contract lookup leaked or failed");
await configuredClient.close();

const writeStderr = [];
const writeTransport = new StdioClientTransport({ command: process.argv[2], args: ["--workspace-root", process.cwd(), "--config", ".OpenAPI/openapi.config.cjs", "--allow-write", "--allow-private-network", "--allow-host", "127.0.0.1"], stderr: "pipe" });
writeTransport.stderr?.on("data", (chunk) => writeStderr.push(String(chunk)));
const writeClient = new Client({ name: "release-write-smoke", version: "1.0.0" });
await writeClient.connect(writeTransport);
const writeTools = await writeClient.listTools();
assertToolMatrix(writeTools.tools, writeToolNames);
const prepared = await writeClient.callTool({ name: "openapi_prepare_generation", arguments: { targets: ["user-service"], selection: { type: "add", operationKeys: ["getById"] } } });
const plan = prepared.structuredContent?.plan;
if (prepared.isError || !plan || plan.kind !== "selective" || plan.applySupported !== true || typeof plan.token !== "string" || plan.summary.added !== 1) throw new Error("MCP selective Prepare smoke failed");
try { await access("src/api/generated/user"); throw new Error("Prepare wrote the output directory"); } catch (error) { if (!(error && error.code === "ENOENT")) throw error; }
try { await access(".OpenAPI/selections"); throw new Error("Prepare wrote the selection directory"); } catch (error) { if (!(error && error.code === "ENOENT")) throw error; }
const applied = await writeClient.callTool({ name: "openapi_apply_generation", arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } });
if (applied.isError || applied.structuredContent?.applied !== true || applied.structuredContent?.planKind !== "selective" || applied.structuredContent?.selectionApplied !== true || applied.structuredContent?.selectedOperationCount !== 1) throw new Error("MCP selective Apply smoke failed");
if (await readFile("src/api/generated/user/client.txt", "utf8") !== "user-service\\n") throw new Error("MCP Apply wrote unexpected bytes");
const ownership = JSON.parse(await readFile("src/api/generated/user/.openapi-to-manifest.json", "utf8"));
if (ownership.version !== 2 || ownership.files.length !== 1) throw new Error("MCP Apply ownership manifest failed");
const selectionFiles = await readdir(".OpenAPI/selections");
if (selectionFiles.length !== 1) throw new Error("MCP selective Apply wrote an unexpected selection file set");
const selection = JSON.parse(await readFile(".OpenAPI/selections/" + selectionFiles[0], "utf8"));
if (selection.target !== "user-service" || selection.operations?.join(",") !== "getById") throw new Error("MCP selective Apply wrote unexpected selection state");
const replay = await writeClient.callTool({ name: "openapi_apply_generation", arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } });
if (!replay.isError || !replay.structuredContent?.diagnostics?.some(({ code }) => code === "MCP_PLAN_ALREADY_USED")) throw new Error("MCP Apply replay was not rejected");
const current = await writeClient.callTool({ name: "openapi_check_generation", arguments: { targets: ["user-service"] } });
if (current.structuredContent?.outdated !== false) throw new Error("MCP Apply output is not current");
const unchanged = await writeClient.callTool({ name: "openapi_prepare_generation", arguments: { targets: ["user-service"] } });
const unchangedSummary = unchanged.structuredContent?.plan?.summary;
if (unchanged.isError || !unchangedSummary || unchangedSummary.added !== 0 || unchangedSummary.modified !== 0 || unchangedSummary.deleted !== 0) throw new Error("MCP second Prepare was not unchanged");
if (writeStderr.join("").includes(plan.token)) throw new Error("MCP token leaked to stderr");
if (writeStderr.join("").includes(unchanged.structuredContent.plan.token)) throw new Error("MCP second plan token leaked to stderr");
await writeClient.close();
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
		resolve(
			repositoryRoot,
			"node_modules",
			".bin",
			process.platform === "win32" ? "tsc.cmd" : "tsc",
		),
		["-p", "tsconfig.json"],
		installationDirectory,
	);

	const aggregateVersion = packed.find(
		({ name }) => name === "openapi-to",
	).version;
	const reportedVersions = {};
	for (const binary of ["openapi", "openapi-to"]) {
		const executable = binPath(installationDirectory, binary);
		if (process.platform !== "win32") await chmod(executable, 0o755);
		run(executable, ["--help"], installationDirectory);
		const version = run(
			executable,
			["--version"],
			installationDirectory,
		).stdout.trim();
		reportedVersions[binary] = version;
		if (!version.startsWith(`openapi/${aggregateVersion} `)) {
			throw new Error(
				`${binary} reported ${version}; expected openapi/${aggregateVersion}`,
			);
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
		throw new Error(
			`Bin aliases report different versions: ${JSON.stringify(reportedVersions)}`,
		);
	}
	const cliExecutable = binPath(installationDirectory, "openapi");
	const invalidValidation = run(
		cliExecutable,
		["validate", "./invalid.yaml", "--json"],
		installationDirectory,
		{ expectedStatus: 3 },
	);
	const invalidValidationJson = JSON.parse(invalidValidation.stdout);
	if (
		invalidValidationJson.success !== false ||
		invalidValidationJson.command !== "validate"
	) {
		throw new Error(
			"Packed CLI invalid validation did not return the stable JSON envelope",
		);
	}
	const diffJson = JSON.parse(
		run(
			cliExecutable,
			["diff", "./openapi.yaml", "./openapi.yaml", "--json"],
			installationDirectory,
		).stdout,
	);
	if (
		diffJson.command !== "diff" ||
		diffJson.breaking !== false ||
		diffJson.changes.length !== 0
	) {
		throw new Error("Packed CLI diff JSON smoke failed");
	}
	const dryRunJson = JSON.parse(
		run(
			cliExecutable,
			[
				"generate",
				"--target",
				"order-service",
				"--target",
				"user-service",
				"--dry-run",
				"--json",
			],
			installationDirectory,
		).stdout,
	);
	if (
		dryRunJson.command !== "generate" ||
		dryRunJson.mode !== "dry-run" ||
		dryRunJson.success !== true ||
		dryRunJson.servers.map(({ name }) => name).join(",") !==
			"user-service,order-service" ||
		dryRunJson.servers.map(({ output }) => output).join(",") !==
			"src/api/generated/user,src/api/generated/order"
	) {
		throw new Error("Packed CLI generate --dry-run JSON smoke failed");
	}
	for (const output of [
		"src/api/generated/user",
		"src/api/generated/order",
		".OpenAPI/legacy",
	]) {
		try {
			await access(join(installationDirectory, output));
			throw new Error(`Packed CLI generate --dry-run wrote ${output}`);
		} catch (error) {
			if (!(error && error.code === "ENOENT")) throw error;
		}
	}
	const checkJson = JSON.parse(
		run(
			cliExecutable,
			["generate", "--check", "--json"],
			installationDirectory,
			{ expectedStatus: 6 },
		).stdout,
	);
	if (checkJson.command !== "generate" || checkJson.mode !== "check") {
		throw new Error("Packed CLI generate --check JSON smoke failed");
	}
	const mcpExecutable = binPath(installationDirectory, "openapi-to-mcp");
	if (process.platform !== "win32") await chmod(mcpExecutable, 0o755);
	run(mcpExecutable, ["--help"], installationDirectory);
	const mcpVersion = run(
		mcpExecutable,
		["--version"],
		installationDirectory,
	).stdout.trim();
	const expectedMcpVersion = packed.find(
		({ name }) => name === "@openapi-to/mcp",
	).version;
	if (mcpVersion !== expectedMcpVersion)
		throw new Error(
			`openapi-to-mcp reported ${mcpVersion}; expected ${expectedMcpVersion}`,
		);
	run(
		process.execPath,
		["mcp-stdio-smoke.mjs", mcpExecutable],
		installationDirectory,
	);

	const selectedCheck = JSON.parse(
		run(
			cliExecutable,
			["generate", "--target", "user-service", "--check", "--json"],
			installationDirectory,
		).stdout,
	);
	if (
		selectedCheck.success !== true ||
		selectedCheck.servers.length !== 1 ||
		selectedCheck.servers[0]?.name !== "user-service"
	) {
		throw new Error("Packed CLI selected check included an unselected target");
	}

	const generatedAll = JSON.parse(
		run(
			cliExecutable,
			["generate", "--json"],
			installationDirectory,
		).stdout,
	);
	if (
		generatedAll.success !== true ||
		generatedAll.servers.map(({ name }) => name).join(",") !==
			"user-service,order-service,legacy-service,remote-json,remote-yaml"
	) {
		throw new Error("Packed CLI default multi-target generation failed");
	}
	if (JSON.stringify(generatedAll).includes("token=release-smoke")) {
		throw new Error("Packed CLI leaked a remote URL query token");
	}
	for (const [output, target] of [
		["src/api/generated/user", "user-service"],
		["src/api/generated/order", "order-service"],
		[".OpenAPI/legacy", "legacy-service"],
		["src/api/generated/remote-json", "remote-json"],
		["src/api/generated/remote-yaml", "remote-yaml"],
	]) {
		if (
			await readFile(join(installationDirectory, output, "client.txt"), "utf8") !==
			`${target}\n`
		) {
			throw new Error(`Packed CLI wrote unexpected ${target} bytes`);
		}
		await access(
			join(installationDirectory, output, ".openapi-to-manifest.json"),
		);
	}

	await writeFile(
		join(installationDirectory, "src/api/generated/remote-json/client.txt"),
		"remote-sentinel\n",
	);
	const selectedMultiple = JSON.parse(
		run(
			cliExecutable,
			[
				"generate",
				"--target",
				"order-service",
				"--target",
				"user-service",
				"--target",
				"user-service",
				"--json",
			],
			installationDirectory,
		).stdout,
	);
	if (
		selectedMultiple.servers.map(({ name }) => name).join(",") !==
			"user-service,order-service"
	) {
		throw new Error(
			"Packed CLI repeated target selection was not deduplicated in config order",
		);
	}
	if (
		await readFile(
			join(installationDirectory, "src/api/generated/remote-json/client.txt"),
			"utf8",
		) !== "remote-sentinel\n"
	) {
		throw new Error("Packed CLI changed an unselected target");
	}

	const aliasDryRuns = [];
	for (const binary of ["openapi", "openapi-to"]) {
		aliasDryRuns.push(
			run(
				binPath(installationDirectory, binary),
				[
					"generate",
					"--target",
					"legacy-service",
					"--dry-run",
					"--json",
				],
				installationDirectory,
			).stdout,
		);
	}
	if (aliasDryRuns[0] !== aliasDryRuns[1]) {
		throw new Error("Packed CLI aliases returned different target dry-runs");
	}

	succeeded = true;
	process.stdout.write(
		`${JSON.stringify(
			{
				success: true,
				node: process.version,
				workspace:
					process.env.KEEP_RELEASE_SMOKE === "1" ? temporaryRoot : undefined,
				packages: packed.map(({ name, version, filename, size, files }) => ({
					name,
					version,
					filename,
					size,
					fileCount: files.length,
				})),
				versions: reportedVersions,
				checks: [
					"esm",
					"cjs",
					"types",
					"openapi-bin",
					"openapi-to-bin",
					"openapi-to-mcp-bin",
					"mcp-stdio",
					"mcp-tool-matrix-3-8-10",
					"mcp-schemas-annotations",
					"mcp-selective-prepare-apply",
					"mcp-target-scoped-catalog",
					"mcp-workspace-output-ownership",
					"mcp-three-state-commit",
					"mcp-token-replay",
					"mcp-current",
					"mcp-full-prepare-unchanged",
					"validate-json",
					"validate-error-exit",
					"inspect-json",
					"diff-json",
					"generate-dry-run-json",
					"generate-check-exit",
					"generate-target-check",
					"generate-multi-target",
					"generate-repeated-target",
					"generate-http-json-yaml",
					"generate-alias-parity",
				],
			},
			null,
			2,
		)}\n`,
	);
} finally {
	if (remoteFixtureServer?.child) {
		const child = remoteFixtureServer.child;
		if (child.exitCode === null) {
			const stopped = new Promise((resolveStopped) =>
				child.once("exit", resolveStopped),
			);
			child.kill("SIGTERM");
			await stopped;
		}
	}
	if (process.env.KEEP_RELEASE_SMOKE !== "1") {
		await rm(temporaryRoot, { recursive: true, force: true });
	} else if (!succeeded) {
		process.stderr.write(
			`Release smoke workspace retained at ${temporaryRoot}\n`,
		);
	}
}
