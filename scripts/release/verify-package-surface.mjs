import { constants } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const repositoryUrl = "https://github.com/Vc-great/openapi-to.git";
const bugsUrl = "https://github.com/Vc-great/openapi-to/issues";
const homepage = "https://github.com/Vc-great/openapi-to#readme";
const expectedAggregateDependencies = [
	"@openapi-to/cli",
	"@openapi-to/core",
	"@openapi-to/plugin-msw",
	"@openapi-to/plugin-swr",
	"@openapi-to/plugin-ts-request",
	"@openapi-to/plugin-ts-type",
	"@openapi-to/plugin-vue-query",
	"@openapi-to/plugin-zod",
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
		else if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".d.cts"))
			files.push(path);
	}
	return files.sort();
}

async function packageRecords() {
	const records = [];
	for (const entry of await readdir(join(repositoryRoot, "packages"), {
		withFileTypes: true,
	})) {
		if (!entry.isDirectory()) continue;
		const directory = `packages/${entry.name}`;
		const manifestPath = join(repositoryRoot, directory, "package.json");
		if (!(await exists(manifestPath))) continue;
		records.push({
			directory,
			absoluteDirectory: join(repositoryRoot, directory),
			manifest: JSON.parse(await readFile(manifestPath, "utf8")),
		});
	}
	return records.sort((left, right) =>
		left.manifest.name.localeCompare(right.manifest.name),
	);
}

