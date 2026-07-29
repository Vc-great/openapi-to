import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
	auditAgentAndSkillContracts,
	auditCiDiagnosticsContracts,
	auditRepositoryContracts,
	discoverAgentDocuments,
	parseOpenAiSkillYaml,
	parseSkillFrontmatter,
	parseWorkspacePatterns,
	REQUIRED_AGENT_DOCUMENTS,
	repositoryRoot,
} from "./repository-contract.mjs";

const execFileAsync = promisify(execFile);

async function writeFixtureFile(root, relativePath, contents) {
	const path = join(root, relativePath);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, contents);
}

async function git(root, ...args) {
	await execFileAsync("git", args, { cwd: root });
}

function skillContents(name, body = "") {
	return `---
name: ${name}
description: Use when a focused repository example needs deterministic contract validation without unrelated product changes.
---

# ${name}

${body}
`;
}

function skillInterface(name) {
	return `interface:
  display_name: "${name} contract example"
  short_description: "Validate the ${name} repository contract"
  default_prompt: "Use $${name} to validate the repository contract."
`;
}

async function createContractFixture(t) {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-contract-"));
	t.after(async () => {
		await rm(root, { recursive: true, force: true });
	});
	await git(root, "init", "--quiet");
	await writeFixtureFile(
		root,
		"package.json",
		`${JSON.stringify(
			{
				name: "contract-fixture",
				private: true,
				scripts: { known: "node scripts/known.mjs" },
			},
			null,
			2,
		)}\n`,
	);
	for (const document of REQUIRED_AGENT_DOCUMENTS)
		await writeFixtureFile(root, document, `# ${document}\n`);
	await writeFixtureFile(
		root,
		".agents/skills/example/SKILL.md",
		skillContents("example"),
	);
	await writeFixtureFile(
		root,
		".agents/skills/example/agents/openai.yaml",
		skillInterface("example"),
	);
	await writeFixtureFile(root, "scripts/known.mjs", "export {};\n");
	await git(root, "add", "--", ".");
	return root;
}

async function createCiDiagnosticsContractFixture(t) {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-ci-contract-"));
	t.after(async () => {
		await rm(root, { recursive: true, force: true });
	});
	await git(root, "init", "--quiet");
	for (const relativePath of [
		"scripts/ci-diagnostics/schema.mjs",
		"scripts/ci-diagnostics/sanitize.mjs",
		"scripts/ci-diagnostics/filesystem.mjs",
		"scripts/ci-diagnostics/plans.mjs",
		"scripts/ci-diagnostics/initialize.mjs",
		"scripts/ci-diagnostics/run-command.mjs",
		"scripts/ci-diagnostics/finalize-job.mjs",
		"scripts/ci-diagnostics/ci-diagnostics.node-test.mjs",
		"docs/testing/ci-diagnostics.md",
		".github/workflows/quality.yml",
		".github/workflows/a1-cross-platform.yml",
		".github/workflows/e2e.yaml",
		".github/workflows/version-readiness.yml",
		".github/workflows/version-packages.yml",
	]) {
		await writeFixtureFile(
			root,
			relativePath,
			await readFile(join(repositoryRoot, relativePath), "utf8"),
		);
	}
	await git(root, "add", "--", ".");
	return root;
}

function assertFailure(result, pattern) {
	assert.ok(
		result.failures.some((failure) => pattern.test(failure)),
		`expected failure ${pattern}, received:\n${result.failures.join("\n")}`,
	);
}

test("repository scripts, workspaces, docs, packages, and binary claims stay aligned", async () => {
	const result = await auditRepositoryContracts(repositoryRoot);
	assert.deepEqual(result.failures, []);
	assert.ok(result.workspaces.includes("packages/openapi"));
	assert.ok(result.workspaces.includes("packages/mcp"));
	assert.ok(result.workspaces.includes("e2e/common"));
	assert.ok(result.workspaces.includes("e2e/module"));
	assert.deepEqual(result.agents, [
		".github/AGENTS.md",
		"AGENTS.md",
		"packages/cli/AGENTS.md",
		"packages/core/AGENTS.md",
		"packages/mcp/AGENTS.md",
	]);
	assert.deepEqual(result.agents, [...result.agents].sort());
	assert.deepEqual(result.skills, [...result.skills].sort());
	assert.ok(result.skills.includes("fix-github-actions"));
	assert.ok(result.skills.includes("fix-codegen-regression"));
});

