import { execFile } from "node:child_process";
import { constants } from "node:fs";
import {
	access,
	lstat,
	readdir,
	readFile,
	realpath,
	stat,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
	"docs/cli.md",
	"docs/codex-mcp.md",
	"docs/mcp-security.md",
	"docs/troubleshooting.md",
	"docs/ai-hosts/claude-code.md",
	"docs/ai-hosts/cursor.md",
	"docs/ai-hosts/generic-stdio.md",
	"docs/testing/consumer-codegen.md",
	"docs/testing/ci-diagnostics.md",
];

export const REQUIRED_AGENT_DOCUMENTS = [
	"AGENTS.md",
	"packages/core/AGENTS.md",
	"packages/cli/AGENTS.md",
	"packages/mcp/AGENTS.md",
	".github/AGENTS.md",
];

const SKILL_ROOT = ".agents/skills";
const OPENAI_INTERFACE_REQUIRED_FIELDS = [
	"default_prompt",
	"display_name",
	"short_description",
];
const OPENAI_INTERFACE_OPTIONAL_FIELDS = [
	"brand_color",
	"icon_large",
	"icon_small",
];
const OPENAI_TOOL_REQUIRED_FIELDS = ["type", "value"];
const OPENAI_TOOL_OPTIONAL_FIELDS = ["description", "transport"];

function comparePaths(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values) {
	return [...new Set(values)].sort(comparePaths);
}

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

async function isGitTracked(root, path) {
	try {
		await execFileAsync("git", ["ls-files", "--error-unmatch", "--", path], {
			cwd: root,
		});
		return true;
	} catch {
		return false;
	}
}

async function gitTrackedRepositoryFiles(root) {
	const { stdout } = await execFileAsync(
		"git",
		["ls-files", "-z", "--cached"],
		{
			cwd: root,
			encoding: "buffer",
			maxBuffer: 16 * 1024 * 1024,
		},
	);
	return stdout.toString("utf8").split("\0").filter(Boolean);
}

