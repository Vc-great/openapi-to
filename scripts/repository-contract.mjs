import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
);

const TOOL_PACKAGES = new Map([
	["biome", "@biomejs/biome"],
	["changeset", "@changesets/cli"],
	["husky", "husky"],
	["rimraf", "rimraf"],
	["tsc", "typescript"],
	["tsup", "tsup"],
	["turbo", "turbo"],
	["vitest", "vitest"],
]);

const DOCUMENT_ENTRYPOINTS = [
	"README.md",
	"packages/core/README.md",
	"packages/mcp/README.md",
	"packages/openapi/README.md",
	"docs/capability-matrix.md",
	"docs/getting-started.md",
	"docs/codex-mcp.md",
	"docs/mcp-security.md",
	"docs/troubleshooting.md",
	"docs/ai-hosts/claude-code.md",
	"docs/ai-hosts/cursor.md",
	"docs/ai-hosts/generic-stdio.md",
];

async function exists(path) {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function readJson(path) {
	return JSON.parse(await readFile(path, "utf8"));
}

export function parseWorkspacePatterns(contents) {
	return contents
		.split(/\r?\n/)
		.map((line) => line.match(/^\s*-\s*['"]([^'"]+)['"]\s*$/)?.[1])
		.filter(Boolean);
}

async function expandWorkspacePattern(root, pattern) {
	if (!pattern.endsWith("/*"))
		return (await exists(join(root, pattern, "package.json"))) ? [pattern] : [];
	const parent = pattern.slice(0, -2);
	const parentPath = join(root, parent);
	if (!(await exists(parentPath))) return [];
	const entries = await readdir(parentPath, { withFileTypes: true });
	const matches = [];
	for (const entry of entries.sort((left, right) =>
		left.name.localeCompare(right.name),
	)) {
		if (!entry.isDirectory()) continue;
		const workspace = `${parent}/${entry.name}`;
		if (await exists(join(root, workspace, "package.json")))
			matches.push(workspace);
	}
	return matches;
}

function allDependencies(manifest) {
	return {
		...manifest.dependencies,
		...manifest.devDependencies,
		...manifest.optionalDependencies,
		...manifest.peerDependencies,
	};
}

function scriptToolInvocations(script) {
	const tools = new Set();
	for (const tool of TOOL_PACKAGES.keys()) {
		const pattern = new RegExp(
			`(?:^|[;&|]\\s*|\\bpnpm\\s+exec\\s+)${tool.replaceAll("-", "\\-")}(?:\\s|$)`,
		);
		if (pattern.test(script)) tools.add(tool);
	}
	return tools;
}

function nodeScriptPaths(script) {
	const paths = [];
	const pattern = /\bnode\s+(?:(?:--[\w-]+(?:=[^\s]+)?|-r)\s+)*([^\s;&|]+)/g;
	for (const match of script.matchAll(pattern)) {
		const candidate = match[1];
		if (candidate && !candidate.startsWith("-")) paths.push(candidate);
	}
	return paths;
}

async function scriptPathExists(baseDirectory, candidate) {
	const normalized = candidate.replace(/^['"]|['"]$/g, "");
	const wildcard = normalized.search(/[*?[\]]/);
	if (wildcard < 0) return exists(resolve(baseDirectory, normalized));
	const stablePrefix = normalized.slice(0, wildcard);
	const directory = stablePrefix.endsWith("/")
		? stablePrefix
		: dirname(stablePrefix);
	return exists(resolve(baseDirectory, directory));
}

function markdownLinks(contents) {
	return [...contents.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)].map((match) =>
		match[1].trim(),
	);
}

function localMarkdownTarget(documentPath, target) {
	const unwrapped = target.replace(/^<|>$/g, "");
	if (
		unwrapped.startsWith("#") ||
		unwrapped.startsWith("/") ||
		/^(?:https?:|mailto:|data:)/i.test(unwrapped)
	) {
		return undefined;
	}
	const withoutAnchor = unwrapped.split("#", 1)[0];
	if (!withoutAnchor) return undefined;
	return resolve(dirname(documentPath), decodeURIComponent(withoutAnchor));
}

function jsonCodeBlocks(contents) {
	return [...contents.matchAll(/```json[^\S\r\n]*\r?\n([\s\S]*?)```/g)].map(
		(match) => match[1],
	);
}

function documentedPnpmScripts(contents) {
	const names = new Set();
	for (const match of contents.matchAll(
		/^\s*pnpm\s+(?:run\s+)?([a-zA-Z][\w:/.-]*)/gm,
	)) {
		const name = match[1];
		if (
			!["add", "exec", "install", "publish", "filter", "pack", "dlx"].includes(
				name,
			)
		)
			names.add(name);
	}
	return names;
}

export async function auditRepositoryContracts(root = repositoryRoot) {
	const failures = [];
	const rootManifest = await readJson(join(root, "package.json"));
	const pnpmPatterns = parseWorkspacePatterns(
		await readFile(join(root, "pnpm-workspace.yaml"), "utf8"),
	);
	const npmPatterns = [...(rootManifest.workspaces?.packages ?? [])];
	if (
		JSON.stringify([...pnpmPatterns].sort()) !==
		JSON.stringify([...npmPatterns].sort())
	) {
		failures.push("root workspaces.packages must match pnpm-workspace.yaml");
	}

	const workspaceDirectories = [];
	for (const pattern of pnpmPatterns) {
		const matches = await expandWorkspacePattern(root, pattern);
		if (matches.length === 0)
			failures.push(
				`workspace pattern has no package.json matches: ${pattern}`,
			);
		workspaceDirectories.push(...matches);
	}
	const uniqueWorkspaceDirectories = [...new Set(workspaceDirectories)].sort();
	const workspaceManifests = new Map();
	for (const directory of uniqueWorkspaceDirectories) {
		workspaceManifests.set(
			directory,
			await readJson(join(root, directory, "package.json")),
		);
	}

	const rootDependencies = allDependencies(rootManifest);
	for (const [directory, manifest] of [
		[".", rootManifest],
		...workspaceManifests,
	]) {
		for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
			const label = `${manifest.name}#${name}`;
			if (/\bbun\s+run\b|\bbun\s+biome\b/.test(script))
				failures.push(`${label} uses Bun`);
			if (/(?:^|\s)npx(?:\s|$)/.test(script))
				failures.push(`${label} uses uncontrolled npx`);
			if (name === "test" && /\bvitest\b/.test(script) && !/\bvitest\s+run\b/.test(script)) {
				failures.push(`${label} must use non-interactive vitest run`);
			}
			for (const tool of scriptToolInvocations(script)) {
				const packageName = TOOL_PACKAGES.get(tool);
				if (!rootDependencies[packageName])
					failures.push(
						`${label} uses undeclared repository tool ${tool} (${packageName})`,
					);
			}
			if (
				/\bopenapi(?:-to)?(?:\s|$)/.test(script) &&
				!allDependencies(manifest)["openapi-to"]
			) {
				failures.push(
					`${label} invokes the aggregate CLI without an openapi-to dependency`,
				);
			}
			for (const candidate of nodeScriptPaths(script)) {
				if (!(await scriptPathExists(join(root, directory), candidate)))
					failures.push(`${label} references missing Node script ${candidate}`);
			}
		}
	}

	if (
		rootManifest.scripts?.["version:canary"] !==
		"pnpm exec changeset version --snapshot canary"
	) {
		failures.push(
			"version:canary must parse as `pnpm exec changeset version --snapshot canary`",
		);
	}

	const publicPackageNames = new Set(
		[...workspaceManifests.values()]
			.filter((manifest) => manifest.private !== true)
			.map((manifest) => manifest.name),
	);
	for (const relativeDocument of DOCUMENT_ENTRYPOINTS) {
		const documentPath = join(root, relativeDocument);
		if (!(await exists(documentPath))) {
			failures.push(`missing documentation entrypoint ${relativeDocument}`);
			continue;
		}
		const contents = await readFile(documentPath, "utf8");
		for (const target of markdownLinks(contents)) {
			const localTarget = localMarkdownTarget(documentPath, target);
			if (localTarget && !(await exists(localTarget)))
				failures.push(`${relativeDocument} links to missing path ${target}`);
		}
		for (const block of jsonCodeBlocks(contents)) {
			try {
				JSON.parse(block);
			} catch (error) {
				failures.push(
					`${relativeDocument} contains invalid JSON example: ${error.message}`,
				);
			}
		}
		for (const packageName of contents.match(/@openapi-to\/[a-z-]+/g) ?? []) {
			if (!publicPackageNames.has(packageName))
				failures.push(
					`${relativeDocument} names unknown public package ${packageName}`,
				);
		}
		for (const script of documentedPnpmScripts(contents)) {
			if (!rootManifest.scripts?.[script])
				failures.push(
					`${relativeDocument} names missing root script ${script}`,
				);
		}
	}

	const matrix = await readFile(
		join(root, "docs/capability-matrix.md"),
		"utf8",
	);
	for (const status of [
		"Stable",
		"Experimental",
		"Partial",
		"Planned",
		"Not supported",
	]) {
		if (!matrix.includes(`| ${status} |`))
			failures.push(`capability matrix does not define ${status}`);
	}

	const aggregate = await readJson(join(root, "packages/openapi/package.json"));
	if (
		aggregate.bin?.openapi !== "bin/openapi.js" ||
		aggregate.bin?.["openapi-to"] !== "bin/openapi.js"
	) {
		failures.push(
			"openapi-to must publish openapi and openapi-to as aliases of bin/openapi.js",
		);
	}
	const rootReadme = await readFile(join(root, "README.md"), "utf8");
	if (!rootReadme.includes("`openapi` and `openapi-to` binaries are aliases")) {
		failures.push(
			"README must state that openapi and openapi-to are binary aliases",
		);
	}

	return {
		failures: [...new Set(failures)].sort(),
		workspaces: uniqueWorkspaceDirectories,
		documents: DOCUMENT_ENTRYPOINTS,
	};
}

export async function main() {
	const result = await auditRepositoryContracts();
	if (result.failures.length > 0) {
		for (const failure of result.failures) process.stderr.write(`${failure}\n`);
		process.exitCode = 1;
		return;
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				success: true,
				workspaces: result.workspaces,
				documents: result.documents,
			},
			null,
			2,
		)}\n`,
	);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await main();
