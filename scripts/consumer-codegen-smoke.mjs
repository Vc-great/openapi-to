import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
	access,
	appendFile,
	copyFile,
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
	basename,
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
	sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	createPackedOverrides,
	packReleasePackages,
} from "./release/pack-smoke-helpers.mjs";

const temporaryPrefix = "openapi-to-consumer-codegen-";
const reviewDirectoryParts = [".ci-artifacts", "consumer-codegen-review"];
const reviewKind = "openapi-to-consumer-codegen-review";
const reviewSchemaVersion = 1;
const reviewStagingPrefix = ".consumer-codegen-review-staging-";
const reviewBackupPrefix = ".consumer-codegen-review-backup-";
const outputLimit = 4_000;

export const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
);

export function parseArguments(argv) {
	const options = { keep: false, json: false, exportReviewDir: null };
	const seen = new Set();
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--") continue;
		if (
			argument === "--keep" ||
			argument === "--json" ||
			argument === "--help"
		) {
			if (seen.has(argument))
				throw new Error(`Duplicate argument: ${argument}`);
			seen.add(argument);
			if (argument === "--keep") options.keep = true;
			else if (argument === "--json") options.json = true;
			else options.help = true;
		} else if (argument === "--export-review-dir") {
			if (seen.has(argument))
				throw new Error(`Duplicate argument: ${argument}`);
			seen.add(argument);
			const value = argv[index + 1];
			if (
				typeof value !== "string" ||
				value.trim() === "" ||
				value.startsWith("--")
			)
				throw new Error(
					"--export-review-dir requires a non-empty directory value.",
				);
			options.exportReviewDir = value;
			index += 1;
		} else throw new Error(`Unknown argument: ${argument}`);
	}
	if (options.help && seen.size > 1)
		throw new Error("--help cannot be combined with other arguments.");
	return options;
}

export function installedBinaryPath(
	consumerRoot,
	name,
	platform = process.platform,
) {
	return join(
		consumerRoot,
		"node_modules",
		".bin",
		`${name}${platform === "win32" ? ".cmd" : ""}`,
	);
}

function bounded(value, limit = outputLimit) {
	const text = String(value ?? "");
	if (text.length <= limit) return text;
	return `${text.slice(0, limit)}\n… ${text.length - limit} characters omitted`;
}

function displayCommand(command, args) {
	return [command, ...args]
		.map((value) => (/\s/.test(value) ? JSON.stringify(value) : value))
		.join(" ");
}

export class ConsumerSmokeCommandError extends Error {
	constructor({ stage, command, args, result }) {
		super(
			[
				`Consumer codegen smoke failed during ${stage}.`,
				`Command: ${displayCommand(command, args)}`,
				`Exit code: ${result.status ?? result.signal ?? "unknown"}`,
				`stdout:\n${bounded(result.stdout)}`,
				`stderr:\n${bounded(result.stderr)}`,
			].join("\n"),
		);
		this.name = "ConsumerSmokeCommandError";
		this.stage = stage;
		this.exitCode = result.status;
	}
}

export function runCommand(
	stage,
	command,
	args,
	cwd,
	{ expectedStatus = 0, env = {} } = {},
) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
		shell: false,
		env: {
			...process.env,
			CI: "1",
			NO_UPDATE_NOTIFIER: "1",
			...env,
		},
	});
	if (result.error) {
		throw new Error(
			`Consumer codegen smoke failed during ${stage}. Command: ${displayCommand(command, args)}. ${result.error.message}`,
		);
	}
	if (result.status !== expectedStatus) {
		throw new ConsumerSmokeCommandError({
			stage,
			command,
			args,
			result,
		});
	}
	return result;
}

function pnpm(args, cwd, stage = "pnpm") {
	const executable = process.env.npm_execpath;
	if (executable) {
		return runCommand(stage, process.execPath, [executable, ...args], cwd);
	}
	return runCommand(
		stage,
		installedBinaryPath(repositoryRoot, "pnpm"),
		args,
		cwd,
	);
}