export async function discoverAgentDocuments(root = repositoryRoot) {
	const trackedFiles = await gitTrackedRepositoryFiles(root);
	return sortedUnique(
		trackedFiles.filter((path) => /(?:^|\/)AGENTS\.md$/.test(path)),
	);
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

function unwrapMarkdownTarget(target) {
	const unwrapped = target.replace(/^<|>$/g, "");
	if (
		unwrapped.startsWith("#") ||
		/^(?:https?:|mailto:|data:)/i.test(unwrapped)
	) {
		return undefined;
	}
	return unwrapped.split("#", 1)[0] || undefined;
}

function isWindowsAbsolutePath(path) {
	return /^[a-zA-Z]:[\\/]/.test(path) || /^(?:\\\\|\/\/)/.test(path);
}

function isInsideRepository(root, target) {
	const repositoryRelative = relative(root, target);
	return (
		repositoryRelative === "" ||
		(repositoryRelative !== ".." &&
			!repositoryRelative.startsWith(`..${sep}`) &&
			!isAbsolute(repositoryRelative))
	);
}

function trackedTargetExists(trackedFiles, relativeTarget, isDirectory) {
	if (relativeTarget === "") return trackedFiles.size > 0;
	if (trackedFiles.has(relativeTarget)) return true;
	return (
		isDirectory &&
		[...trackedFiles].some((path) => path.startsWith(`${relativeTarget}/`))
	);
}

async function containsSymlink(root, target) {
	// Formal Agent and Skill references reject every symlink segment, even when
	// its real target would remain inside the repository.
	const repositoryRelative = relative(root, target);
	if (!repositoryRelative) return false;
	let current = root;
	for (const segment of repositoryRelative.split(sep)) {
		current = join(current, segment);
		if ((await lstat(current)).isSymbolicLink()) return true;
	}
	return false;
}

async function validateRepositoryReference({
	root,
	baseDirectory,
	rawTarget,
	relativeDocument,
	trackedFiles,
	failures,
}) {
	const targetWithoutAnchor = unwrapMarkdownTarget(rawTarget);
	if (!targetWithoutAnchor) return;

	let decoded;
	try {
		decoded = decodeURIComponent(targetWithoutAnchor);
	} catch {
		failures.push(
			`${relativeDocument} contains malformed percent encoding in reference ${rawTarget}`,
		);
		return;
	}
	const normalized = decoded.replaceAll("\\", "/");
	if (isAbsolute(normalized) || isWindowsAbsolutePath(decoded)) {
		failures.push(
			`${relativeDocument} reference escapes repository boundary: ${rawTarget}`,
		);
		return;
	}

	const stableTarget = stableMentionPrefix(normalized);
	const target = resolve(baseDirectory, stableTarget);
	if (!isInsideRepository(root, target)) {
		failures.push(
			`${relativeDocument} reference escapes repository boundary: ${rawTarget}`,
		);
		return;
	}
	if (!(await exists(target))) {
		failures.push(`${relativeDocument} references missing path ${rawTarget}`);
		return;
	}
	if (await containsSymlink(root, target)) {
		failures.push(
			`${relativeDocument} reference must not traverse a symlink: ${rawTarget}`,
		);
		return;
	}
	const [realRoot, realTarget] = await Promise.all([
		realpath(root),
		realpath(target),
	]);
	if (!isInsideRepository(realRoot, realTarget)) {
		failures.push(
			`${relativeDocument} reference resolves outside repository: ${rawTarget}`,
		);
		return;
	}
	const targetStat = await stat(target);
	const relativeTarget = relative(root, target).split(sep).join("/");
	if (
		!trackedTargetExists(trackedFiles, relativeTarget, targetStat.isDirectory())
	) {
		failures.push(
			`${relativeDocument} references path not tracked by Git: ${rawTarget}`,
		);
	}
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

export function parseSkillFrontmatter(contents) {
	const normalized = contents.replaceAll("\r\n", "\n");
	if (!normalized.startsWith("---\n"))
		throw new Error("SKILL.md must start with YAML frontmatter");
	const end = normalized.indexOf("\n---\n", 4);
	if (end < 0) throw new Error("SKILL.md frontmatter is not terminated");
	const entries = new Map();
	for (const line of normalized.slice(4, end).split("\n")) {
		if (!line.trim()) continue;
		const match = line.match(/^([a-z][a-z0-9-]*):\s*(.+)$/);
		if (!match) throw new Error(`unsupported frontmatter line: ${line}`);
		const [, key, rawValue] = match;
		if (entries.has(key)) throw new Error(`duplicate frontmatter key: ${key}`);
		let value = rawValue.trim();
		if (value.startsWith('"')) value = JSON.parse(value);
		else if (value.startsWith("'")) {
			if (!value.endsWith("'"))
				throw new Error(`unterminated quoted frontmatter value: ${key}`);
			value = value.slice(1, -1).replaceAll("''", "'");
		}
		entries.set(key, value);
	}
	if (
		JSON.stringify([...entries.keys()].sort()) !==
		JSON.stringify(["description", "name"])
	) {
		throw new Error(
			"SKILL.md frontmatter must contain only name and description",
		);
	}
	return {
		name: entries.get("name"),
		description: entries.get("description"),
	};
}

export function parseOpenAiSkillYaml(contents) {
	// This intentionally parses a documented repository subset, not arbitrary YAML.
	// Keeping the accepted schema explicit avoids silently ignoring new authority or
	// dependency metadata while allowing common Codex Skill interface fields.
	const lines = contents.replaceAll("\r\n", "\n").split("\n");
	const interfaceValues = new Map();
	const tools = [];
	let section;
	let currentTool;

	const parseQuotedValue = (line, pattern, context) => {
		const match = line.match(pattern);
		if (!match)
			throw new Error(
				`unsupported agents/openai.yaml ${context}; values must be double-quoted JSON strings: ${line}`,
			);
		return [match[1], JSON.parse(match[2])];
	};

	for (const line of lines) {
		if (!line.trim()) continue;
		if (line === "interface:") {
			if (section)
				throw new Error("duplicate or out-of-order agents/openai.yaml section");
			section = "interface";
			continue;
		}
		if (line === "dependencies:") {
			if (section !== "interface")
				throw new Error(
					"agents/openai.yaml dependencies must follow interface",
				);
			section = "dependencies";
			continue;
		}
		if (line === "  tools:") {
			if (section !== "dependencies")
				throw new Error(
					"agents/openai.yaml tools must be nested under dependencies",
				);
			section = "tools";
			continue;
		}
		if (section === "interface") {
			const [key, value] = parseQuotedValue(
				line,
				/^ {2}([a-z][a-z0-9_]*):\s*("(?:[^"\\]|\\.)*")$/,
				"interface line",
			);
			const supported = [
				...OPENAI_INTERFACE_REQUIRED_FIELDS,
				...OPENAI_INTERFACE_OPTIONAL_FIELDS,
			];
			if (!supported.includes(key))
				throw new Error(
					`unsupported agents/openai.yaml interface field ${key}; supported fields: ${supported.join(", ")}`,
				);
			if (interfaceValues.has(key))
				throw new Error(`duplicate agents/openai.yaml key: ${key}`);
			interfaceValues.set(key, value);
			continue;
		}
		if (section === "tools") {
			const item = line.match(
				/^ {4}- ([a-z][a-z0-9_]*):\s*("(?:[^"\\]|\\.)*")$/,
			);
			const property = line.match(
				/^ {6}([a-z][a-z0-9_]*):\s*("(?:[^"\\]|\\.)*")$/,
			);
			const match = item ?? property;
			if (!match)
				throw new Error(
					`unsupported agents/openai.yaml dependency line; tool values must be double-quoted JSON strings: ${line}`,
				);
			if (item) {
				currentTool = new Map();
				tools.push(currentTool);
			}
			if (!currentTool)
				throw new Error(
					"agents/openai.yaml tool properties require a preceding list item",
				);
			const [, key, rawValue] = match;
			const supported = [
				...OPENAI_TOOL_REQUIRED_FIELDS,
				...OPENAI_TOOL_OPTIONAL_FIELDS,
			];
			if (!supported.includes(key))
				throw new Error(
					`unsupported agents/openai.yaml tool field ${key}; supported fields: ${supported.join(", ")}`,
				);
			if (currentTool.has(key))
				throw new Error(`duplicate agents/openai.yaml tool key: ${key}`);
			currentTool.set(key, JSON.parse(rawValue));
			continue;
		}
		throw new Error(
			`agents/openai.yaml must start with one interface mapping: ${line}`,
		);
	}

	const missingInterface = OPENAI_INTERFACE_REQUIRED_FIELDS.filter(
		(field) => !interfaceValues.has(field),
	);
	if (missingInterface.length > 0) {
		throw new Error(
			`agents/openai.yaml interface is missing required fields: ${missingInterface.join(", ")}`,
		);
	}
	if (
		interfaceValues.has("brand_color") &&
		!/^#[0-9A-Fa-f]{6}$/.test(interfaceValues.get("brand_color"))
	) {
		throw new Error(
			"agents/openai.yaml brand_color must use quoted #RRGGBB format",
		);
	}
	for (const [index, tool] of tools.entries()) {
		const missing = OPENAI_TOOL_REQUIRED_FIELDS.filter(
			(field) => !tool.has(field),
		);
		if (missing.length > 0)
			throw new Error(
				`agents/openai.yaml dependency tool ${index + 1} is missing required fields: ${missing.join(", ")}`,
			);
		if (tool.get("type") !== "mcp")
			throw new Error('agents/openai.yaml dependency tool type must be "mcp"');
	}

	const parsed = Object.fromEntries(interfaceValues);
	if (section === "dependencies" || section === "tools") {
		parsed.dependencies = {
			tools: tools.map((tool) => Object.fromEntries(tool)),
		};
	}
	return parsed;
}