test("blocking Actions workflows use controlled fixtures and retain diagnostic artifacts", async () => {
	const [a1, e2e] = await Promise.all([
		readFile(
			join(repositoryRoot, ".github/workflows/a1-cross-platform.yml"),
			"utf8",
		),
		readFile(join(repositoryRoot, ".github/workflows/e2e.yaml"), "utf8"),
	]);
	assert.match(a1, /fail-fast:\s*false/);
	assert.match(a1, /working-directory:\s*e2e\/common/);
	assert.match(a1, /actions\/upload-artifact@v4/);
	assert.doesNotMatch(e2e, /petstore\.swagger\.io/);
	assert.doesNotMatch(e2e, /fail-fast:\s*true/);
	assert.match(e2e, /pnpm test:e2e:remote/);
	assert.match(e2e, /MCP_TEST_ARTIFACT_DIR/);
	assert.match(e2e, /actions\/upload-artifact@v4/);
});

test("CI diagnostics repository contract accepts the tracked bounded integration", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	assert.deepEqual(await auditCiDiagnosticsContracts(root), []);
});

test("CI diagnostics repository contract rejects missing or untracked core files", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	await rm(join(root, "scripts/ci-diagnostics/run-command.mjs"));
	let failures = await auditCiDiagnosticsContracts(root);
	assert.ok(
		failures.some((failure) =>
			/missing CI diagnostics infrastructure scripts\/ci-diagnostics\/run-command\.mjs/.test(
				failure,
			),
		),
	);
	await git(
		root,
		"rm",
		"--cached",
		"--force",
		"--",
		"scripts/ci-diagnostics/run-command.mjs",
	);
	await writeFixtureFile(
		root,
		"scripts/ci-diagnostics/run-command.mjs",
		"export {};\n",
	);
	failures = await auditCiDiagnosticsContracts(root);
	assert.ok(
		failures.some((failure) =>
			/not Git-tracked: scripts\/ci-diagnostics\/run-command\.mjs/.test(
				failure,
			),
		),
	);
});

test("CI diagnostics repository contract rejects schema and retention drift", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const schemaPath = join(root, "scripts/ci-diagnostics/schema.mjs");
	const schema = await readFile(schemaPath, "utf8");
	await writeFile(
		schemaPath,
		schema
			.replace("SCHEMA_VERSION = 1", "SCHEMA_VERSION = 2")
			.replace("ARTIFACT_RETENTION_DAYS = 14", "ARTIFACT_RETENTION_DAYS = 7"),
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assert.ok(
		failures.some((failure) =>
			/schema entrypoint must declare version 1/.test(failure),
		),
	);
	assert.ok(
		failures.some((failure) =>
			/retention contract must remain 14 days/.test(failure),
		),
	);
});

test("CI diagnostics repository contract rejects missing finalizers and hidden failures", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const workflowPath = join(root, ".github/workflows/quality.yml");
	const workflow = await readFile(workflowPath, "utf8");
	await writeFile(
		workflowPath,
		workflow
			.replace("- name: Finalize CI diagnostics", "- name: Missing finalizer")
			.replace("    steps:", "    continue-on-error: true\n    steps:"),
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assert.ok(
		failures.some((failure) =>
			/must finalize all 5 covered Jobs/.test(failure),
		),
	);
	assert.ok(
		failures.some((failure) => /must not use continue-on-error/.test(failure)),
	);
});

test("CI diagnostics repository contract rejects artifact-policy drift", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const workflowPath = join(root, ".github/workflows/version-readiness.yml");
	const workflow = await readFile(workflowPath, "utf8");
	await writeFile(
		workflowPath,
		workflow
			.replace("if: failure()", "if: always()")
			.replace("retention-days: 14", "retention-days: 30"),
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assert.ok(
		failures.some((failure) =>
			/upload all 1 standard diagnostics with if: failure/.test(failure),
		),
	);
	assert.ok(failures.some((failure) => /14-day retention/.test(failure)));
});

test("CI diagnostics repository contract rejects work-directory uploads and pnpm-hosted wrappers", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const workflowPath = join(root, ".github/workflows/version-readiness.yml");
	const workflow = await readFile(workflowPath, "utf8");
	await writeFile(
		workflowPath,
		workflow
			.replace(
				`path: \${{ steps.diagnostics-init.outputs.upload-dir }}`,
				`path: \${{ env.CI_DIAGNOSTIC_DIR }}`,
			)
			.replace(
				"run: node scripts/ci-diagnostics/run-command.mjs",
				"run: pnpm exec node scripts/ci-diagnostics/run-command.mjs",
			),
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assertFailure({ failures }, /isolated upload directory/);
	assertFailure(
		{ failures },
		/start the CI diagnostics wrapper directly with node/,
	);
});