async function exists(candidate) {
	try {
		await access(candidate, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function parseJson(result, stage) {
	try {
		return JSON.parse(result.stdout);
	} catch (error) {
		throw new Error(
			`${stage} stdout was not exactly one JSON document: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

async function writeJson(path, value) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function filesRecursively(root, { ignoreNodeModules = false } = {}) {
	if (!(await exists(root))) return [];
	const files = [];
	async function visit(directory) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (ignoreNodeModules && entry.name === "node_modules") continue;
			const absolutePath = join(directory, entry.name);
			if (entry.isDirectory()) await visit(absolutePath);
			else if (entry.isFile()) files.push(absolutePath);
			else
				throw new Error(
					`Consumer workspace contains a non-file entry: ${absolutePath}`,
				);
		}
	}
	await visit(root);
	return files.sort();
}

function isStrictDescendant(parent, candidate) {
	const relativePath = relative(parent, candidate);
	return (
		relativePath !== "" &&
		relativePath !== ".." &&
		!relativePath.startsWith(`..${sep}`) &&
		!isAbsolute(relativePath)
	);
}

async function assertNoSymlinkComponents(parent, candidate) {
	const relativePath = relative(parent, candidate);
	assert(
		relativePath === "" || isStrictDescendant(parent, candidate),
		`Review export path is outside its expected parent: ${candidate}`,
	);
	let cursor = parent;
	for (const part of relativePath.split(sep).filter(Boolean)) {
		cursor = join(cursor, part);
		try {
			const entry = await lstat(cursor);
			assert(
				!entry.isSymbolicLink(),
				`Review export path contains a symbolic link: ${cursor}`,
			);
			assert(
				entry.isDirectory(),
				`Review export path component is not a directory: ${cursor}`,
			);
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
		}
	}
}

export async function assertSafeReviewExportDirectory(
	candidate,
	root = repositoryRoot,
) {
	assert(
		typeof candidate === "string" && candidate.trim() !== "",
		"Review export directory must be a non-empty path.",
	);
	assert(
		!/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(candidate),
		`Review export directory must not contain path traversal: ${candidate}`,
	);
	assert(
		!/[\\/](?:node_modules|packages)(?:[\\/]|$)/i.test(
			`/${candidate.replaceAll("\\", "/")}/`,
		),
		`Review export directory contains a forbidden path segment: ${candidate}`,
	);
	assert(
		!/^\\\\/.test(candidate) && !/^[A-Za-z]:[\\/]/.test(candidate),
		`Review export directory must not use a Windows drive or UNC path: ${candidate}`,
	);

	const repository = resolve(root);
	const allowedRoot = join(repository, ...reviewDirectoryParts);
	const target = isAbsolute(candidate)
		? resolve(candidate)
		: resolve(repository, candidate);
	assert(
		isStrictDescendant(allowedRoot, target),
		`Review export directory must be strictly inside ${allowedRoot}: ${target}`,
	);
	assert(
		dirname(target) === allowedRoot,
		`Review export directory must be a direct child of ${allowedRoot}: ${target}`,
	);

	await realpath(repository);
	await assertNoSymlinkComponents(repository, target);
	return target;
}

async function ensureReviewRoot(root = repositoryRoot) {
	const repository = resolve(root);
	const allowedRoot = join(repository, ...reviewDirectoryParts);
	await assertNoSymlinkComponents(
		repository,
		join(repository, reviewDirectoryParts[0]),
	);
	await mkdir(allowedRoot, { recursive: true });
	await assertNoSymlinkComponents(repository, allowedRoot);
	const realAllowedRoot = await realpath(allowedRoot);
	const realRepository = await realpath(repository);
	assert(
		realAllowedRoot === join(realRepository, ...reviewDirectoryParts),
		`Review export root must not resolve through a symbolic link: ${allowedRoot}`,
	);
	return allowedRoot;
}

async function readOwnedReviewReport(target) {
	let report;
	try {
		report = JSON.parse(await readFile(join(target, "report.json"), "utf8"));
	} catch {
		throw new Error(
			`Refusing to replace or clean a review directory without a valid report.json: ${target}`,
		);
	}
	assert(
		report?.kind === reviewKind &&
			report?.schemaVersion === reviewSchemaVersion,
		`Refusing to replace or clean a review directory not owned by this feature: ${target}`,
	);
	return report;
}

export async function cleanupReviewExportDirectory(
	candidate,
	root = repositoryRoot,
) {
	const target = await assertSafeReviewExportDirectory(candidate, root);
	if (!(await exists(target))) return;
	await readOwnedReviewReport(target);
	await rm(target, { recursive: true, force: false });
}

async function fileHashes(root, options) {
	const hashes = {};
	for (const absolutePath of await filesRecursively(root, options)) {
		const path = relative(root, absolutePath).split(sep).join("/");
		hashes[path] = createHash("sha256")
			.update(await readFile(absolutePath))
			.digest("hex");
	}
	return hashes;
}

function manifestSummary(server) {
	return server?.manifest?.summary ?? {};
}

function assertGenerateEnvelope(output, mode) {
	assert(
		output?.command === "generate",
		`${mode} did not report command=generate`,
	);
	assert(output?.mode === mode, `${mode} did not report its expected mode`);
	assert(output?.success === true, `${mode} did not report success=true`);
	assert(
		output?.servers?.length === 1,
		`${mode} did not report exactly one target`,
	);
	assert(
		output.servers[0]?.name === "consumer",
		`${mode} did not report the consumer target`,
	);
	return output.servers[0];
}

function changedEntries(server, status) {
	return (server?.manifest?.entries ?? []).filter(
		(entry) => entry.status === status,
	);
}

export function assertGeneratedOutput(files) {
	assert(files.length > 0, "Formal plugins generated no files.");
	const paths = files.map((file) => file.split(sep).join("/"));
	for (const expected of [
		"types/models/widget.model.ts",
		"zod/models/widget.schema.ts",
		"widgets/get-widget.types.ts",
		"widgets/get-widget.schema.ts",
		"widgets/get-widget.service.ts",
		"widgets/create-widget.types.ts",
		"widgets/create-widget.schema.ts",
		"widgets/create-widget.service.ts",
		".openapi-to-manifest.json",
	]) {
		assert(
			paths.includes(expected),
			`Generated output is missing ${expected}.`,
		);
	}
}

async function assertRelativeImportsResolve(outputRoot, generatedFiles) {
	for (const relativePath of generatedFiles.filter((path) =>
		path.endsWith(".ts"),
	)) {
		const absolutePath = join(outputRoot, relativePath);
		const source = await readFile(absolutePath, "utf8");
		for (const match of source.matchAll(
			/\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g,
		)) {
			const candidate = resolve(dirname(absolutePath), match[1]);
			const alternatives = [
				candidate,
				`${candidate}.ts`,
				join(candidate, "index.ts"),
			];
			assert(
				await alternatives.reduce(
					async (found, item) => (await found) || (await exists(item)),
					Promise.resolve(false),
				),
				`${relativePath} imports missing file ${match[1]}.`,
			);
		}
	}
}

async function assertEdgeCaseOutput(consumerRoot) {
	const readGenerated = (path) => readFile(join(consumerRoot, path), "utf8");
	const [
		parameters,
		wildcards,
		noContent,
		headerResponse,
		inlineSibling,
		componentParameter,
		componentRequestBody,
		componentResponse,
		inlineAnyBody,
		componentAnyBody,
		componentAnyBodyService,
	] = await Promise.all([
		readGenerated(
			"generated-parameter-refs/parameters/referenced-parameters.schema.ts",
		),
		readGenerated(
			"generated-wildcard-responses/responses/wildcard-responses.schema.ts",
		),
		readGenerated(
			"generated-component-no-content/zod/responses/no-content.schema.ts",
		),
		readGenerated("generated-response-headers/zod/responses/success.schema.ts"),
		readGenerated(
			"generated-ref-siblings/siblings/inline-ref-sibling.schema.ts",
		),
		readGenerated("generated-ref-siblings/zod/parameters/long-value.schema.ts"),
		readGenerated(
			"generated-ref-siblings/zod/requestBodies/long-body.schema.ts",
		),
		readGenerated(
			"generated-ref-siblings/zod/responses/nullable-body.schema.ts",
		),
		readGenerated("generated-empty-media/media/inline-any-body.schema.ts"),
		readGenerated("generated-empty-media/media/component-any-body.schema.ts"),
		readGenerated("generated-empty-media/media/component-any-body.service.ts"),
	]);
	assert(
		/"search": ParameterSearchModel\.optional\(\)/.test(parameters),
		"Referenced optional query parameter did not generate .optional().",
	);
	assert(
		/"requiredSearch": ParameterRequiredSearchModel(?!\.optional)/.test(
			parameters,
		),
		"Referenced required query parameter became optional.",
	);
	assert(
		/"id": ParameterUserIdModel(?!\.optional)/.test(parameters),
		"Referenced path parameter became optional.",
	);
	assert(
		/ParameterNeverParameterModel\.optional\(\)/.test(parameters),
		"Referenced schema:false parameter was not preserved.",
	);
	for (const suffix of [
		"101",
		"1XX",
		"200",
		"2XX",
		"301",
		"3XX",
		"400",
		"4XX",
		"500",
		"5XX",
		"Default",
	]) {
		assert(
			wildcards.includes(`wildcardResponsesResponseSchema${suffix}`),
			`Wildcard response output omitted ${suffix}.`,
		);
	}
	assert(
		/ResponseNoContent = z\.undefined\(\)/.test(noContent),
		"No-content component response was not generated as z.undefined().",
	);
	assert(
		!headerResponse.includes("RequestId") &&
			/ResponseSuccess = z\.string\(\)/.test(headerResponse),
		"Response header reference leaked into the response body schema.",
	);
	for (const [label, source] of [
		["operation request/response", inlineSibling],
		["component parameter", componentParameter],
		["component request body", componentRequestBody],
	]) {
		assert(
			source.includes("z.intersection(baseStringSchema, z.string().min(10))"),
			`${label} bypassed schema-level $ref sibling rendering.`,
		);
	}
	assert(
		componentResponse.includes("baseStringSchema.nullable()"),
		"Nullable response $ref sibling was not preserved.",
	);
	assert(
		/MutationRequestSchema = z\.unknown\(\)/.test(inlineAnyBody) &&
			/MutationSchemaResponseSchema200 = z\.unknown\(\)/.test(inlineAnyBody),
		"Empty operation Media Type Object was not mapped to z.unknown().",
	);
	assert(
		/MutationRequestSchema = anyBodySchema/.test(componentAnyBody),
		"Referenced empty component request body did not use a real schema export.",
	);
	assert(
		!componentAnyBodyService.includes("undefined.parse(") &&
			/componentAnyBodyMutationRequestSchema\.parse\(data\)/.test(
				componentAnyBodyService,
			),
		"Request service emitted a missing or undefined parser.",
	);

	for (const directory of [
		"generated-parameter-refs",
		"generated-wildcard-responses",
		"generated-wildcard-types",
		"generated-component-no-content",
		"generated-response-headers",
		"generated-ref-siblings",
		"generated-empty-media",
	]) {
		const root = join(consumerRoot, directory);
		const files = (await filesRecursively(root)).map((path) =>
			relative(root, path).split(sep).join("/"),
		);
		await assertRelativeImportsResolve(root, files);
		for (const file of files.filter((path) => path.endsWith(".ts"))) {
			const source = await readFile(join(root, file), "utf8");
			const declarations = [
				...source.matchAll(/export const ([A-Za-z_$][\w$]*)/g),
			].map((match) => match[1]);
			assert(
				new Set(declarations).size === declarations.length,
				`${directory}/${file} contains duplicate export const declarations.`,
			);
			assert(
				!source.includes("undefined.parse("),
				`${directory}/${file} contains undefined.parse().`,
			);
		}
	}
}

async function assertSemanticOutput(outputRoot, consumerRoot, generatedFiles) {
	const readGenerated = (path) => readFile(join(outputRoot, path), "utf8");
	const [
		widgetType,
		getType,
		createType,
		widgetZod,
		getService,
		createService,
	] = await Promise.all([
		readGenerated("types/models/widget.model.ts"),
		readGenerated("widgets/get-widget.types.ts"),
		readGenerated("widgets/create-widget.types.ts"),
		readGenerated("zod/models/widget.schema.ts"),
		readGenerated("widgets/get-widget.service.ts"),
		readGenerated("widgets/create-widget.service.ts"),
	]);
	assert(
		/export interface WidgetModel/.test(widgetType),
		"Widget component type was not generated.",
	);
	assert(
		/\bid: string;/.test(widgetType),
		"Required Widget.id is missing or optional.",
	);
	assert(
		/\bdisplayName\?: string;/.test(widgetType),
		"Optional Widget.displayName was not preserved.",
	);
	assert(
		/\btags\?: Array<string>;/.test(widgetType),
		"Widget tags array was not generated.",
	);
	assert(
		/WidgetStatusEnum/.test(widgetType),
		"Widget status enum was not referenced.",
	);
	assert(
		/\bwidgetId: string;/.test(getType),
		"GET path parameter type was not generated.",
	);
	assert(
		/\bincludeHistory\?: boolean;/.test(getType),
		"Optional GET query parameter type was not generated.",
	);
	assert(
		/WidgetModel/.test(getType),
		"GET response does not reference WidgetModel.",
	);
	assert(
		/CreateWidgetRequestModel/.test(createType),
		"POST request body does not reference CreateWidgetRequestModel.",
	);
	assert(
		/WidgetModel/.test(createType),
		"POST response does not reference WidgetModel.",
	);
	assert(
		/z\.(?:looseObject|strictObject|object)\(/.test(widgetZod),
		"Widget Zod object schema was not generated.",
	);
	assert(
		/widgetId/.test(getService),
		"GET service signature omitted the path parameter.",
	);
	assert(
		/params\?/.test(getService),
		"GET service signature omitted optional query parameters.",
	);
	assert(
		/GetWidgetResponse/.test(getService),
		"GET service omitted its response type.",
	);
	assert(
		/CreateWidgetMutationRequest/.test(createService),
		"POST service omitted its request body type.",
	);
	assert(
		/CreateWidgetMutationResponse/.test(createService),
		"POST service omitted its response type.",
	);
	assert(
		/createWidgetMutationRequestSchema\.parse\(data\)/.test(createService),
		"POST service does not validate its body with Zod.",
	);

	const repositoryPath = repositoryRoot.split(sep).join("/");
	for (const relativePath of generatedFiles) {
		const source = await readFile(join(outputRoot, relativePath), "utf8");
		const normalized = source.split(sep).join("/");
		assert(
			!normalized.includes(repositoryPath),
			`${relativePath} leaks the repository path.`,
		);
		assert(
			!/(?:^|["'])[^"']*packages\/[^"']*\/src(?:\/|["'])/.test(normalized),
			`${relativePath} imports repository source.`,
		);
		for (const legacy of [
			"z.string().email(",
			"z.string().url(",
			"z.string().uuid(",
			"z.string().datetime(",
		]) {
			assert(
				!source.includes(legacy),
				`${relativePath} contains legacy Zod string format output: ${legacy}`,
			);
		}
		assert(
			!/\bz\.record\(\s*[^,()]+(?:\([^()]*\))?\s*\)/.test(source),
			`${relativePath} contains a single-argument z.record() call.`,
		);
	}
	await assertRelativeImportsResolve(outputRoot, generatedFiles);
	assert(
		(await realpath(consumerRoot)) !== (await realpath(repositoryRoot)),
		"Consumer workspace is not independent from the repository.",
	);
}

async function packConsumerDependency({
	consumerRoot,
	installedRoot,
	expectedName,
	expectedMajor,
}) {
	const packageRoot = await realpath(installedRoot);
	const manifest = JSON.parse(
		await readFile(join(packageRoot, "package.json"), "utf8"),
	);
	assert(
		manifest.name === expectedName,
		`Expected ${expectedName}, found ${manifest.name}.`,
	);
	if (expectedMajor !== undefined) {
		assert(
			Number.parseInt(manifest.version.split(".")[0], 10) === expectedMajor,
			`${expectedName} resolved ${manifest.version}; expected major ${expectedMajor}.`,
		);
	}
	const tarballDirectory = join(consumerRoot, "tarballs");
	await mkdir(tarballDirectory, { recursive: true });
	const packed = parseJson(
		pnpm(
			["pack", "--pack-destination", tarballDirectory, "--json"],
			packageRoot,
			`pack ${expectedName}`,
		),
		`pack ${expectedName}`,
	);
	assert(
		packed.name === expectedName && packed.version === manifest.version,
		`Packed ${expectedName} metadata did not match its installed dependency.`,
	);
	return {
		archive: `file:./tarballs/${basename(packed.filename)}`,
		version: manifest.version,
	};
}

async function createConsumerFiles(
	consumerRoot,
	aggregateArchive,
	packed,
	consumerDependencies,
) {
	await writeJson(join(consumerRoot, "package.json"), {
		name: "openapi-to-formal-plugin-consumer-smoke",
		private: true,
		type: "module",
		devDependencies: {
			"openapi-to": `file:${aggregateArchive}`,
			typescript: consumerDependencies.typescript.version,
			zod: "^4.4.3",
		},
		pnpm: {
			overrides: {
				...createPackedOverrides(packed),
				typescript: consumerDependencies.typescript.archive,
				zod: consumerDependencies.zod.archive,
			},
		},
	});
	for (const fixtureName of [
		"openapi-parameter-refs.json",
		"openapi-wildcard-responses.json",
		"openapi-empty-media.json",
		"openapi-component-no-content.json",
		"openapi-response-headers.json",
		"openapi-ref-siblings.json",
	]) {
		await copyFile(
			join(
				repositoryRoot,
				"scripts",
				"fixtures",
				"consumer-codegen",
				fixtureName,
			),
			join(consumerRoot, fixtureName),
		);
	}
	await writeJson(join(consumerRoot, "openapi.json"), {
		openapi: "3.0.3",
		info: { title: "Consumer Widgets", version: "1.0.0" },
		paths: {
			"/widgets/{widgetId}": {
				get: {
					tags: ["widgets"],
					operationId: "getWidget",
					parameters: [
						{
							name: "widgetId",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
						{
							name: "includeHistory",
							in: "query",
							required: false,
							schema: { type: "boolean" },
						},
					],
					responses: {
						200: {
							description: "Widget",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Widget" },
								},
							},
						},
					},
				},
			},
			"/widgets": {
				post: {
					tags: ["widgets"],
					operationId: "createWidget",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/CreateWidgetRequest",
								},
							},
						},
					},
					responses: {
						201: {
							description: "Created widget",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Widget" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				Widget: {
					type: "object",
					required: [
						"id",
						"email",
						"url",
						"uuid",
						"createdDate",
						"createdAt",
						"bytes",
						"count",
						"status",
						"metadata",
						"labels",
						"choice",
						"combined",
					],
					properties: {
						id: { type: "string" },
						email: { type: "string", format: "email" },
						url: { type: "string", format: "uri" },
						uuid: { type: "string", format: "uuid" },
						createdDate: { type: "string", format: "date" },
						createdAt: { type: "string", format: "date-time" },
						bytes: { type: "string", format: "byte" },
						count: { type: "integer", minimum: 1, maximum: 3 },
						displayName: { type: "string" },
						status: {
							type: "string",
							enum: ["active", "archived"],
						},
						tags: { type: "array", items: { type: "string" } },
						metadata: { $ref: "#/components/schemas/WidgetMetadata" },
						labels: {
							type: "object",
							additionalProperties: { type: "string" },
						},
						choice: {
							oneOf: [{ type: "string" }, { type: "number" }],
						},
						combined: {
							allOf: [
								{
									type: "object",
									required: ["left"],
									properties: { left: { type: "string" } },
								},
								{
									type: "object",
									required: ["right"],
									properties: { right: { type: "boolean" } },
								},
							],
						},
						nullableNote: { type: "string", nullable: true },
					},
				},
				WidgetMetadata: {
					type: "object",
					required: ["createdBy"],
					properties: {
						createdBy: { type: "string" },
						audit: { $ref: "#/components/schemas/AuditMetadata" },
					},
				},
				AuditMetadata: {
					type: "object",
					required: ["revision"],
					properties: {
						revision: { type: "integer" },
						note: { type: "string" },
					},
				},
				CreateWidgetRequest: {
					type: "object",
					required: ["name", "status"],
					properties: {
						name: { type: "string" },
						status: {
							type: "string",
							enum: ["active", "archived"],
						},
						tags: { type: "array", items: { type: "string" } },
						details: { $ref: "#/components/schemas/WidgetDetails" },
					},
				},
				WidgetDetails: {
					type: "object",
					required: ["color"],
					properties: {
						color: { type: "string" },
						description: { type: "string" },
					},
				},
			},
		},
	});
	await writeJson(join(consumerRoot, "openapi-recursive.json"), {
		openapi: "3.0.3",
		info: { title: "Recursive Zod 4 fixture", version: "1.0.0" },
		paths: {},
		components: {
			schemas: {
				Node: {
					type: "object",
					required: ["value"],
					additionalProperties: false,
					properties: {
						value: { type: "string" },
						children: {
							type: "array",
							items: { $ref: "#/components/schemas/Node" },
						},
					},
				},
				PairA: {
					type: "object",
					required: ["name"],
					properties: {
						name: { type: "string" },
						pair: { $ref: "#/components/schemas/PairB" },
					},
				},
				PairB: {
					type: "object",
					required: ["count"],
					properties: {
						count: { type: "integer" },
						pair: { $ref: "#/components/schemas/PairA" },
					},
				},
			},
		},
	});
	await writeJson(join(consumerRoot, "openapi-responses.json"), {
		openapi: "3.0.3",
		info: { title: "Response Zod 4 fixture", version: "1.0.0" },
		paths: {
			"/users": {
				post: {
					tags: ["users"],
					operationId: "responseMatrix",
					requestBody: { $ref: "#/components/requestBodies/CreateUser" },
					responses: {
						200: {
							description: "Text",
							content: { "application/json": { schema: { type: "string" } } },
						},
						201: {
							description: "Number",
							content: { "application/json": { schema: { type: "number" } } },
						},
						400: {
							description: "Inline error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorBody" },
								},
							},
						},
						404: { $ref: "#/components/responses/NotFound" },
					},
				},
			},
			"/users/{id}": {
				get: {
					tags: ["users"],
					operationId: "getResponseUser",
					parameters: [{ $ref: "#/components/parameters/TraceId" }],
					responses: {
						200: {
							description: "User",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/UserInput" },
								},
							},
						},
						404: { $ref: "#/components/responses/NotFound" },
					},
				},
			},
			"/no-content": {
				get: {
					tags: ["users"],
					operationId: "noContentResponse",
					responses: {
						204: { description: "No content" },
						400: {
							description: "Error",
							content: { "application/json": { schema: { type: "string" } } },
						},
					},
				},
			},
			"/errors-only": {
				get: {
					tags: ["users"],
					operationId: "errorsOnly",
					responses: {
						400: {
							description: "Inline error",
							content: { "application/json": { schema: { type: "string" } } },
						},
						404: { $ref: "#/components/responses/NotFound" },
					},
				},
			},
			"/only-no-content": {
				get: {
					tags: ["users"],
					operationId: "onlyNoContentResponse",
					responses: { 204: { description: "No content" } },
				},
			},
			"/default": {
				get: {
					tags: ["users"],
					operationId: "defaultOnlyResponse",
					responses: {
						default: {
							description: "Default",
							content: { "application/json": { schema: { type: "boolean" } } },
						},
					},
				},
			},
		},
		components: {
			schemas: {
				UserInput: {
					type: "object",
					required: ["name"],
					properties: { name: { type: "string" } },
				},
				ErrorBody: {
					type: "object",
					required: ["message"],
					properties: { message: { type: "string" } },
				},
			},
			parameters: {
				TraceId: {
					name: "X-Trace-Id",
					in: "header",
					schema: { type: "string" },
				},
			},
			requestBodies: {
				CreateUser: {
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/UserInput" },
						},
					},
				},
			},
			responses: {
				NotFound: {
					description: "Not found",
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ErrorBody" },
						},
					},
				},
			},
		},
	});
	await writeJson(join(consumerRoot, "openapi-31.json"), {
		openapi: "3.1.0",
		info: { title: "OpenAPI 3.1 Zod fixture", version: "1.0.0" },
		paths: {
			"/boolean": {
				post: {
					tags: ["boolean"],
					operationId: "booleanSchemas",
					requestBody: {
						content: { "application/json": { schema: true } },
					},
					responses: {
						200: {
							description: "Any",
							content: { "application/json": { schema: {} } },
						},
						400: {
							description: "Never",
							content: { "application/json": { schema: false } },
						},
					},
				},
			},
		},
		components: {
			schemas: { AnyValue: true, NoValue: false, EmptySchema: {} },
		},
	});
	await writeFile(
		join(consumerRoot, "openapi.config.ts"),
		`import {
  defineConfig,
  pluginTSRequest,
  pluginTSType,
  pluginZod,
} from "openapi-to";

export default defineConfig({
  servers: [{
    name: "consumer",
    input: { path: "./openapi.json" },
    output: { base: "workspace", dir: "generated", clean: true },
  }],
  plugins: [
    pluginZod({ importWithExtension: false }),
    pluginTSType({ importWithExtension: false }),
    pluginTSRequest({
      parser: "zod",
      requestClient: "common",
      requestImportDeclaration: { moduleSpecifier: "../../request.ts" },
      requestConfigTypeImportDeclaration: {
        namedImports: ["RequestOptions"],
        moduleSpecifier: "../../request.ts",
      },
      importWithExtension: false,
    }),
  ],
});
`,
	);
	await writeFile(
		join(consumerRoot, "openapi.recursive.config.ts"),
		`import { defineConfig, pluginZod } from "openapi-to";

export default defineConfig({
  servers: [{
    name: "recursive",
    input: { path: "./openapi-recursive.json" },
    output: { base: "workspace", dir: "generated-recursive", clean: true },
  }],
  plugins: [pluginZod({ importWithExtension: false })],
});
`,
	);
	await writeFile(
		join(consumerRoot, "openapi.responses.config.ts"),
		`import { defineConfig, pluginZod } from "openapi-to";

export default defineConfig({
  servers: [{
    name: "responses",
    input: { path: "./openapi-responses.json" },
    output: { base: "workspace", dir: "generated-responses", clean: true },
  }],
  plugins: [pluginZod({ importWithExtension: false })],
});
`,
	);
	await writeFile(
		join(consumerRoot, "openapi.31.config.ts"),
		`import { defineConfig, pluginZod } from "openapi-to";

export default defineConfig({
  servers: [{
    name: "openapi31",
    input: { path: "./openapi-31.json" },
    output: { base: "workspace", dir: "generated-31", clean: true },
  }],
  plugins: [pluginZod({ importWithExtension: false })],
});
`,
	);
	await writeFile(
		join(consumerRoot, "openapi.edge-cases.config.ts"),
		`import { defineConfig, pluginZod } from "openapi-to";

export default defineConfig({
  servers: [
    {
      name: "parameterRefs",
      input: { path: "./openapi-parameter-refs.json" },
      output: { base: "workspace", dir: "generated-parameter-refs", clean: true },
    },
    {
      name: "wildcardResponses",
      input: { path: "./openapi-wildcard-responses.json" },
      output: { base: "workspace", dir: "generated-wildcard-responses", clean: true },
    },
    {
      name: "componentNoContent",
      input: { path: "./openapi-component-no-content.json" },
      output: { base: "workspace", dir: "generated-component-no-content", clean: true },
    },
    {
      name: "responseHeaders",
      input: { path: "./openapi-response-headers.json" },
      output: { base: "workspace", dir: "generated-response-headers", clean: true },
    },
    {
      name: "refSiblings",
      input: { path: "./openapi-ref-siblings.json" },
      output: { base: "workspace", dir: "generated-ref-siblings", clean: true },
    },
  ],
  plugins: [pluginZod({ importWithExtension: false })],
});
`,
	);
	await writeFile(
		join(consumerRoot, "openapi.wildcard-types.config.ts"),
		`import { defineConfig, pluginTSType } from "openapi-to";

export default defineConfig({
  servers: [{
    name: "wildcardTypes",
    input: { path: "./openapi-wildcard-responses.json" },
    output: { base: "workspace", dir: "generated-wildcard-types", clean: true },
  }],
  plugins: [pluginTSType({ importWithExtension: false })],
});
`,
	);
	await writeFile(
		join(consumerRoot, "openapi.empty-media.config.ts"),
		`import {
  defineConfig,
  pluginTSRequest,
  pluginTSType,
  pluginZod,
} from "openapi-to";

export default defineConfig({
  servers: [{
    name: "emptyMedia",
    input: { path: "./openapi-empty-media.json" },
    output: { base: "workspace", dir: "generated-empty-media", clean: true },
  }],
  plugins: [
    pluginZod({ importWithExtension: false }),
    pluginTSType({ importWithExtension: false }),
    pluginTSRequest({
      parser: "zod",
      requestClient: "common",
      requestImportDeclaration: { moduleSpecifier: "../../request.ts" },
      requestConfigTypeImportDeclaration: {
        namedImports: ["RequestOptions"],
        moduleSpecifier: "../../request.ts",
      },
      importWithExtension: false,
    }),
  ],
});
`,
	);
	await writeFile(
		join(consumerRoot, "request.ts"),
		`export interface RequestOptions {
  method?: string;
  url?: string;
  params?: unknown;
  data?: unknown;
  headers?: Record<string, string>;
}

export async function request<T>(_options: RequestOptions): Promise<{ data: unknown }> {
  return { data: {} as T };
}
`,
	);
	await writeFile(
		join(consumerRoot, "consumer-usage.ts"),
		`import { createWidgetService } from "./generated/widgets/create-widget.service.ts";
import { getWidgetService } from "./generated/widgets/get-widget.service.ts";
import type { WidgetModel } from "./generated/types/models/widget.model.ts";

const created = await createWidgetService({
  name: "desk",
  status: "active",
  details: { color: "blue" },
});
const fetched = await getWidgetService("widget-1", { includeHistory: true });
	const widget: WidgetModel = {
	  id: "widget-1",
	  email: "user@example.com",
	  url: "https://example.com/widgets/1",
	  uuid: "550e8400-e29b-41d4-a716-446655440000",
	  createdDate: "2026-07-28",
	  createdAt: "2026-07-28T12:30:00Z",
	  bytes: "aGVsbG8=",
	  count: 2,
	  status: "active",
	  labels: { owner: "consumer" },
	  choice: "manual",
	  combined: { left: "l", right: true },
	  metadata: {
    createdBy: "consumer",
    audit: { revision: 1 },
  },
};
void created;
void fetched;
	void widget;
	`,
	);
	await writeFile(
		join(consumerRoot, "runtime-check.ts"),
		`import { z } from "zod";
import { widgetSchema } from "./generated/zod/models/widget.schema";
import {
  getWidgetPathParamsSchema,
  getWidgetQueryParamsSchema,
} from "./generated/widgets/get-widget.schema";
import { createWidgetMutationRequestSchema } from "./generated/widgets/create-widget.schema";
import { nodeSchema } from "./generated-recursive/zod/models/node.schema";
import { pairASchema } from "./generated-recursive/zod/models/pair-a.schema";
import {
  responseMatrixMutationSchemaResponseSchema,
  responseMatrixResponseErrorSchema,
} from "./generated-responses/users/response-matrix.schema";
import { noContentResponseResponseSchema } from "./generated-responses/users/no-content-response.schema";
import {
  booleanSchemasMutationRequestSchema,
  booleanSchemasMutationSchemaResponseSchema,
  booleanSchemasResponseErrorSchema,
} from "./generated-31/boolean/boolean-schemas.schema";
import { anyValueSchema } from "./generated-31/zod/models/any-value.schema";
import { emptySchemaSchema } from "./generated-31/zod/models/empty-schema.schema";
import { noValueSchema } from "./generated-31/zod/models/no-value.schema";
import {
  referencedParametersPathParamsSchema,
  referencedParametersQueryParamsSchema,
} from "./generated-parameter-refs/parameters/referenced-parameters.schema";
import {
  wildcardResponsesResponseErrorSchema,
  wildcardResponsesResponseSchema,
  wildcardResponsesResponseSchema4XX,
  wildcardResponsesResponseSchema5XX,
} from "./generated-wildcard-responses/responses/wildcard-responses.schema";
import { ResponseNoContent } from "./generated-component-no-content/zod/responses/no-content.schema";
import { deleteUserMutationSchemaResponseSchema } from "./generated-component-no-content/responses/delete-user.schema";
import {
  inlineAnyBodyMutationRequestSchema,
  inlineAnyBodyMutationSchemaResponseSchema,
} from "./generated-empty-media/media/inline-any-body.schema";
import { componentAnyBodyMutationRequestSchema } from "./generated-empty-media/media/component-any-body.schema";
import { neverBodyMutationRequestSchema } from "./generated-empty-media/media/never-body.schema";
import { anyBodySchema } from "./generated-empty-media/zod/requestBodies/any-body.schema";
import { ResponseSuccess } from "./generated-response-headers/zod/responses/success.schema";
import {
  inlineRefSiblingMutationRequestSchema,
  inlineRefSiblingMutationSchemaResponseSchema,
  inlineRefSiblingQueryParamsSchema,
} from "./generated-ref-siblings/siblings/inline-ref-sibling.schema";
import { componentRefSiblingMutationRequestSchema } from "./generated-ref-siblings/siblings/component-ref-sibling.schema";

type IsUnknown<T> = unknown extends T ? ([keyof T] extends [never] ? true : false) : false;
type Expect<T extends true> = T;
type WidgetInferenceIsPrecise = Expect<IsUnknown<z.infer<typeof widgetSchema>> extends false ? true : false>;
type RecursiveInferenceIsDocumentedUnknown = Expect<IsUnknown<z.infer<typeof nodeSchema>>>;
type ResponseInferenceIsPrecise = Expect<IsUnknown<z.infer<typeof responseMatrixMutationSchemaResponseSchema>> extends false ? true : false>;
void (0 as unknown as WidgetInferenceIsPrecise);
void (0 as unknown as RecursiveInferenceIsDocumentedUnknown);
void (0 as unknown as ResponseInferenceIsPrecise);

const widget = {
  id: "widget-1",
  email: "user@example.com",
  url: "https://example.com/widgets/1",
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  createdDate: "2026-07-28",
  createdAt: "2026-07-28T12:30:00Z",
  bytes: "aGVsbG8=",
  count: 2,
  status: "active",
  metadata: { createdBy: "runtime", audit: { revision: 1 } },
  labels: { owner: "runtime" },
  choice: 3,
  combined: { left: "left", right: true },
  nullableNote: null,
};

widgetSchema.parse(widget);
if (widgetSchema.safeParse({ ...widget, email: "invalid" }).success) throw new Error("invalid email passed");
if (widgetSchema.safeParse({ ...widget, count: 2.5 }).success) throw new Error("non-integer count passed");
if (widgetSchema.safeParse({ ...widget, bytes: "not base64!" }).success) throw new Error("invalid base64 passed");
if (widgetSchema.safeParse({ ...widget, status: "unknown" }).success) throw new Error("invalid enum passed");
if (widgetSchema.safeParse({ ...widget, combined: { left: "left" } }).success) throw new Error("invalid intersection passed");
for (const value of ["2026-07-28T12:30:00.123Z", "2026-07-28T12:30:00+08:00", "2026-07-28T12:30:00-05:30"]) {
  if (!widgetSchema.safeParse({ ...widget, createdAt: value }).success) throw new Error(\`valid RFC3339 offset failed: \${value}\`);
}
for (const value of ["2026-07-28T12:30Z", "2026-07-28 12:30:00Z", "2026-13-40T99:99:99Z"]) {
  if (widgetSchema.safeParse({ ...widget, createdAt: value }).success) throw new Error(\`invalid RFC3339 value passed: \${value}\`);
}
if (!getWidgetPathParamsSchema.safeParse({ widgetId: "widget-1" }).success) throw new Error("valid path params failed");
if (getWidgetPathParamsSchema.safeParse({}).success) throw new Error("missing path param passed");
if (!getWidgetQueryParamsSchema.safeParse({ includeHistory: true }).success) throw new Error("valid query params failed");
if (getWidgetQueryParamsSchema.safeParse({ includeHistory: "yes" }).success) throw new Error("invalid query params passed");
if (!createWidgetMutationRequestSchema.safeParse({ name: "desk", status: "active", tags: ["new"] }).success) {
  throw new Error("valid request body failed");
}
if (createWidgetMutationRequestSchema.safeParse({ name: "desk", status: "unknown" }).success) {
  throw new Error("invalid request body passed");
}
nodeSchema.parse({ value: "root", children: [{ value: "leaf" }] });
if (nodeSchema.safeParse({ value: "root", children: [{ value: 1 }] }).success) {
  throw new Error("invalid recursive node passed");
}
pairASchema.parse({ name: "a", pair: { count: 1, pair: { name: "nested" } } });
responseMatrixMutationSchemaResponseSchema.parse("ok");
responseMatrixMutationSchemaResponseSchema.parse(201);
responseMatrixResponseErrorSchema.parse({ message: "bad" });
noContentResponseResponseSchema.parse(undefined);
if (noContentResponseResponseSchema.safeParse("body").success) throw new Error("204 body passed");
booleanSchemasMutationRequestSchema.parse({ any: "request" });
booleanSchemasMutationSchemaResponseSchema.parse({ any: "response" });
if (booleanSchemasResponseErrorSchema.safeParse("forbidden").success) throw new Error("false response schema passed");
anyValueSchema.parse(Symbol("any"));
emptySchemaSchema.parse(null);
if (noValueSchema.safeParse(undefined).success) throw new Error("false component schema passed");
if (!referencedParametersQueryParamsSchema.safeParse({ requiredSearch: "required" }).success) {
  throw new Error("optional referenced query parameter rejected an omitted value");
}
if (referencedParametersQueryParamsSchema.safeParse({}).success) {
  throw new Error("required referenced query parameter accepted an omitted value");
}
if (referencedParametersPathParamsSchema.safeParse({}).success) {
  throw new Error("referenced path parameter accepted an omitted value");
}
if (referencedParametersQueryParamsSchema.safeParse({ requiredSearch: "required", never: "value" }).success) {
  throw new Error("parameter schema:false accepted a value");
}
wildcardResponsesResponseSchema.parse("ok");
wildcardResponsesResponseSchema.parse(2);
wildcardResponsesResponseErrorSchema.parse("error");
wildcardResponsesResponseSchema4XX.parse("client error");
wildcardResponsesResponseSchema5XX.parse("server error");
ResponseNoContent.parse(undefined);
deleteUserMutationSchemaResponseSchema.parse(undefined);
if (ResponseNoContent.safeParse({}).success) throw new Error("no-content component accepted an object");
inlineAnyBodyMutationRequestSchema.parse({ any: "value" });
inlineAnyBodyMutationRequestSchema.parse(null);
inlineAnyBodyMutationSchemaResponseSchema.parse({ any: "response" });
componentAnyBodyMutationRequestSchema.parse({ any: "component" });
anyBodySchema.parse(null);
if (neverBodyMutationRequestSchema.safeParse("value").success) throw new Error("never body accepted a value");
ResponseSuccess.parse("message");
if (ResponseSuccess.safeParse({ value: "message" }).success) throw new Error("response body schema was replaced by its header");
for (const schema of [
  inlineRefSiblingMutationRequestSchema,
  inlineRefSiblingMutationSchemaResponseSchema,
  inlineRefSiblingQueryParamsSchema.shape.value,
  componentRefSiblingMutationRequestSchema,
]) {
  schema.parse("0123456789");
  if (schema.safeParse("short").success) throw new Error("ref sibling minLength was skipped");
}
console.log("zod4-runtime-parse:passed");
`,
	);
	await writeJson(join(consumerRoot, "tsconfig.generated.json"), {
		compilerOptions: {
			allowImportingTsExtensions: true,
			module: "ESNext",
			moduleResolution: "Bundler",
			noEmit: true,
			skipLibCheck: false,
			strict: true,
			target: "ES2022",
		},
		include: [
			"generated/**/*.ts",
			"generated-recursive/**/*.ts",
			"generated-responses/**/*.ts",
			"generated-31/**/*.ts",
			"generated-parameter-refs/**/*.ts",
			"generated-wildcard-responses/**/*.ts",
			"generated-wildcard-types/**/*.ts",
			"generated-component-no-content/**/*.ts",
			"generated-response-headers/**/*.ts",
			"generated-ref-siblings/**/*.ts",
			"generated-empty-media/**/*.ts",
			"request.ts",
			"consumer-usage.ts",
			"runtime-check.ts",
		],
	});
	await writeJson(join(consumerRoot, "tsconfig.runtime.json"), {
		compilerOptions: {
			esModuleInterop: true,
			module: "CommonJS",
			moduleResolution: "Node",
			outDir: "runtime-output",
			skipLibCheck: false,
			strict: true,
			target: "ES2022",
		},
		include: [
			"generated/**/*.schema.ts",
			"generated-recursive/**/*.schema.ts",
			"generated-responses/**/*.schema.ts",
			"generated-31/**/*.schema.ts",
			"generated-parameter-refs/**/*.schema.ts",
			"generated-wildcard-responses/**/*.schema.ts",
			"generated-component-no-content/**/*.schema.ts",
			"generated-response-headers/**/*.schema.ts",
			"generated-ref-siblings/**/*.schema.ts",
			"generated-empty-media/**/*.schema.ts",
			"runtime-check.ts",
		],
	});
}

export async function runConsumerCodegenScenario({
	consumerRoot,
	packed,
	log = () => {},
}) {
	const aggregate = packed.find(({ name }) => name === "openapi-to");
	assert(aggregate, "Packed aggregate openapi-to archive is missing.");
	await mkdir(consumerRoot, { recursive: true });
	const consumerDependencies = {
		typescript: await packConsumerDependency({
			consumerRoot,
			installedRoot: join(repositoryRoot, "node_modules/typescript"),
			expectedName: "typescript",
		}),
		zod: await packConsumerDependency({
			consumerRoot,
			installedRoot: join(
				repositoryRoot,
				"packages/plugin-zod/node_modules/zod",
			),
			expectedName: "zod",
			expectedMajor: 4,
		}),
	};
	await createConsumerFiles(
		consumerRoot,
		aggregate.archive,
		packed,
		consumerDependencies,
	);

	log("install", "Installing the packed aggregate and tarball overrides");
	pnpm(
		["install", "--ignore-scripts", "--prefer-offline"],
		consumerRoot,
		"consumer install",
	);
	const cli = installedBinaryPath(consumerRoot, "openapi");
	const tsc = installedBinaryPath(consumerRoot, "tsc");
	const installedZod = JSON.parse(
		await readFile(join(consumerRoot, "node_modules/zod/package.json"), "utf8"),
	);
	assert(
		Number.parseInt(installedZod.version.split(".")[0], 10) === 4,
		`Consumer resolved Zod ${installedZod.version}; expected major 4.`,
	);
	assert(isAbsolute(cli), "Consumer CLI path must be absolute.");
	assert(
		await exists(cli),
		"Installed consumer node_modules/.bin/openapi entry is missing.",
	);

	log("entry", "Checking installed CLI version and help");
	const version = runCommand(
		"CLI version",
		cli,
		["--version"],
		consumerRoot,
	).stdout.trim();
	assert(
		version.startsWith(`openapi/${aggregate.version} `),
		`Installed CLI reported ${version}; expected openapi/${aggregate.version}.`,
	);
	const help = runCommand("CLI help", cli, ["--help"], consumerRoot).stdout;
	assert(help.includes("generate"), "Installed CLI help omitted generate.");

	log("analysis", "Validating and inspecting the local OpenAPI fixture");
	const validation = parseJson(
		runCommand(
			"OpenAPI validation",
			cli,
			["validate", "./openapi.json", "--json"],
			consumerRoot,
		),
		"OpenAPI validation",
	);
	assert(
		validation.success === true && validation.command === "validate",
		"Structured validation result is not successful.",
	);
	const inspection = parseJson(
		runCommand(
			"OpenAPI inspection",
			cli,
			["inspect", "./openapi.json", "--json"],
			consumerRoot,
		),
		"OpenAPI inspection",
	);
	assert(
		inspection.success === true &&
			inspection.command === "inspect" &&
			inspection.inspection?.pathCount === 2 &&
			inspection.inspection?.operationCount === 2,
		"Structured inspection did not report two paths and two operations.",
	);

	const outputRoot = join(consumerRoot, "generated");
	const beforeDryRun = await fileHashes(consumerRoot, {
		ignoreNodeModules: true,
	});
	log("dry-run", "Planning formal plugin output without writing");
	const dryRun = parseJson(
		runCommand(
			"generation dry-run",
			cli,
			["generate", "--target", "consumer", "--dry-run", "--json"],
			consumerRoot,
		),
		"generation dry-run",
	);
	const dryRunServer = assertGenerateEnvelope(dryRun, "dry-run");
	assert(
		(dryRunServer.manifest?.entries?.length ?? 0) > 0,
		"Generation dry-run reported no artifacts.",
	);
	assert(
		!(await exists(outputRoot)),
		"Generation dry-run created the output directory.",
	);
	assert(
		JSON.stringify(beforeDryRun) ===
			JSON.stringify(
				await fileHashes(consumerRoot, { ignoreNodeModules: true }),
			),
		"Generation dry-run modified consumer project files.",
	);

	log("generate", "Writing formal plugin output");
	const generated = parseJson(
		runCommand(
			"generation write",
			cli,
			["generate", "--target", "consumer", "--json"],
			consumerRoot,
		),
		"generation write",
	);
	assertGenerateEnvelope(generated, "write");
	const recursiveGeneration = parseJson(
		runCommand(
			"recursive Zod generation",
			cli,
			["generate", "--config", "./openapi.recursive.config.ts", "--json"],
			consumerRoot,
		),
		"recursive Zod generation",
	);
	assert(
		recursiveGeneration.success === true &&
			recursiveGeneration.servers?.[0]?.name === "recursive",
		"Recursive Zod-only generation did not succeed.",
	);
	for (const [label, config, expectedName] of [
		["response Zod generation", "./openapi.responses.config.ts", "responses"],
		["OpenAPI 3.1 Zod generation", "./openapi.31.config.ts", "openapi31"],
		[
			"remaining edge-case Zod generation",
			"./openapi.edge-cases.config.ts",
			"parameterRefs",
		],
		[
			"wildcard TypeScript generation",
			"./openapi.wildcard-types.config.ts",
			"wildcardTypes",
		],
		[
			"empty-media formal plugin generation",
			"./openapi.empty-media.config.ts",
			"emptyMedia",
		],
	]) {
		const result = parseJson(
			runCommand(
				label,
				cli,
				["generate", "--config", config, "--json"],
				consumerRoot,
			),
			label,
		);
		assert(
			result.success === true && result.servers?.[0]?.name === expectedName,
			`${label} did not succeed.`,
		);
		const currentResult = parseJson(
			runCommand(
				`${label} check`,
				cli,
				["generate", "--config", config, "--check", "--json"],
				consumerRoot,
			),
			`${label} check`,
		);
		assert(
			currentResult.success === true &&
				currentResult.servers?.every(
					(server) => server.manifest?.outdated === false,
				),
			`${label} was not byte-stable on its second generation.`,
		);
	}
	const generatedFiles = (await filesRecursively(outputRoot)).map((path) =>
		relative(outputRoot, path).split(sep).join("/"),
	);
	assertGeneratedOutput(generatedFiles);
	await assertSemanticOutput(outputRoot, consumerRoot, generatedFiles);
	await assertEdgeCaseOutput(consumerRoot);
	const ownershipPath = join(outputRoot, ".openapi-to-manifest.json");
	const ownership = JSON.parse(await readFile(ownershipPath, "utf8"));
	assert(
		ownership.version === 2 && ownership.files?.length > 0,
		"Ownership manifest is missing or empty.",
	);

	log("typecheck", "Strictly compiling generated code in the consumer");
	runCommand(
		"TypeScript compile",
		tsc,
		["-p", "tsconfig.generated.json"],
		consumerRoot,
	);
	log("runtime", "Executing generated schemas with Zod 4");
	runCommand(
		"Zod runtime compile",
		tsc,
		["-p", "tsconfig.runtime.json"],
		consumerRoot,
	);
	await writeJson(join(consumerRoot, "runtime-output/package.json"), {
		type: "commonjs",
	});
	const runtime = runCommand(
		"Zod runtime parse",
		process.execPath,
		["runtime-output/runtime-check.js"],
		consumerRoot,
	);
	assert(
		runtime.stdout.includes("zod4-runtime-parse:passed"),
		"Generated schema runtime checks did not complete.",
	);

	log("check", "Checking that generated output is current");
	const current = parseJson(
		runCommand(
			"generation check",
			cli,
			["generate", "--target", "consumer", "--check", "--json"],
			consumerRoot,
		),
		"generation check",
	);
	const currentServer = assertGenerateEnvelope(current, "check");
	assert(
		currentServer.manifest?.outdated === false,
		"Generated output is outdated.",
	);
	for (const status of ["added", "modified", "deleted"]) {
		assert(
			changedEntries(currentServer, status).length === 0,
			`Current check unexpectedly reported ${status} artifacts.`,
		);
	}

	const firstHashes = await fileHashes(outputRoot);
	const modifiedPath = "widgets/get-widget.service.ts";
	await appendFile(
		join(outputRoot, modifiedPath),
		"\n// consumer smoke drift\n",
	);
	log("outdated", "Confirming exit code 6 and modified-artifact reporting");
	const outdated = parseJson(
		runCommand(
			"outdated generation check",
			cli,
			["generate", "--target", "consumer", "--check", "--json"],
			consumerRoot,
			{ expectedStatus: 6 },
		),
		"outdated generation check",
	);
	assert(
		outdated.command === "generate" && outdated.mode === "check",
		"Outdated check envelope is invalid.",
	);
	const outdatedServer = outdated.servers?.[0];
	assert(
		outdatedServer?.manifest?.outdated === true,
		"Outdated check did not report outdated=true.",
	);
	assert(
		changedEntries(outdatedServer, "modified").some(
			(entry) => entry.path === modifiedPath,
		),
		"Outdated check did not identify the modified managed artifact.",
	);

	log("restore", "Regenerating and recompiling after drift");
	assertGenerateEnvelope(
		parseJson(
			runCommand(
				"generation restore",
				cli,
				["generate", "--target", "consumer", "--json"],
				consumerRoot,
			),
			"generation restore",
		),
		"write",
	);
	runCommand(
		"TypeScript compile after restore",
		tsc,
		["-p", "tsconfig.generated.json"],
		consumerRoot,
	);
	const restored = parseJson(
		runCommand(
			"generation check after restore",
			cli,
			["generate", "--target", "consumer", "--check", "--json"],
			consumerRoot,
		),
		"generation check after restore",
	);
	assert(
		assertGenerateEnvelope(restored, "check").manifest?.outdated === false,
		"Restored output is not current.",
	);
	assert(
		JSON.stringify(firstHashes) ===
			JSON.stringify(await fileHashes(outputRoot)),
		"Restored output does not match the first generated bytes.",
	);

	log(
		"idempotency",
		"Running identical generation and comparing every file hash",
	);
	assertGenerateEnvelope(
		parseJson(
			runCommand(
				"second identical generation",
				cli,
				["generate", "--target", "consumer", "--json"],
				consumerRoot,
			),
			"second identical generation",
		),
		"write",
	);
	const secondHashes = await fileHashes(outputRoot);
	assert(
		JSON.stringify(firstHashes) === JSON.stringify(secondHashes),
		"Second identical generation changed the file set or bytes.",
	);
	const finalCheck = parseJson(
		runCommand(
			"final generation check",
			cli,
			["generate", "--target", "consumer", "--check", "--json"],
			consumerRoot,
		),
		"final generation check",
	);
	assert(
		assertGenerateEnvelope(finalCheck, "check").manifest?.outdated === false,
		"Final generated output is not current.",
	);

	return {
		version: aggregate.version,
		validate: {
			success: validation.success,
			errors: validation.summary?.errors ?? 0,
		},
		inspect: {
			paths: inspection.inspection.pathCount,
			operations: inspection.inspection.operationCount,
			schemas: inspection.inspection.schemaCount,
		},
		dryRunArtifacts: dryRunServer.manifest.entries.length,
		generatedFiles: generatedFiles.length,
		manifestFiles: ownership.files.length,
		categories: {
			types: generatedFiles.filter(
				(path) => path.endsWith(".types.ts") || path.startsWith("types/"),
			).length,
			zod: generatedFiles.filter(
				(path) => path.endsWith(".schema.ts") || path.startsWith("zod/"),
			).length,
			request: generatedFiles.filter((path) => path.endsWith(".service.ts"))
				.length,
		},
		typecheck: "passed",
		runtimeParse: "passed",
		zod: installedZod.version,
		currentCheck: manifestSummary(currentServer),
		outdated: { exitCode: 6, modified: modifiedPath },
		restore: "current-and-compiled",
		idempotent: true,
		ownershipManifestStable:
			firstHashes[".openapi-to-manifest.json"] ===
			secondHashes[".openapi-to-manifest.json"],
	};
}

async function copyReviewEntry(source, destination) {
	const sourceEntry = await lstat(source);
	assert(
		!sourceEntry.isSymbolicLink(),
		`Review snapshot source must not be a symbolic link: ${source}`,
	);
	if (sourceEntry.isDirectory()) {
		await mkdir(destination);
		for (const entry of (await readdir(source, { withFileTypes: true })).sort(
			(left, right) =>
				left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
		)) {
			await copyReviewEntry(
				join(source, entry.name),
				join(destination, entry.name),
			);
		}
		return;
	}
	assert(
		sourceEntry.isFile(),
		`Review snapshot source must be a regular file or directory: ${source}`,
	);
	await copyFile(source, destination);
}

function assertScenarioReadyForReview(report) {
	assert(
		report?.validate?.success === true,
		"Review export requires validation.",
	);
	assert(
		report?.typecheck === "passed",
		"Review export requires TypeScript compile.",
	);
	assert(
		report?.currentCheck?.added === 0 &&
			report?.currentCheck?.modified === 0 &&
			report?.currentCheck?.deleted === 0,
		"Review export requires a current generated output check.",
	);
	assert(
		report?.outdated?.exitCode === 6,
		"Review export requires the outdated exit-code check.",
	);
	assert(
		report?.restore === "current-and-compiled",
		"Review export requires restored and compiled output.",
	);
	assert(
		report?.idempotent === true,
		"Review export requires idempotent output.",
	);
	assert(
		report?.ownershipManifestStable === true,
		"Review export requires a stable ownership manifest.",
	);
}

function safeCommandVersion(command, args, cwd) {
	try {
		return runCommand(
			`read ${basename(command)} version`,
			command,
			args,
			cwd,
		).stdout.trim();
	} catch {
		return null;
	}
}

async function collectReviewMetadata(root = repositoryRoot) {
	const pnpmExecutable = process.env.npm_execpath;
	const pnpmVersion = pnpmExecutable
		? safeCommandVersion(process.execPath, [pnpmExecutable, "--version"], root)
		: safeCommandVersion(
				installedBinaryPath(root, "pnpm"),
				["--version"],
				root,
			);
	return {
		exportedAt: new Date().toISOString(),
		sourceCommitSha: safeCommandVersion("git", ["rev-parse", "HEAD"], root),
		nodeVersion: process.version,
		pnpmVersion,
	};
}

function createReviewReport(report, metadata, exportedConsumerFiles) {
	return {
		schemaVersion: reviewSchemaVersion,
		kind: reviewKind,
		success: true,
		openapiToVersion: report.version,
		validate: report.validate,
		inspect: report.inspect,
		generatedFiles: report.generatedFiles,
		typeScript: {
			initialCompile: report.typecheck,
			restoredCompile:
				report.restore === "current-and-compiled" ? "passed" : "failed",
		},
		currentCheck: report.currentCheck,
		outdatedCheck: report.outdated,
		restoration: report.restore,
		idempotency: { stable: report.idempotent },
		ownershipManifestStable: report.ownershipManifestStable,
		exportedConsumerFiles,
		exportedAt: metadata.exportedAt,
		sourceCommitSha: metadata.sourceCommitSha,
		runtime: {
			node: metadata.nodeVersion,
			pnpm: metadata.pnpmVersion,
		},
	};
}

async function validateReviewSnapshot(snapshotRoot, root = repositoryRoot) {
	for (const required of [
		"report.json",
		"consumer/package.json",
		"consumer/pnpm-lock.yaml",
		"consumer/openapi.json",
		"consumer/request.ts",
		"consumer/consumer-usage.ts",
		"consumer/tsconfig.generated.json",
		"consumer/openapi.config.ts",
		"consumer/generated/.openapi-to-manifest.json",
	]) {
		assert(
			await exists(join(snapshotRoot, required)),
			`Review snapshot is missing ${required}.`,
		);
	}
	for (const requiredDirectory of [
		"consumer/generated/types",
		"consumer/generated/zod",
		"consumer/generated/widgets",
	]) {
		const entry = await lstat(join(snapshotRoot, requiredDirectory));
		assert(
			entry.isDirectory() && !entry.isSymbolicLink(),
			`Review snapshot is missing directory ${requiredDirectory}.`,
		);
	}

	const repositoryPath = resolve(root).split(sep).join("/");
	const files = await filesRecursively(snapshotRoot);
	for (const absolutePath of files) {
		const snapshotPath = relative(snapshotRoot, absolutePath)
			.split(sep)
			.join("/");
		assert(
			!/(?:^|\/)(?:node_modules|tarballs)(?:\/|$)/i.test(snapshotPath) &&
				!/(?:^|\/)\.openapi-to-write\.lock(?:\/|$)/.test(snapshotPath) &&
				!/(?:^|\/)\.openapi-to-transaction(?:\.json|\/|$)/.test(snapshotPath) &&
				!/(?:^|\/)(?:staging|backup)(?:\/|$)/i.test(snapshotPath) &&
				!/\.tgz$/i.test(snapshotPath) &&
				!/\.log$/i.test(snapshotPath),
			`Review snapshot contains a forbidden path: ${snapshotPath}`,
		);
		const source = await readFile(absolutePath, "utf8");
		assert(
			!source.includes("// consumer smoke drift") &&
				!source.includes("// manual drift test"),
			`Review snapshot contains test drift: ${snapshotPath}`,
		);
		assert(
			!source.split(sep).join("/").includes(repositoryPath),
			`Review snapshot leaks the repository source path: ${snapshotPath}`,
		);
	}
	return files.length;
}

export async function exportReviewSnapshot({
	consumerRoot,
	targetDirectory,
	report,
	root = repositoryRoot,
	metadata,
}) {
	assertScenarioReadyForReview(report);
	const target = await assertSafeReviewExportDirectory(targetDirectory, root);
	const allowedRoot = await ensureReviewRoot(root);
	await assertNoSymlinkComponents(allowedRoot, target);
	if (await exists(target)) await readOwnedReviewReport(target);

	const token = randomUUID();
	const staging = join(allowedRoot, `${reviewStagingPrefix}${token}`);
	const backup = join(allowedRoot, `${reviewBackupPrefix}${token}`);
	let targetMovedToBackup = false;
	let stagingMovedToTarget = false;
	await mkdir(staging);
	try {
		const reviewConsumerRoot = join(staging, "consumer");
		await mkdir(reviewConsumerRoot);
		for (const path of [
			"package.json",
			"pnpm-lock.yaml",
			"openapi.json",
			"request.ts",
			"consumer-usage.ts",
			"tsconfig.generated.json",
			"openapi.config.ts",
			"generated",
		]) {
			await copyReviewEntry(
				join(consumerRoot, path),
				join(reviewConsumerRoot, path),
			);
		}
		const consumerFileCount = (await filesRecursively(reviewConsumerRoot))
			.length;
		const reviewReport = createReviewReport(
			report,
			metadata ?? (await collectReviewMetadata(root)),
			consumerFileCount,
		);
		await writeJson(join(staging, "report.json"), reviewReport);
		const fileCount = await validateReviewSnapshot(staging, root);

		if (await exists(target)) {
			await assertNoSymlinkComponents(allowedRoot, target);
			await readOwnedReviewReport(target);
			await rename(target, backup);
			targetMovedToBackup = true;
		}
		try {
			await rename(staging, target);
			stagingMovedToTarget = true;
		} catch (error) {
			if (targetMovedToBackup) {
				await rename(backup, target);
				targetMovedToBackup = false;
			}
			throw error;
		}
		if (targetMovedToBackup) {
			await rm(backup, { recursive: true, force: false });
			targetMovedToBackup = false;
		}
		return { path: target, fileCount };
	} finally {
		if (!stagingMovedToTarget && (await exists(staging)))
			await rm(staging, { recursive: true, force: true });
		if (targetMovedToBackup && !(await exists(target))) {
			await rename(backup, target);
			targetMovedToBackup = false;
		}
		if (await exists(backup))
			await rm(backup, { recursive: true, force: true });
	}
}

export function assertSafeTemporaryRoot(
	candidate,
	prefix = temporaryPrefix,
	systemTemporaryDirectory = tmpdir(),
) {
	const absolute = resolve(candidate);
	const temporaryDirectory = resolve(systemTemporaryDirectory);
	const relativePath = relative(temporaryDirectory, absolute);
	assert(
		relativePath !== "" &&
			relativePath !== ".." &&
			!relativePath.startsWith(`..${sep}`) &&
			!isAbsolute(relativePath),
		`Refusing to clean a path outside the operating system temporary directory: ${absolute}`,
	);
	assert(
		basename(absolute).startsWith(prefix),
		`Refusing to clean a temporary path without the expected prefix: ${absolute}`,
	);
	return absolute;
}

export async function cleanupTemporaryRoot(candidate) {
	const safe = assertSafeTemporaryRoot(candidate);
	await rm(safe, { recursive: true, force: true });
}

async function executeStandalone({ temporaryRoot, log }) {
	const tarballDirectory = join(temporaryRoot, "tarballs");
	const consumerRoot = join(temporaryRoot, "consumer");
	await Promise.all([
		mkdir(tarballDirectory, { recursive: true }),
		mkdir(consumerRoot, { recursive: true }),
	]);
	log("pack", "Packing all public workspace packages");
	const packed = await packReleasePackages({
		repositoryRoot,
		tarballDirectory,
		pnpm: (args, cwd) => pnpm(args, cwd, `pack ${basename(cwd)}`),
	});
	return runConsumerCodegenScenario({ consumerRoot, packed, log });
}

function usage() {
	return `Usage: pnpm test:consumer:codegen -- [--keep] [--json] [--export-review-dir <directory>]

Runs a packed external-consumer smoke with the official TypeScript, Zod, and
request plugins. --keep retains the temporary project for debugging.
--export-review-dir atomically exports a compact snapshot beneath
.ci-artifacts/consumer-codegen-review/ after every validation passes.`;
}

export async function main({
	argv = process.argv.slice(2),
	stdout = (value) => process.stdout.write(value),
	stderr = (value) => process.stderr.write(value),
	createTemporaryRoot = () => mkdtemp(join(tmpdir(), temporaryPrefix)),
	execute = executeStandalone,
	exportReview = exportReviewSnapshot,
} = {}) {
	let options;
	try {
		options = parseArguments(argv);
	} catch (error) {
		stderr(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
	if (options.help) {
		stdout(`${usage()}\n`);
		return 0;
	}
	const temporaryRoot = await createTemporaryRoot();
	const log = (stage, message) => {
		const line = `[consumer-codegen:${stage}] ${message}\n`;
		(options.json ? stderr : stdout)(line);
	};
	let report;
	let reviewExport = null;
	let failure;
	try {
		report = await execute({ temporaryRoot, log });
		if (options.exportReviewDir) {
			log("export", "Exporting the validated consumer review snapshot");
			reviewExport = await exportReview({
				consumerRoot: join(temporaryRoot, "consumer"),
				targetDirectory: options.exportReviewDir,
				report,
			});
		}
	} catch (error) {
		failure = error instanceof Error ? error : new Error(String(error));
	} finally {
		if (!options.keep) {
			try {
				await cleanupTemporaryRoot(temporaryRoot);
			} catch (error) {
				failure ??= error instanceof Error ? error : new Error(String(error));
			}
		}
	}

	const result = {
		success: !failure,
		...(report ? { report } : {}),
		...(failure
			? { error: { name: failure.name, message: bounded(failure.message) } }
			: {}),
		temporaryRoot: options.keep ? resolve(temporaryRoot) : null,
		...(options.exportReviewDir ? { export: reviewExport } : {}),
	};
	if (options.json) stdout(`${JSON.stringify(result)}\n`);
	else if (failure) stderr(`${failure.message}\n`);
	else stdout("[consumer-codegen:complete] PASS\n");
	if (reviewExport) {
		const target = options.json ? stderr : stdout;
		target(
			`Consumer codegen review exported to ${reviewExport.path} (${reviewExport.fileCount} files)\n`,
		);
	}
	if (options.keep) {
		const target = options.json ? stderr : stdout;
		target(
			`Consumer codegen workspace retained at ${resolve(temporaryRoot)}\n`,
		);
	}
	return failure ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	process.exitCode = await main();
}
