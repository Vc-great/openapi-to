import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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

async function exists(path) {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function exportTargets(value) {
	if (typeof value === "string") return [value];
	if (!value || typeof value !== "object") return [];
	return Object.values(value).flatMap(exportTargets);
}

async function declarationFiles(directory) {
	if (!(await exists(directory))) return [];
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await declarationFiles(path)));
		else if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".d.cts")) files.push(path);
	}
	return files.sort();
}

const results = [];
const failures = [];
for (const directory of packageDirectories) {
	const absoluteDirectory = join(repositoryRoot, directory);
	const manifest = JSON.parse(await readFile(join(absoluteDirectory, "package.json"), "utf8"));
	const requiredTargets = [manifest.main, manifest.module, manifest.types, ...exportTargets(manifest.exports)].filter(
		(target) => typeof target === "string" && !target.includes("*"),
	);
	for (const target of new Set(requiredTargets)) {
		if (!(await exists(resolve(absoluteDirectory, target)))) {
			failures.push(`${manifest.name}: missing package target ${target}`);
		}
	}
	for (const target of Object.values(manifest.bin ?? {})) {
		const binPath = resolve(absoluteDirectory, target);
		if (!(await exists(binPath))) failures.push(`${manifest.name}: missing bin ${target}`);
		else {
			const bin = await readFile(binPath, "utf8");
			if (!bin.startsWith("#!/usr/bin/env node")) failures.push(`${manifest.name}: bin ${target} has no Node shebang`);
		}
	}
	if (manifest.engines?.node !== ">=20") failures.push(`${manifest.name}: engines.node must be >=20`);
	if (manifest.private === true) failures.push(`${manifest.name}: public release package is marked private`);
	if (!Array.isArray(manifest.files)) failures.push(`${manifest.name}: package files allowlist is missing`);
	if (manifest.name === "@openapi-to/mcp" && manifest.files.some((path) => path === "scripts" || path.startsWith("scripts/"))) {
		failures.push("@openapi-to/mcp: repository-only Doctor/Inspector/test scripts must not be published");
	}
	if (!manifest.exports) failures.push(`${manifest.name}: exports map is missing`);
	if (manifest.publishConfig?.access !== "public") failures.push(`${manifest.name}: publishConfig.access must be public`);

	for (const declarationPath of await declarationFiles(join(absoluteDirectory, "dist"))) {
		const path = relative(absoluteDirectory, declarationPath);
		const contents = await readFile(declarationPath, "utf8");
		if (/\/(?:Users|private)\/|[A-Za-z]:\\Users\\/.test(contents)) {
			failures.push(`${manifest.name}: declaration ${path} contains an absolute machine path`);
		}
		if (/\.\.\/\.\.\/packages\//.test(contents)) {
			failures.push(`${manifest.name}: declaration ${path} references a workspace source path`);
		}
	}

	results.push({
		package: manifest.name,
		version: manifest.version,
		engine: manifest.engines.node,
		exports: requiredTargets.length,
		bin: Object.keys(manifest.bin ?? {}).sort(),
		directory: relative(repositoryRoot, absoluteDirectory),
	});
}

const aggregate = JSON.parse(await readFile(join(repositoryRoot, "packages/openapi/package.json"), "utf8"));
for (const dependency of [
	"@openapi-to/cli",
	"@openapi-to/core",
	"@openapi-to/plugin-msw",
	"@openapi-to/plugin-swr",
	"@openapi-to/plugin-ts-request",
	"@openapi-to/plugin-ts-type",
	"@openapi-to/plugin-vue-query",
	"@openapi-to/plugin-zod",
]) {
	if (!aggregate.dependencies?.[dependency]) failures.push(`openapi-to: missing aggregate dependency ${dependency}`);
}

if (failures.length > 0) {
	for (const failure of failures) process.stderr.write(`${failure}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(`${JSON.stringify({ success: true, packages: results }, null, 2)}\n`);
}