test("CI diagnostics repository contract rejects persisted checkout credentials and missing Action ids", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const workflowPath = join(root, ".github/workflows/version-readiness.yml");
	const workflow = await readFile(workflowPath, "utf8");
	await writeFile(
		workflowPath,
		workflow
			.replace("          persist-credentials: false\n", "")
			.replace("        id: setup\n", ""),
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assertFailure({ failures }, /disable persisted credentials/);
	assertFailure({ failures }, /stable setup ids/);
});

test("CI diagnostics repository contract rejects missing bounded reads, child environment policy, and upload materialization", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const filesystemPath = join(root, "scripts/ci-diagnostics/filesystem.mjs");
	await writeFile(
		filesystemPath,
		(await readFile(filesystemPath, "utf8")).replace(
			"export async function readBoundedRegularFile",
			"async function unsafeRead",
		),
	);
	const runCommandPath = join(root, "scripts/ci-diagnostics/run-command.mjs");
	await writeFile(
		runCommandPath,
		(await readFile(runCommandPath, "utf8")).replace(
			"CHILD_ENV_DENYLIST",
			"REMOVED_CHILD_POLICY",
		),
	);
	const finalizerPath = join(root, "scripts/ci-diagnostics/finalize-job.mjs");
	await writeFile(
		finalizerPath,
		(await readFile(finalizerPath, "utf8")).replaceAll(
			"materializeUploadDirectory",
			"unsafeUploadDirectory",
		),
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assertFailure({ failures }, /bounded file reader is missing/);
	assertFailure({ failures }, /child environment policy is missing/);
	assertFailure({ failures }, /upload materialization is missing/);
});

test("CI diagnostics repository contract rejects gate and matrix shrinkage", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const qualityPath = join(root, ".github/workflows/quality.yml");
	await writeFile(
		qualityPath,
		(await readFile(qualityPath, "utf8")).replace(
			"pnpm typecheck --concurrency=1",
			"pnpm typecheck",
		),
	);
	const a1Path = join(root, ".github/workflows/a1-cross-platform.yml");
	await writeFile(
		a1Path,
		(await readFile(a1Path, "utf8")).replace(", windows-latest", ""),
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assert.ok(
		failures.some((failure) =>
			/removed gate command: pnpm typecheck --concurrency=1/.test(failure),
		),
	);
	assert.ok(
		failures.some((failure) =>
			/A1 diagnostics integration removed contract: os:/.test(failure),
		),
	);
});

test("CI diagnostics repository contract rejects Version Packages integration", async (t) => {
	const root = await createCiDiagnosticsContractFixture(t);
	const workflowPath = join(root, ".github/workflows/version-packages.yml");
	await writeFile(
		workflowPath,
		`${await readFile(workflowPath, "utf8")}\n# ci-diagnostics\n`,
	);
	const failures = await auditCiDiagnosticsContracts(root);
	assert.ok(
		failures.some((failure) =>
			/Version Packages must remain outside CI diagnostics/.test(failure),
		),
	);
});

test("workspace parser accepts only quoted package entries", () => {
	assert.deepEqual(
		parseWorkspacePatterns(`packages:
  - 'packages/*'
  - "e2e/*"
`),
		["packages/*", "e2e/*"],
	);
});