function markdownRepositoryPathMentions(contents) {
	const mentions = new Set();
	for (const match of contents.matchAll(/`([^`\r\n]+)`/g)) {
		const candidate = match[1].trim();
		if (
			/^(?:\.agents|\.github|\.changeset|packages|docs|scripts|e2e|configs)\//.test(
				candidate,
			) ||
			candidate === "AGENTS.md"
		) {
			mentions.add(candidate.replace(/[),;:]+$/, ""));
		}
	}
	for (const match of contents.matchAll(
		/(?:^|[\s("'=])((?:\.agents|\.github|\.changeset)\/[A-Za-z0-9_./*<>-]+)/gm,
	)) {
		mentions.add(match[1].replace(/[),;:]+$/, ""));
	}
	return [...mentions];
}

function stableMentionPrefix(mention) {
	const marker = mention.search(/[*?[\]<>]/);
	if (marker < 0) return mention;
	const prefix = mention.slice(0, marker);
	return prefix.endsWith("/") ? prefix.slice(0, -1) : dirname(prefix);
}

async function validateMentionedPaths(
	root,
	documentPath,
	relativeDocument,
	contents,
	trackedFiles,
	failures,
) {
	for (const target of markdownLinks(contents)) {
		await validateRepositoryReference({
			root,
			baseDirectory: dirname(documentPath),
			rawTarget: target,
			relativeDocument,
			trackedFiles,
			failures,
		});
	}
	const mentions = markdownRepositoryPathMentions(contents);
	if (relativeDocument.endsWith("AGENTS.md")) {
		for (const match of contents.matchAll(/`(src\/[A-Za-z0-9_./-]+)`/g))
			mentions.push(match[1]);
	}
	for (const mention of new Set(mentions)) {
		await validateRepositoryReference({
			root,
			baseDirectory: mention.startsWith("src/") ? dirname(documentPath) : root,
			rawTarget: mention,
			relativeDocument,
			trackedFiles,
			failures,
		});
	}
}

function shellWords(line) {
	return line
		.trim()
		.split(/\s+/)
		.map((word) => word.replace(/^['"]|['"]$/g, ""));
}

function documentedPnpmInvocations(contents) {
	const invocations = [];
	for (const match of contents.matchAll(/^\s*pnpm\s+([^\r\n\\]+)/gm)) {
		const words = shellWords(match[1]);
		while (
			words[0]?.startsWith("--") &&
			!["--filter", "--dir"].includes(words[0])
		) {
			words.shift();
		}
		const filterIndex = words.findIndex(
			(word) => word === "--filter" || word.startsWith("--filter="),
		);
		if (filterIndex >= 0) {
			const selector = words[filterIndex].includes("=")
				? words[filterIndex].slice(words[filterIndex].indexOf("=") + 1)
				: words[filterIndex + 1];
			const scriptIndex =
				filterIndex + (words[filterIndex].includes("=") ? 1 : 2);
			const script =
				words[scriptIndex] === "run"
					? words[scriptIndex + 1]
					: words[scriptIndex];
			if (selector && script)
				invocations.push({ kind: "filter", selector, script });
			continue;
		}
		const directoryIndex = words.indexOf("--dir");
		if (directoryIndex >= 0) {
			const directory = words[directoryIndex + 1];
			const scriptIndex = directoryIndex + 2;
			const script =
				words[scriptIndex] === "run"
					? words[scriptIndex + 1]
					: words[scriptIndex];
			if (directory && script)
				invocations.push({ kind: "directory", directory, script });
			continue;
		}
		let command = words[0];
		if (command === "run") command = words[1];
		if (
			command &&
			!["add", "dlx", "exec", "install", "pack", "publish", "remove"].includes(
				command,
			)
		) {
			invocations.push({ kind: "root", script: command });
		}
	}
	return invocations;
}

async function validateDocumentedPnpmInvocations(
	root,
	relativeDocument,
	contents,
	rootManifest,
	workspaceManifests,
	failures,
) {
	const manifestsByName = new Map(
		[...workspaceManifests.entries()].map(([directory, manifest]) => [
			manifest.name,
			{ directory, manifest },
		]),
	);
	for (const invocation of documentedPnpmInvocations(contents)) {
		if (
			["<package-name>", "<plugin-package>"].includes(invocation.selector) ||
			invocation.script?.includes("<")
		) {
			continue;
		}
		if (invocation.kind === "root") {
			if (!rootManifest.scripts?.[invocation.script])
				failures.push(
					`${relativeDocument} names missing root script ${invocation.script}`,
				);
			continue;
		}
		if (invocation.kind === "filter") {
			const selected = manifestsByName.get(invocation.selector);
			if (!selected) {
				failures.push(
					`${relativeDocument} filters unknown package ${invocation.selector}`,
				);
			} else if (!selected.manifest.scripts?.[invocation.script]) {
				failures.push(
					`${relativeDocument} names missing ${invocation.selector} script ${invocation.script}`,
				);
			}
			continue;
		}
		const directory = invocation.directory.replace(/^\.\//, "");
		const manifest =
			workspaceManifests.get(directory) ??
			((await exists(join(root, directory, "package.json")))
				? await readJson(join(root, directory, "package.json"))
				: undefined);
		if (!manifest) {
			failures.push(
				`${relativeDocument} uses unknown pnpm directory ${invocation.directory}`,
			);
		} else if (!manifest.scripts?.[invocation.script]) {
			failures.push(
				`${relativeDocument} names missing ${manifest.name} script ${invocation.script}`,
			);
		}
	}
}

function toolMatrixSize(contents, testName) {
	const testStart = contents.indexOf(testName);
	if (testStart < 0) return undefined;
	const assertion = contents
		.slice(testStart)
		.match(/toEqual\(\[([\s\S]*?)\]\)/);
	return assertion?.[1].match(/['"]openapi_[a-z_]+['"]/g)?.length ?? 0;
}

export async function auditAgentAndSkillContracts(
	root,
	{ rootManifest, workspaceManifests = new Map() } = {},
) {
	const failures = [];
	const manifest = rootManifest ?? (await readJson(join(root, "package.json")));
	let trackedFiles;
	try {
		trackedFiles = new Set(await gitTrackedRepositoryFiles(root));
	} catch (error) {
		return {
			failures: [
				`unable to discover Git-tracked Agent and Skill files: ${error.message}`,
			],
			agents: [],
			skills: [],
		};
	}

	for (const relativeDocument of REQUIRED_AGENT_DOCUMENTS) {
		const documentPath = join(root, relativeDocument);
		if (!(await exists(documentPath))) {
			failures.push(`missing required Agent instruction ${relativeDocument}`);
		} else if (!trackedFiles.has(relativeDocument)) {
			failures.push(
				`required Agent instruction is not tracked by Git: ${relativeDocument}`,
			);
		}
	}

	const discoveredAgentDocuments = sortedUnique(
		[...trackedFiles].filter((path) => /(?:^|\/)AGENTS\.md$/.test(path)),
	);
	for (const relativeDocument of discoveredAgentDocuments) {
		const documentPath = join(root, relativeDocument);
		if (!(await exists(documentPath))) {
			failures.push(`tracked Agent instruction is missing ${relativeDocument}`);
			continue;
		}
		const contents = await readFile(documentPath, "utf8");
		await validateMentionedPaths(
			root,
			documentPath,
			relativeDocument,
			contents,
			trackedFiles,
			failures,
		);
		await validateDocumentedPnpmInvocations(
			root,
			relativeDocument,
			contents,
			manifest,
			workspaceManifests,
			failures,
		);
	}

	const trackedSkillPaths = [...trackedFiles].filter((path) =>
		path.startsWith(`${SKILL_ROOT}/`),
	);
	const skillDirectories = sortedUnique(
		trackedSkillPaths
			.map((path) => path.match(/^\.agents\/skills\/([^/]+)\//)?.[1])
			.filter(Boolean),
	);
	const skillRootPath = join(root, SKILL_ROOT);
	if (!(await exists(skillRootPath))) {
		failures.push(`missing authoritative Skill root ${SKILL_ROOT}`);
	} else if (skillDirectories.length === 0) {
		failures.push(`${SKILL_ROOT} must contain at least one Git-tracked Skill`);
	}

	const skillNames = new Set();
	for (const directoryName of skillDirectories) {
		const relativeSkill = `${SKILL_ROOT}/${directoryName}/SKILL.md`;
		const skillPath = join(root, relativeSkill);
		if (!trackedFiles.has(relativeSkill) || !(await exists(skillPath))) {
			failures.push(`missing tracked Skill entrypoint ${relativeSkill}`);
			continue;
		}
		const contents = await readFile(skillPath, "utf8");
		let metadata;
		try {
			metadata = parseSkillFrontmatter(contents);
		} catch (error) {
			failures.push(
				`${relativeSkill} has invalid frontmatter: ${error.message}`,
			);
		}
		if (metadata) {
			if (metadata.name !== directoryName)
				failures.push(
					`${relativeSkill} name ${metadata.name} must match directory ${directoryName}`,
				);
			if (skillNames.has(metadata.name))
				failures.push(`duplicate Skill name ${metadata.name}`);
			skillNames.add(metadata.name);
			if (
				typeof metadata.description !== "string" ||
				metadata.description.trim().length < 80 ||
				!/\bUse (?:after|for|when)\b/.test(metadata.description)
			) {
				failures.push(
					`${relativeSkill} description must be non-empty, specific, and state when to use the Skill`,
				);
			}
		}

		const relativeOpenAiYaml = `${SKILL_ROOT}/${directoryName}/agents/openai.yaml`;
		const openAiYamlPath = join(root, relativeOpenAiYaml);
		if (!(await exists(openAiYamlPath))) {
			failures.push(`missing Skill interface ${relativeOpenAiYaml}`);
		} else if (!trackedFiles.has(relativeOpenAiYaml)) {
			failures.push(
				`Skill interface is not tracked by Git: ${relativeOpenAiYaml}`,
			);
		} else {
			try {
				const interfaceMetadata = parseOpenAiSkillYaml(
					await readFile(openAiYamlPath, "utf8"),
				);
				if (!interfaceMetadata.display_name.trim())
					failures.push(`${relativeOpenAiYaml} display_name must not be empty`);
				if (
					interfaceMetadata.short_description.length < 25 ||
					interfaceMetadata.short_description.length > 64
				) {
					failures.push(
						`${relativeOpenAiYaml} short_description must be 25-64 characters`,
					);
				}
				if (!interfaceMetadata.default_prompt.includes(`$${directoryName}`)) {
					failures.push(
						`${relativeOpenAiYaml} default_prompt must invoke $${directoryName}`,
					);
				}
				const purposeTokens = directoryName
					.split("-")
					.filter((token) => !["add", "fix", "run", "upgrade"].includes(token));
				const interfacePurpose =
					`${interfaceMetadata.display_name} ${interfaceMetadata.short_description}`.toLowerCase();
				if (
					purposeTokens.length > 0 &&
					!purposeTokens.some((token) => interfacePurpose.includes(token))
				) {
					failures.push(
						`${relativeOpenAiYaml} purpose does not match Skill ${directoryName}`,
					);
				}
				for (const iconField of ["icon_small", "icon_large"]) {
					if (!interfaceMetadata[iconField]) continue;
					await validateRepositoryReference({
						root,
						baseDirectory: dirname(openAiYamlPath),
						rawTarget: interfaceMetadata[iconField],
						relativeDocument: relativeOpenAiYaml,
						trackedFiles,
						failures,
					});
				}
			} catch (error) {
				failures.push(`${relativeOpenAiYaml} is invalid: ${error.message}`);
			}
		}

		await validateMentionedPaths(
			root,
			skillPath,
			relativeSkill,
			contents,
			trackedFiles,
			failures,
		);
		await validateDocumentedPnpmInvocations(
			root,
			relativeSkill,
			contents,
			manifest,
			workspaceManifests,
			failures,
		);
	}

	for (const trackedSkill of sortedUnique(
		[...trackedFiles].filter((path) => /(?:^|\/)SKILL\.md$/.test(path)),
	)) {
		if (!/^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(trackedSkill))
			failures.push(
				`tracked Skill mirror outside ${SKILL_ROOT}: ${trackedSkill}`,
			);
	}

	return {
		failures: sortedUnique(failures),
		agents: discoveredAgentDocuments,
		skills: skillDirectories,
	};
}

const CI_DIAGNOSTIC_CORE_PATHS = [
	"scripts/ci-diagnostics/schema.mjs",
	"scripts/ci-diagnostics/sanitize.mjs",
	"scripts/ci-diagnostics/filesystem.mjs",
	"scripts/ci-diagnostics/plans.mjs",
	"scripts/ci-diagnostics/initialize.mjs",
	"scripts/ci-diagnostics/run-command.mjs",
	"scripts/ci-diagnostics/finalize-job.mjs",
	"scripts/ci-diagnostics/ci-diagnostics.node-test.mjs",
	"docs/testing/ci-diagnostics.md",
];

const CI_DIAGNOSTIC_WORKFLOWS = new Map([
	[".github/workflows/quality.yml", 5],
	[".github/workflows/a1-cross-platform.yml", 1],
	[".github/workflows/e2e.yaml", 7],
	[".github/workflows/version-readiness.yml", 1],
]);

function occurrences(contents, pattern) {
	return [...contents.matchAll(pattern)].length;
}

export async function auditCiDiagnosticsContracts(root = repositoryRoot) {
	const failures = [];
	for (const relativePath of CI_DIAGNOSTIC_CORE_PATHS) {
		if (!(await exists(join(root, relativePath)))) {
			failures.push(`missing CI diagnostics infrastructure ${relativePath}`);
			continue;
		}
		if (!(await isGitTracked(root, relativePath))) {
			failures.push(
				`CI diagnostics infrastructure is not Git-tracked: ${relativePath}`,
			);
		}
	}

	const schemaPath = join(root, "scripts/ci-diagnostics/schema.mjs");
	if (await exists(schemaPath)) {
		const schema = await readFile(schemaPath, "utf8");
		if (!/SCHEMA_VERSION\s*=\s*1\b/.test(schema)) {
			failures.push("CI diagnostics schema entrypoint must declare version 1");
		}
		if (!schema.includes('DIAGNOSTIC_KIND = "openapi-to-ci-diagnostic"')) {
			failures.push(
				"CI diagnostics schema entrypoint must declare the stable kind",
			);
		}
		if (!/ARTIFACT_RETENTION_DAYS\s*=\s*14\b/.test(schema)) {
			failures.push(
				"CI diagnostics artifact retention contract must remain 14 days",
			);
		}
	}

	for (const [relativePath, expectedJobs] of CI_DIAGNOSTIC_WORKFLOWS) {
		const workflowPath = join(root, relativePath);
		if (!(await exists(workflowPath))) {
			failures.push(`missing CI diagnostics workflow ${relativePath}`);
			continue;
		}
		const workflow = await readFile(workflowPath, "utf8");
		const finalizers = occurrences(
			workflow,
			/^\s+- name: Finalize CI diagnostics\s*$/gm,
		);
		const uploads = occurrences(
			workflow,
			/^\s+- name: Upload CI failure diagnostics\s*$/gm,
		);
		const alwaysFinalizers = occurrences(
			workflow,
			/- name: Finalize CI diagnostics\s*\r?\n\s+if: always\(\)/g,
		);
		const failureUploads = occurrences(
			workflow,
			/- name: Upload CI failure diagnostics\s*\r?\n\s+if: failure\(\)/g,
		);
		if (finalizers !== expectedJobs || alwaysFinalizers !== expectedJobs) {
			failures.push(
				`${relativePath} must finalize all ${expectedJobs} covered Jobs with if: always()`,
			);
		}
		if (uploads !== expectedJobs || failureUploads !== expectedJobs) {
			failures.push(
				`${relativePath} must upload all ${expectedJobs} standard diagnostics with if: failure()`,
			);
		}
		if (
			occurrences(
				workflow,
				/name: ci-diagnostics-[^\r\n]+\r?\n\s+path: \$\{\{ env\.CI_DIAGNOSTIC_DIR }}\r?\n\s+if-no-files-found: error\r?\n\s+retention-days: 14/g,
			) !== expectedJobs
		) {
			failures.push(
				`${relativePath} standard artifacts must use stable names, the diagnostic directory, if-no-files-found error, and 14-day retention`,
			);
		}
		if (workflow.includes("continue-on-error")) {
			failures.push(`${relativePath} must not use continue-on-error`);
		}
		if (!/permissions:\s*\r?\n\s+contents: read/.test(workflow)) {
			failures.push(`${relativePath} must declare contents: read`);
		}
		for (const forbidden of [
			"contents: write",
			"pull-requests: write",
			"issues: write",
			"pull_request_target:",
			"workflow_run:",
		]) {
			if (workflow.includes(forbidden)) {
				failures.push(
					`${relativePath} contains forbidden diagnostic authority: ${forbidden}`,
				);
			}
		}
	}

	const qualityPath = join(root, ".github/workflows/quality.yml");
	if (await exists(qualityPath)) {
		const quality = await readFile(qualityPath, "utf8");
		for (const command of [
			"pnpm build --concurrency=1",
			"pnpm typecheck --concurrency=1",
			"pnpm exec tsc -b",
			"pnpm test:vitest",
			"pnpm test:release-scripts",
			"pnpm lint:changed --base",
			"pnpm verify:repository-contract",
			"pnpm verify:package-surface",
			"pnpm release:smoke",
			"pnpm verify:changeset-state:development",
		]) {
			if (!quality.includes(command)) {
				failures.push(
					`Quality diagnostics integration removed gate command: ${command}`,
				);
			}
		}
	}

	const a1Path = join(root, ".github/workflows/a1-cross-platform.yml");
	if (await exists(a1Path)) {
		const a1 = await readFile(a1Path, "utf8");
		for (const required of [
			"fail-fast: false",
			"os: [ubuntu-latest, windows-latest, macos-latest]",
			"pnpm test:a1-contracts",
			"pnpm exec openapi --help",
			"pnpm exec openapi-to --version",
			"pnpm exec openapi-to-mcp --help",
			"packages/openapi/bin/openapi-to-mcp.js --help",
			"packages/mcp/bin/openapi-to-mcp.js --help",
		]) {
			if (!a1.includes(required)) {
				failures.push(
					`A1 diagnostics integration removed contract: ${required}`,
				);
			}
		}
	}

	const e2ePath = join(root, ".github/workflows/e2e.yaml");
	if (await exists(e2ePath)) {
		const e2e = await readFile(e2ePath, "utf8");
		for (const required of [
			"common:",
			"module:",
			"remote:",
			"mcp-stdio-e2e:",
			"mcp-cross-platform:",
			"mcp-transaction-safety:",
			"mcp-performance:",
			"os: [ubuntu-latest, windows-latest, macos-latest]",
			"fail-fast: false",
			"if: github.event_name != 'pull_request'",
			"if: github.event_name != 'schedule'",
			"if: always()",
		]) {
			if (!e2e.includes(required)) {
				failures.push(
					`E2E diagnostics integration removed contract: ${required}`,
				);
			}
		}
	}

	const versionPackagesPath = join(
		root,
		".github/workflows/version-packages.yml",
	);
	if (await exists(versionPackagesPath)) {
		const versionPackages = await readFile(versionPackagesPath, "utf8");
		for (const forbidden of [
			"ci-diagnostics",
			"Finalize CI diagnostics",
			"workflow_run:",
			"pull_request_target:",
			"openai",
			"codex",
		]) {
			if (versionPackages.toLowerCase().includes(forbidden.toLowerCase())) {
				failures.push(
					`Version Packages must remain outside CI diagnostics and AI integration: ${forbidden}`,
				);
			}
		}
	}

	return sortedUnique(failures);
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
			if (
				name === "test" &&
				/\bvitest\b/.test(script) &&
				!/\bvitest\s+run\b/.test(script)
			) {
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

	const agentSkillAudit = await auditAgentAndSkillContracts(root, {
		rootManifest,
		workspaceManifests,
	});
	failures.push(...agentSkillAudit.failures);
	failures.push(...(await auditCiDiagnosticsContracts(root)));

	if (
		rootManifest.scripts?.["version:canary"] !==
		"pnpm exec changeset version --snapshot canary"
	) {
		failures.push(
			"version:canary must parse as `pnpm exec changeset version --snapshot canary`",
		);
	}
	if (rootManifest.scripts?.version !== "pnpm exec changeset version") {
		failures.push("version must run changeset version without publishing");
	}
	const releaseCheck = rootManifest.scripts?.["release:check"] ?? "";
	if (!/(?:^|&&\s*)pnpm\s+lint:ci(?:\s*&&|$)/.test(releaseCheck)) {
		failures.push("release:check must run the full lint:ci gate");
	}
	if (/\bpnpm\s+lint:changed\b/.test(releaseCheck)) {
		failures.push(
			"release:check must not use the diff-only lint:changed command",
		);
	}
	if (
		!/(?:^|&&\s*)pnpm\s+verify:changeset-state(?:\s*&&|$)/.test(releaseCheck)
	) {
		failures.push(
			"release:check must run the prerelease-aware verify:changeset-state gate",
		);
	}
	if (/\bpnpm\s+verify:changeset-state:development\b/.test(releaseCheck)) {
		failures.push("release:check must not use the development Changesets gate");
	}
	if (/\bchangeset\s+status\b/.test(releaseCheck)) {
		failures.push("release:check must not invoke changeset status directly");
	}
	if (
		rootManifest.scripts?.["verify:changeset-state"] !==
		"node scripts/verify-changeset-state.mjs"
	) {
		failures.push(
			"verify:changeset-state must run the maintained Changesets state validator",
		);
	}
	if (
		rootManifest.scripts?.["verify:changeset-state:development"] !==
		"node scripts/verify-changeset-state.mjs --allow-pending"
	) {
		failures.push(
			"verify:changeset-state:development must allow only pending Changesets",
		);
	}
	if (await exists(join(root, ".changeset/new-mice-sit.md"))) {
		failures.push("empty Changeset workaround new-mice-sit.md must not exist");
	}
	if (!(await exists(join(root, ".changeset/pre.json")))) {
		failures.push("tracked prerelease state .changeset/pre.json must exist");
	} else if (!(await isGitTracked(root, ".changeset/pre.json"))) {
		failures.push(".changeset/pre.json must be tracked by Git");
	}
	const lintCi = rootManifest.scripts?.["lint:ci"] ?? "";
	if (lintCi !== "node scripts/lint-ci.mjs") {
		failures.push("lint:ci must run the tracked-file lint driver");
	}
	if (/(?:--changed|--staged|\blint:changed\b)/.test(lintCi)) {
		failures.push("lint:ci must not depend on working-tree changes");
	}
	const qualityWorkflow = await readFile(
		join(root, ".github/workflows/quality.yml"),
		"utf8",
	);
	if (!qualityWorkflow.includes("-- pnpm verify:changeset-state:development")) {
		failures.push(
			"Quality package smoke must run verify:changeset-state:development",
		);
	}
	if (
		/run:\s+pnpm verify:changeset-state\s*(?:\r?\n|$)/.test(qualityWorkflow)
	) {
		failures.push("Quality must not run the strict Changesets release gate");
	}
	if (qualityWorkflow.includes("continue-on-error")) {
		failures.push(
			"Quality must not continue on Changesets or other gate errors",
		);
	}

	const versionWorkflowPath = join(
		root,
		".github/workflows/version-packages.yml",
	);
	if (!(await exists(versionWorkflowPath))) {
		failures.push("missing Version Packages workflow");
	} else {
		const workflow = await readFile(versionWorkflowPath, "utf8");
		const triggerLines = (
			workflow.match(/^on:\s*\r?\n([\s\S]*?)^concurrency:/m)?.[1] ?? ""
		)
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		if (
			JSON.stringify(triggerLines) !==
			JSON.stringify(["push:", "branches:", "- main"])
		) {
			failures.push(
				"Version Packages workflow must run only on pushes to main",
			);
		}
		for (const forbiddenEvent of [
			"pull_request:",
			"pull_request_target:",
			"workflow_dispatch:",
			"schedule:",
		]) {
			if (workflow.includes(forbiddenEvent))
				failures.push(
					`Version Packages workflow must not use ${forbiddenEvent}`,
				);
		}
		const permissions =
			workflow.match(/permissions:\s*\r?\n([\s\S]*?)\r?\njobs:/)?.[1] ?? "";
		const permissionLines = permissions
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.sort();
		if (
			JSON.stringify(permissionLines) !==
			JSON.stringify(["contents: write", "pull-requests: write"])
		) {
			failures.push(
				"Version Packages workflow must grant only contents: write and pull-requests: write",
			);
		}
		if (!workflow.includes("uses: changesets/action@v1")) {
			failures.push("Version Packages workflow must use changesets/action@v1");
		}
		if (workflow.includes("uses: changesets/action@v2")) {
			failures.push(
				"Version Packages workflow must not use changesets/action@v2",
			);
		}
		if (!workflow.includes("version: pnpm run version")) {
			failures.push(
				"Version Packages workflow must use the root version script",
			);
		}
		if (!/GITHUB_TOKEN:\s+\$\{\{\s*secrets\.GITHUB_TOKEN\s*}}/.test(workflow)) {
			failures.push(
				"Version Packages workflow must use the repository GITHUB_TOKEN",
			);
		}
		if (/^\s*publish:/m.test(workflow)) {
			failures.push("Version Packages workflow must not configure publishing");
		}
		for (const forbidden of [
			"NPM_TOKEN",
			"NODE_AUTH_TOKEN",
			"changeset publish",
			"pnpm publish",
			"npm publish",
			"pnpm release",
			"changeset pre exit",
			"changeset tag",
			"npm dist-tag",
			"git tag",
			"git push --tags",
			"gh release",
			"actions/create-release",
			"gh pr merge",
			"auto-merge",
		]) {
			if (workflow.includes(forbidden))
				failures.push(
					`Version Packages workflow contains forbidden release behavior: ${forbidden}`,
				);
		}
	}

	const readinessWorkflowPath = join(
		root,
		".github/workflows/version-readiness.yml",
	);
	if (!(await exists(readinessWorkflowPath))) {
		failures.push("missing Version readiness workflow");
	} else {
		const workflow = await readFile(readinessWorkflowPath, "utf8");
		for (const required of [
			"pull_request:",
			"- main",
			'".changeset/pre.json"',
			'"packages/*/package.json"',
			'"packages/*/CHANGELOG.md"',
			'"e2e/*/package.json"',
			'"e2e/*/CHANGELOG.md"',
			'"pnpm-lock.yaml"',
			"name: Verify strict Changesets state",
		]) {
			if (!workflow.includes(required))
				failures.push(`Version readiness workflow is missing ${required}`);
		}
		if (!/--\s+pnpm verify:changeset-state\s*(?:\r?\n|$)/.test(workflow)) {
			failures.push(
				"Version readiness workflow must run strict verify:changeset-state",
			);
		}
		if (workflow.includes("--allow-pending")) {
			failures.push(
				"Version readiness workflow must not allow pending Changesets",
			);
		}
		if (workflow.includes("continue-on-error")) {
			failures.push("Version readiness workflow must not continue on errors");
		}
		if (workflow.includes("pull_request.title")) {
			failures.push(
				"Version readiness workflow must use paths rather than a PR title",
			);
		}
	}
	const a1WorkflowPath = join(root, ".github/workflows/a1-cross-platform.yml");
	if (!(await exists(a1WorkflowPath))) {
		failures.push("missing A1 cross-platform contracts workflow");
	} else {
		const a1Workflow = await readFile(a1WorkflowPath, "utf8");
		for (const required of [
			"push:",
			"pull_request:",
			"workflow_dispatch:",
			"ubuntu-latest",
			"windows-latest",
			"macos-latest",
			"fail-fast: false",
			"pnpm build --concurrency=1",
			"pnpm test:a1-contracts",
			"working-directory: e2e/common",
			"packages/openapi/bin/openapi-to-mcp.js",
			"packages/mcp/bin/openapi-to-mcp.js",
			"actions/upload-artifact@v4",
			"A1_TEST_ARTIFACT_DIR",
		]) {
			if (!a1Workflow.includes(required))
				failures.push(`A1 workflow is missing ${required}`);
		}
	}
	if (
		rootManifest.scripts?.["test:a1-contracts"] !==
		"node scripts/run-a1-contracts.mjs"
	) {
		failures.push(
			"test:a1-contracts must use the inventory-checking A1 test runner",
		);
	}

	const e2eWorkflowPath = join(root, ".github/workflows/e2e.yaml");
	if (!(await exists(e2eWorkflowPath))) {
		failures.push("missing deterministic E2E workflow");
	} else {
		const e2eWorkflow = await readFile(e2eWorkflowPath, "utf8");
		for (const required of [
			"CLI CommonJS E2E",
			"CLI ESM E2E",
			"CLI local HTTP E2E",
			"pnpm test:e2e:common",
			"pnpm test:e2e:module",
			"pnpm test:e2e:remote",
			"MCP cross-platform smoke",
			"MCP_TEST_ARTIFACT_DIR",
			"actions/upload-artifact@v4",
		]) {
			if (!e2eWorkflow.includes(required))
				failures.push(`E2E workflow is missing ${required}`);
		}
		if (e2eWorkflow.includes("fail-fast: true"))
			failures.push("E2E workflow matrices must keep fail-fast disabled");
		if (!e2eWorkflow.includes("fail-fast: false"))
			failures.push("E2E workflow must declare fail-fast: false");
		if (e2eWorkflow.includes("petstore.swagger.io"))
			failures.push(
				"blocking E2E workflow must not depend on the public Petstore service",
			);
	}
	for (const requiredPath of [
		"e2e/fixtures/petstore.json",
		"e2e/fixtures/petstore.yaml",
		"e2e/run-cli-e2e.mjs",
		"e2e/run-remote-e2e.mjs",
		"packages/mcp/scripts/cross-platform-smoke.mjs",
	]) {
		if (!(await exists(join(root, requiredPath))))
			failures.push(`missing deterministic E2E input ${requiredPath}`);
	}
	for (const script of [
		"test:e2e:common",
		"test:e2e:module",
		"test:e2e:remote",
	]) {
		if (!rootManifest.scripts?.[script])
			failures.push(`missing root ${script} script`);
	}

	const stateDirectorySource = await readFile(
		join(root, "packages/core/src/stateDirectoryName.ts"),
		"utf8",
	);
	const coreIndex = await readFile(
		join(root, "packages/core/src/index.ts"),
		"utf8",
	);
	const configLoader = await readFile(
		join(root, "packages/core/src/config/loadOpenapiConfig.ts"),
		"utf8",
	);
	const selectionState = await readFile(
		join(root, "packages/mcp/src/generation/selection-state.ts"),
		"utf8",
	);
	if (!stateDirectorySource.includes('stateDirectoryName = ".openapi-to"')) {
		failures.push("Core stateDirectoryName must define .openapi-to");
	}
	if (
		!coreIndex.includes("export { stateDirectoryName }") ||
		coreIndex.includes("folderName") ||
		(await exists(join(root, "packages/core/src/folderName.ts")))
	) {
		failures.push(
			"Core must export stateDirectoryName without a folderName compatibility alias",
		);
	}
	for (const extension of ["ts", "js", "cjs", "mjs"]) {
		if (!configLoader.includes(`"${extension}"`))
			failures.push(
				`Core config discovery must include root openapi.config.${extension}`,
			);
	}
	if (
		!selectionState.includes("stateDirectoryName") ||
		selectionState.includes('".openapi-to/selections"')
	) {
		failures.push(
			"MCP selection state must derive its directory from Core stateDirectoryName",
		);
	}

	const serverIntegration = await readFile(
		join(root, "packages/mcp/src/server.integration.test.ts"),
		"utf8",
	);
	const controlledWriteIntegration = await readFile(
		join(root, "packages/mcp/src/controlled-write.integration.test.ts"),
		"utf8",
	);
	for (const [label, actual, expected] of [
		[
			"no-config MCP",
			toolMatrixSize(
				serverIntegration,
				"initializes a no-config server with exactly three bounded analysis tools",
			),
			3,
		],
		[
			"trusted-config MCP",
			toolMatrixSize(
				serverIntegration,
				"registers generation tools only for fixed trusted config and preserves stdio integrity",
			),
			8,
		],
		[
			"write-enabled MCP",
			toolMatrixSize(
				controlledWriteIntegration,
				"prepares without writing, applies exactly once, and leaves generation current",
			),
			10,
		],
	]) {
		if (actual !== expected)
			failures.push(
				`${label} Tool matrix must contain exactly ${expected} Tools (found ${actual ?? "no assertion"})`,
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
			const localTarget = unwrapMarkdownTarget(target);
			if (!localTarget) continue;
			let decodedTarget;
			try {
				decodedTarget = decodeURIComponent(localTarget);
			} catch {
				failures.push(
					`${relativeDocument} contains malformed percent encoding in reference ${target}`,
				);
				continue;
			}
			const targetPath = resolve(dirname(documentPath), decodedTarget);
			if (!(await exists(targetPath)))
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
		aggregate.bin?.["openapi-to"] !== "bin/openapi.js" ||
		aggregate.bin?.["openapi-to-mcp"] !== "bin/openapi-to-mcp.js"
	) {
		failures.push(
			"openapi-to must publish its two CLI aliases and the openapi-to-mcp wrapper",
		);
	}
	const rootReadme = await readFile(join(root, "README.md"), "utf8");
	if (
		!rootReadme.includes(
			"`openapi` and `openapi-to` are CLI aliases; `openapi-to-mcp` starts the stdio MCP server",
		)
	) {
		failures.push(
			"README must state the aggregate package's three binary entrypoints",
		);
	}

	return {
		failures: sortedUnique(failures),
		workspaces: uniqueWorkspaceDirectories,
		documents: DOCUMENT_ENTRYPOINTS,
		agents: agentSkillAudit.agents,
		skills: agentSkillAudit.skills,
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
				agents: result.agents,
				skills: result.skills,
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