function targetTopLevel(target) {
	const normalized = target.replace(/^\.\//, "");
	return normalized.split("/", 1)[0];
}

const records = await packageRecords();
const publicRecords = records.filter(
	({ manifest }) => manifest.private !== true,
);
const privateRecords = records.filter(
	({ manifest }) => manifest.private === true,
);
const results = [];
const failures = [];

if (publicRecords.length !== 10)
	failures.push(`expected 10 public packages, found ${publicRecords.length}`);
for (const { manifest } of privateRecords) {
	if (manifest.publishConfig !== undefined)
		failures.push(
			`${manifest.name}: private package must not declare publishConfig`,
		);
}

const fixedVersions = new Set(
	publicRecords.map(({ manifest }) => manifest.version),
);
if (fixedVersions.size !== 1)
	failures.push(
		`public fixed-version packages disagree: ${[...fixedVersions].sort().join(", ")}`,
	);

for (const { directory, absoluteDirectory, manifest } of publicRecords) {
	const requiredTargets = [
		manifest.main,
		manifest.module,
		manifest.types,
		...exportTargets(manifest.exports),
	].filter((target) => typeof target === "string" && !target.includes("*"));
	for (const target of new Set(requiredTargets)) {
		if (!(await exists(resolve(absoluteDirectory, target)))) {
			failures.push(`${manifest.name}: missing package target ${target}`);
		}
	}
	for (const [name, target] of Object.entries(manifest.bin ?? {})) {
		const binPath = resolve(absoluteDirectory, target);
		if (!(await exists(binPath)))
			failures.push(`${manifest.name}: missing bin ${target}`);
		else {
			const bin = await readFile(binPath, "utf8");
			if (!bin.startsWith("#!/usr/bin/env node"))
				failures.push(
					`${manifest.name}: bin ${name} (${target}) has no Node shebang`,
				);
			if (
				process.platform !== "win32" &&
				((await stat(binPath)).mode & 0o111) === 0
			) {
				failures.push(
					`${manifest.name}: bin ${name} (${target}) is not executable`,
				);
			}
		}
	}

	for (const [field, value] of [
		["description", manifest.description],
		["license", manifest.license],
		["author", manifest.author],
		["main", manifest.main],
		["module", manifest.module],
		["types", manifest.types],
	]) {
		if (typeof value !== "string" || value.trim() === "")
			failures.push(`${manifest.name}: ${field} is missing`);
	}
	if (
		manifest.repository?.type !== "git" ||
		manifest.repository?.url !== repositoryUrl
	) {
		failures.push(`${manifest.name}: repository must use ${repositoryUrl}`);
	}
	if (manifest.repository?.directory !== directory)
		failures.push(
			`${manifest.name}: repository.directory must be ${directory}`,
		);
	if (manifest.bugs?.url !== bugsUrl)
		failures.push(`${manifest.name}: bugs.url must be ${bugsUrl}`);
	if (manifest.homepage !== homepage)
		failures.push(`${manifest.name}: homepage must be ${homepage}`);
	if (manifest.engines?.node !== ">=20")
		failures.push(`${manifest.name}: engines.node must be >=20`);
	if (!Array.isArray(manifest.files) || manifest.files.length === 0)
		failures.push(`${manifest.name}: package files allowlist is missing`);
	if (!manifest.exports || typeof manifest.exports !== "object")
		failures.push(`${manifest.name}: exports map is missing`);
	if (manifest.exports?.["."]?.types !== manifest.types)
		failures.push(`${manifest.name}: exports["."].types must match types`);
	if (manifest.publishConfig?.access !== "public")
		failures.push(`${manifest.name}: publishConfig.access must be public`);
	if (manifest.publishConfig?.registry !== "https://registry.npmjs.org/")
		failures.push(`${manifest.name}: publishConfig.registry must be npmjs`);

	const searchableMetadata = `${manifest.description ?? ""} ${(manifest.keywords ?? []).join(" ")}`;
	if (/\bfaker\b|\bnestjs\b|\breact[- ]?query\b/i.test(searchableMetadata)) {
		failures.push(
			`${manifest.name}: metadata advertises an unsupported generator`,
		);
	}

	const allowedTopLevels = new Set(
		(manifest.files ?? [])
			.filter((entry) => !entry.startsWith("!"))
			.map((entry) => entry.split("/", 1)[0]),
	);
	for (const target of [
		...requiredTargets,
		...Object.values(manifest.bin ?? {}),
	]) {
		const topLevel = targetTopLevel(target);
		if (topLevel !== "package.json" && !allowedTopLevels.has(topLevel)) {
			failures.push(
				`${manifest.name}: files does not include declared target ${target}`,
			);
		}
	}
	if (
		manifest.name === "@openapi-to/mcp" &&
		manifest.files.some(
			(path) => path === "scripts" || path.startsWith("scripts/"),
		)
	) {
		failures.push(
			"@openapi-to/mcp: repository-only Doctor/Inspector/test scripts must not be published",
		);
	}

	for (const declarationPath of await declarationFiles(
		join(absoluteDirectory, "dist"),
	)) {
		const path = relative(absoluteDirectory, declarationPath);
		const contents = await readFile(declarationPath, "utf8");
		if (/\/(?:Users|private)\/|[A-Za-z]:\\Users\\/.test(contents)) {
			failures.push(
				`${manifest.name}: declaration ${path} contains an absolute machine path`,
			);
		}
		if (/\.\.\/\.\.\/packages\//.test(contents)) {
			failures.push(
				`${manifest.name}: declaration ${path} references a workspace source path`,
			);
		}
	}

	results.push({
		package: manifest.name,
		version: manifest.version,
		engine: manifest.engines.node,
		exports: requiredTargets.length,
		bin: Object.keys(manifest.bin ?? {}).sort(),
		directory,
	});
}

const aggregate = publicRecords.find(
	({ manifest }) => manifest.name === "openapi-to",
)?.manifest;
if (!aggregate) {
	failures.push("openapi-to: aggregate package is missing");
} else {
	for (const dependency of expectedAggregateDependencies) {
		if (!aggregate.dependencies?.[dependency])
			failures.push(`openapi-to: missing aggregate dependency ${dependency}`);
	}
	if (
		aggregate.bin?.openapi !== "bin/openapi.js" ||
		aggregate.bin?.["openapi-to"] !== "bin/openapi.js"
	) {
		failures.push(
			"openapi-to: openapi and openapi-to must alias bin/openapi.js",
		);
	}
}

const changesetsConfig = JSON.parse(
	await readFile(join(repositoryRoot, ".changeset/config.json"), "utf8"),
);
const fixedGroup = new Set(changesetsConfig.fixed?.flat() ?? []);
for (const { manifest } of publicRecords) {
	if (!fixedGroup.has(manifest.name))
		failures.push(`${manifest.name}: missing from Changesets fixed group`);
}
for (const name of fixedGroup) {
	if (!publicRecords.some(({ manifest }) => manifest.name === name))
		failures.push(`${name}: fixed group names a non-public package`);
}

const readme = await readFile(join(repositoryRoot, "README.md"), "utf8");
if (!readme.includes("`openapi` and `openapi-to` binaries are aliases")) {
	failures.push("README does not declare the two aggregate bin aliases");
}
if (!readme.includes("docs/capability-matrix.md"))
	failures.push("README does not link the capability matrix");

if (failures.length > 0) {
	for (const failure of [...new Set(failures)].sort())
		process.stderr.write(`${failure}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(
		`${JSON.stringify({ success: true, packages: results }, null, 2)}\n`,
	);
}