test("Skill metadata parsers enforce the documented repository subset", () => {
	assert.deepEqual(
		parseSkillFrontmatter(`---
name: fix-example
description: Use when a sufficiently specific example workflow needs focused validation and repair without unrelated changes.
---

# Fix example
`),
		{
			name: "fix-example",
			description:
				"Use when a sufficiently specific example workflow needs focused validation and repair without unrelated changes.",
		},
	);
	assert.deepEqual(
		parseOpenAiSkillYaml(`interface:
  display_name: "Fix Example"
  short_description: "Diagnose and repair one example workflow"
  default_prompt: "Use $fix-example to repair the example."
  icon_small: "./assets/icon-small.svg"
  icon_large: "./assets/icon-large.png"
  brand_color: "#A1B2C3"
dependencies:
  tools:
    - type: "mcp"
      value: "example"
      description: "Example MCP server"
      transport: "stdio"
`),
		{
			display_name: "Fix Example",
			short_description: "Diagnose and repair one example workflow",
			default_prompt: "Use $fix-example to repair the example.",
			icon_small: "./assets/icon-small.svg",
			icon_large: "./assets/icon-large.png",
			brand_color: "#A1B2C3",
			dependencies: {
				tools: [
					{
						type: "mcp",
						value: "example",
						description: "Example MCP server",
						transport: "stdio",
					},
				],
			},
		},
	);
	assert.throws(
		() =>
			parseSkillFrontmatter(`---
name: fix-example
description: Duplicate keys are invalid.
name: other
---
`),
		/duplicate frontmatter key/,
	);
	assert.throws(
		() =>
			parseOpenAiSkillYaml(`interface:
  display_name: Fix Example
`),
		/values must be double-quoted/,
	);
	assert.throws(
		() =>
			parseOpenAiSkillYaml(`interface:
  display_name: "Fix Example"
  display_name: "Duplicate"
  short_description: "Diagnose and repair one example workflow"
  default_prompt: "Use $fix-example to repair the example."
`),
		/duplicate agents\/openai\.yaml key/,
	);
	assert.throws(
		() =>
			parseOpenAiSkillYaml(`interface:
  display_name: "Fix Example"
  short_description: "Diagnose and repair one example workflow"
  default_prompt: "Use $fix-example to repair the example."
  future_field: "ignored"
`),
		/unsupported agents\/openai\.yaml interface field future_field; supported fields:/,
	);
});

test("Git-tracked AGENTS are discovered dynamically, sorted, and separated from untracked files", async (t) => {
	const root = await createContractFixture(t);
	await writeFixtureFile(root, "packages/zeta/AGENTS.md", "# zeta\n");
	await writeFixtureFile(root, "packages/alpha/AGENTS.md", "# alpha\n");
	await git(
		root,
		"add",
		"--",
		"packages/zeta/AGENTS.md",
		"packages/alpha/AGENTS.md",
	);
	await writeFixtureFile(root, "packages/local/AGENTS.md", "# untracked\n");

	const discovered = await discoverAgentDocuments(root);
	assert.deepEqual(discovered, [...discovered].sort());
	assert.ok(discovered.includes("packages/alpha/AGENTS.md"));
	assert.ok(discovered.includes("packages/zeta/AGENTS.md"));
	assert.ok(!discovered.includes("packages/local/AGENTS.md"));

	const result = await auditAgentAndSkillContracts(root);
	assert.deepEqual(result.failures, []);
	assert.deepEqual(result.agents, discovered);
});

test("required AGENTS remain mandatory even when Git discovery is dynamic", async (t) => {
	const root = await createContractFixture(t);
	await rm(join(root, "packages/core/AGENTS.md"));
	const result = await auditAgentAndSkillContracts(root);
	assertFailure(
		result,
		/missing required Agent instruction packages\/core\/AGENTS\.md/,
	);
});

test("repository references reject escapes, malformed URI encodings, and untracked files", async (t) => {
	const root = await createContractFixture(t);
	await writeFixtureFile(root, "docs/untracked.md", "# local only\n");
	await writeFixtureFile(
		root,
		"AGENTS.md",
		`# references

[escape](../../outside.md)
[malformed](docs/%ZZ.md)
[untracked](docs/untracked.md)
[windows](C:\\outside.md)
[unc](//server/share.md)
`,
	);
	await git(root, "add", "--", "AGENTS.md");

	const result = await auditAgentAndSkillContracts(root);
	assertFailure(
		result,
		/reference escapes repository boundary: \.\.\/\.\.\/outside\.md/,
	);
	assertFailure(
		result,
		/malformed percent encoding in reference docs\/%ZZ\.md/,
	);
	assertFailure(
		result,
		/references path not tracked by Git: docs\/untracked\.md/,
	);
	assertFailure(
		result,
		/reference escapes repository boundary: C:\\outside\.md/,
	);
	assertFailure(
		result,
		/reference escapes repository boundary: \/\/server\/share\.md/,
	);
});

test("repository references reject symlinks that leave the repository", async (t) => {
	const root = await createContractFixture(t);
	const outside = join(dirname(root), `${basename(root)}-outside.md`);
	t.after(async () => {
		await rm(outside, { force: true });
	});
	await writeFile(outside, "# outside\n");
	await mkdir(join(root, "docs"), { recursive: true });
	try {
		await symlink(outside, join(root, "docs/escape.md"));
	} catch (error) {
		if (error.code === "EPERM") {
			t.skip("symlink creation is not permitted on this platform");
			return;
		}
		throw error;
	}
	await writeFixtureFile(root, "AGENTS.md", "[escape](docs/escape.md)\n");
	await git(root, "add", "--", "AGENTS.md", "docs/escape.md");

	const result = await auditAgentAndSkillContracts(root);
	assertFailure(
		result,
		/reference must not traverse a symlink: docs\/escape\.md/,
	);
});

