import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const LINTABLE_EXTENSIONS = new Set([
	".cjs",
	".js",
	".json",
	".jsonc",
	".jsx",
	".mjs",
	".ts",
	".tsx",
]);

// These tracked legacy files are not parseable as their filename's language by
// Biome 2.2.
const EXCLUDED_PATHS = new Set([
	"packages/config-ts/base.json",
	"packages/config-ts/bundler.json",
	"packages/openapi/src/utils.ts",
	// Checked-in generator output: the source generator and snapshots own it.
	"packages/plugin-swr/mock/newPetAPI.ts",
	// Checked-in TypeScript request/type generator output with intentional namespace merging.
	"packages/plugin-ts-type/mock/User.ts",
]);

const EXCLUDED_PREFIXES = [
	// Checked-in TypeScript generator output fixtures.
	"packages/plugin-ts-type/mock/typeModels/",
	// Checked-in Zod generator output fixtures.
	"packages/plugin-zod/mock/zodModels/",
];

const LEGACY_RULES = [
	"lint/correctness/noConstructorReturn",
	"lint/suspicious/useIterableCallbackReturn",
];

const BATCH_SIZE = 100;

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: process.cwd(),
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
		...options,
	});
	if (result.error) throw result.error;
	return result;
}

export function collectTrackedLintableFiles() {
	const result = run("git", [
		"ls-files",
		"-z",
		"--",
		"packages",
		"scripts",
		"e2e",
		"configs",
	]);
	if (result.status !== 0) {
		process.stderr.write(result.stderr ?? "");
		throw new Error(`git ls-files exited with status ${result.status}`);
	}
	return (result.stdout ?? "")
		.split("\0")
		.filter(Boolean)
		.filter((path) => LINTABLE_EXTENSIONS.has(extname(path).toLowerCase()))
		.filter((path) => !EXCLUDED_PATHS.has(path))
		.filter(
			(path) => !EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix)),
		)
		.filter((path) => existsSync(resolve(process.cwd(), path)))
		.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function biomeCommand() {
	const configured = process.env.LINT_CI_BIOME;
	if (configured) {
		return configured.endsWith(".mjs") || configured.endsWith(".js")
			? { command: process.execPath, prefix: [configured] }
			: { command: configured, prefix: [] };
	}
	const suffix = process.platform === "win32" ? ".cmd" : "";
	return {
		command: resolve(process.cwd(), "node_modules", ".bin", `biome${suffix}`),
		prefix: [],
	};
}

export function main() {
	const files = collectTrackedLintableFiles();
	if (files.length === 0) {
		throw new Error("lint:ci found no tracked lintable repository files");
	}

	const { command, prefix } = biomeCommand();
	for (let index = 0; index < files.length; index += BATCH_SIZE) {
		const batch = files.slice(index, index + BATCH_SIZE);
		const result = run(
			command,
			[
				...prefix,
				"lint",
				"--files-ignore-unknown=true",
				"--no-errors-on-unmatched",
				"--diagnostic-level=error",
				"--max-diagnostics=none",
				...LEGACY_RULES.map((rule) => `--skip=${rule}`),
				"--",
				...batch,
			],
			{ stdio: "inherit" },
		);
		if (result.status !== 0) {
			process.exitCode = result.status ?? 1;
			return;
		}
	}
}

main();
