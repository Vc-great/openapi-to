import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

import { bundleRequire } from "bundle-require";
import { cosmiconfig, type Loader } from "cosmiconfig";
import type { Plugin } from "esbuild";

import { DiagnosticError } from "../diagnostics.ts";
import { throwIfAborted } from "../execution.ts";
import type { OpenapiToConfig } from "../types";

export interface LoadOpenapiConfigOptions {
	cwd?: string;
	moduleName?: string;
	configPath?: string;
	/** Restrict the config entry and bundled relative imports to this directory. */
	localFileRoot?: string;
	signal?: AbortSignal;
}

export interface LoadedOpenapiConfig {
	config: OpenapiToConfig;
	filepath: string;
	sources: ConfigSourceSnapshot[];
}

export interface ConfigSourceSnapshot {
	path: string;
	sha256: string;
	bytes: number;
	identity: {
		device: string;
		inode: string;
		size: string;
		modifiedNanoseconds: string;
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOutsideRoot(root: string, candidate: string): boolean {
	const relativePath = path.relative(root, candidate);
	return (
		relativePath === ".." ||
		relativePath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativePath)
	);
}

function configFileNames(moduleName: string): string[] {
	return ["ts", "js", "cjs", "mjs"].map(
		(extension) => `${moduleName}.config.${extension}`,
	);
}

function stablePath(candidate: string): string {
	return candidate.split(path.sep).join("/");
}

async function findConfigPath(
	cwd: string,
	moduleName: string,
): Promise<string | undefined> {
	const names = configFileNames(moduleName);
	let directory = cwd;
	for (;;) {
		const candidates: string[] = [];
		for (const name of names) {
			const candidate = path.join(directory, name);
			try {
				await lstat(candidate);
				candidates.push(candidate);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
		}
		candidates.sort((left, right) =>
			left < right ? -1 : left > right ? 1 : 0,
		);
		if (candidates.length > 1) {
			const displayed = candidates
				.map((candidate) =>
					stablePath(path.relative(cwd, candidate) || path.basename(candidate)),
				)
				.sort();
			throw new DiagnosticError(
				"OpenAPI configuration discovery is ambiguous.",
				[
					{
						code: "OPENAPI_CONFIG_AMBIGUOUS",
						severity: "error",
						message: `Multiple OpenAPI configuration files were found in the nearest configuration directory: ${displayed.join(", ")}.`,
						hint: "Remove the extra root configuration files or explicitly select one with --config.",
					},
				],
			);
		}
		if (candidates[0]) return candidates[0];
		const parent = path.dirname(directory);
		if (parent === directory) return undefined;
		directory = parent;
	}
}

async function createBundledLoader(
	sources: Map<string, ConfigSourceSnapshot>,
	localFileRoot?: string,
	signal?: AbortSignal,
): Promise<Loader> {
	const canonicalRoot = localFileRoot
		? await realpath(path.resolve(localFileRoot))
		: undefined;
	return async (configFile: string) => {
		throwIfAborted(signal);
		const sourceSnapshotPlugin: Plugin = {
			name: "openapi-to-config-source-snapshot",
			setup(build) {
				build.onLoad({ filter: /.*/ }, async (args) => {
					if (args.namespace !== "file") return;
					throwIfAborted(signal);
					const canonicalPath = await realpath(args.path);
					if (canonicalRoot && isOutsideRoot(canonicalRoot, canonicalPath)) {
						throw new Error(
							"Config local imports must remain inside the configured local file root.",
						);
					}
					const before = await lstat(canonicalPath, { bigint: true });
					const handle = await open(canonicalPath, "r");
					try {
						const opened = await handle.stat({ bigint: true });
						if (before.dev !== opened.dev || before.ino !== opened.ino)
							throw new Error(
								"Config source changed while it was being opened.",
							);
						const contents = await handle.readFile("utf8");
						const after = await lstat(canonicalPath, { bigint: true });
						if (
							after.dev !== opened.dev ||
							after.ino !== opened.ino ||
							after.size !== opened.size ||
							after.mtimeNs !== opened.mtimeNs
						) {
							throw new Error(
								"Config source changed while it was being loaded.",
							);
						}
						throwIfAborted(signal);
						sources.set(canonicalPath, {
							path: canonicalPath,
							sha256: createHash("sha256").update(contents).digest("hex"),
							bytes: Buffer.byteLength(contents),
							identity: {
								device: opened.dev.toString(),
								inode: opened.ino.toString(),
								size: opened.size.toString(),
								modifiedNanoseconds: opened.mtimeNs.toString(),
							},
						});
						const extension = path.extname(canonicalPath).toLowerCase();
						const loader =
							extension === ".ts"
								? "ts"
								: extension === ".tsx"
									? "tsx"
									: extension === ".jsx"
										? "jsx"
										: extension === ".json"
											? "json"
											: "js";
						return { contents, loader };
					} finally {
						await handle.close();
					}
				});
			},
		};
		const loaded = await bundleRequire({
			filepath: configFile,
			esbuildOptions: { plugins: [sourceSnapshotPlugin] },
		});
		throwIfAborted(signal);
		return loaded.mod.default ?? loaded.mod;
	};
}

export async function loadOpenapiConfig(
	options: LoadOpenapiConfigOptions = {},
): Promise<LoadedOpenapiConfig> {
	throwIfAborted(options.signal);
	const cwd = path.resolve(options.cwd ?? process.cwd());
	const moduleName = options.moduleName ?? "openapi";
	const sources = new Map<string, ConfigSourceSnapshot>();
	const loader = await createBundledLoader(
		sources,
		options.localFileRoot,
		options.signal,
	);
	const explorer = cosmiconfig(moduleName, {
		cache: false,
		searchPlaces: configFileNames(moduleName),
		loaders: { ".js": loader, ".cjs": loader, ".mjs": loader, ".ts": loader },
	});
	const configPath = options.configPath
		? path.resolve(cwd, options.configPath)
		: await findConfigPath(cwd, moduleName);
	const result = configPath ? await explorer.load(configPath) : null;
	throwIfAborted(options.signal);
	if (!result || result.isEmpty || !isRecord(result.config))
		throw new Error(
			"OpenAPI configuration is not defined or does not export an object.",
		);
	return {
		config: result.config as OpenapiToConfig,
		filepath: result.filepath,
		sources: [...sources.values()].sort((left, right) =>
			left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
		),
	};
}