test("legal relative links, anchors, and tracked glob prefixes pass while missing prefixes fail", async (t) => {
	const root = await createContractFixture(t);
	await writeFixtureFile(root, "docs/valid.md", "# valid\n");
	await writeFixtureFile(
		root,
		"AGENTS.md",
		`# references

[valid](docs/valid.md#heading)
[anchor](#heading)

\`packages/example-*\`
`,
	);
	await git(root, "add", "--", "AGENTS.md", "docs/valid.md");
	let result = await auditAgentAndSkillContracts(root);
	assert.deepEqual(result.failures, []);

	await writeFixtureFile(
		root,
		"AGENTS.md",
		`${await readFile(join(root, "AGENTS.md"), "utf8")}\n\`docs/missing/*\`\n`,
	);
	await git(root, "add", "--", "AGENTS.md");
	result = await auditAgentAndSkillContracts(root);
	assertFailure(result, /references missing path docs\/missing\/\*/);
});

test("Skill entrypoints, names, duplicate names, and interfaces fail with specific diagnostics", async (t) => {
	const missingInterfaceRoot = await createContractFixture(t);
	await rm(
		join(missingInterfaceRoot, ".agents/skills/example/agents/openai.yaml"),
	);
	let result = await auditAgentAndSkillContracts(missingInterfaceRoot);
	assertFailure(
		result,
		/missing Skill interface .*example\/agents\/openai\.yaml/,
	);

	const mismatchRoot = await createContractFixture(t);
	await writeFixtureFile(
		mismatchRoot,
		".agents/skills/example/SKILL.md",
		skillContents("other"),
	);
	await git(mismatchRoot, "add", "--", ".agents/skills/example/SKILL.md");
	result = await auditAgentAndSkillContracts(mismatchRoot);
	assertFailure(result, /name other must match directory example/);

	const duplicateRoot = await createContractFixture(t);
	await writeFixtureFile(
		duplicateRoot,
		".agents/skills/other/SKILL.md",
		skillContents("example"),
	);
	await writeFixtureFile(
		duplicateRoot,
		".agents/skills/other/agents/openai.yaml",
		skillInterface("other"),
	);
	await git(duplicateRoot, "add", "--", ".agents/skills/other");
	result = await auditAgentAndSkillContracts(duplicateRoot);
	assertFailure(result, /duplicate Skill name example/);
});

test("Skill commands and repository references must resolve to tracked contract inputs", async (t) => {
	const root = await createContractFixture(t);
	await writeFixtureFile(root, "references/local.md", "# untracked\n");
	await writeFixtureFile(root, "scripts/local.mjs", "export {};\n");
	await writeFixtureFile(
		root,
		".agents/skills/example/SKILL.md",
		skillContents(
			"example",
			`[local reference](../../../references/local.md)

\`scripts/local.mjs\`

\`\`\`sh
pnpm missing-script
\`\`\`
`,
		),
	);
	await git(root, "add", "--", ".agents/skills/example/SKILL.md");

	const result = await auditAgentAndSkillContracts(root);
	assertFailure(result, /names missing root script missing-script/);
	assertFailure(
		result,
		/references path not tracked by Git: \.\.\/\.\.\/\.\.\/references\/local\.md/,
	);
	assertFailure(
		result,
		/references path not tracked by Git: scripts\/local\.mjs/,
	);
});

test("Git-tracked SKILL.md mirrors outside the authoritative root fail", async (t) => {
	const root = await createContractFixture(t);
	await writeFixtureFile(root, "vendor/SKILL.md", skillContents("vendor"));
	await git(root, "add", "--", "vendor/SKILL.md");
	const result = await auditAgentAndSkillContracts(root);
	assertFailure(
		result,
		/tracked Skill mirror outside \.agents\/skills: vendor\/SKILL\.md/,
	);
});

test("Git discovery failures are reported without a filesystem-scan fallback", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-no-git-"));
	t.after(async () => {
		await rm(root, { recursive: true, force: true });
	});
	await writeFixtureFile(
		root,
		"package.json",
		'{"name":"not-a-repository","private":true}\n',
	);
	const result = await auditAgentAndSkillContracts(root);
	assertFailure(
		result,
		/unable to discover Git-tracked Agent and Skill files:/,
	);
	assert.deepEqual(result.agents, []);
	assert.deepEqual(result.skills, []);
});
