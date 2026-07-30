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
	EXPECTED_SKILL_ROLES,
	parseOpenAiSkillYaml,
	parseSkillRoutingTable,
	parseSkillFrontmatter,
	parseWorkspacePatterns,
	REQUIRED_AGENT_DOCUMENTS,
	REQUIRED_SKILLS,
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

function implementationSkillContents() {
	return readFile(
		join(repositoryRoot, ".agents/skills/implement-and-review/SKILL.md"),
		"utf8",
	);
}

function roleLabel(role) {
	return {
		"general-primary": "Primary",
		"specialized-primary": "Specialized primary",
		"domain-support": "Support",
		"validation-helper": "Validation helper",
	}[role];
}

function routingRow(name, role, task = `${name} task`) {
	return `| ${task} | ${roleLabel(role)}: \`.agents/skills/${name}/SKILL.md\` |`;
}

function rootAgentContents() {
	const routes = [...EXPECTED_SKILL_ROLES].map(
		([name, role]) => routingRow(name, role),
	);
	return `# AGENTS

## Skill routing

| Task | Primary or supporting Skill |
| --- | --- |
${routes.join("\n")}

## Definition of done

### All tasks

- Re-read the request and report external operations.

### Read-only tasks

- Do not modify files.
- Finding a P1 does not grant automatic repair authorization.

### Write tasks

- Record the task base with \`git rev-parse HEAD\`.
- Review the task-base-to-current tree and task-base-to-HEAD diff.
`;
}

function architectureContents() {
	const roles = [...EXPECTED_SKILL_ROLES].map(
		([name, role]) => `| \`${name}\` | ${role} |`,
	);
	return `# Architecture

## Contract-verified Skill roles

Tracked Skill count: \`${EXPECTED_SKILL_ROLES.size}\`.

| Skill | Contract role |
| --- | --- |
${roles.join("\n")}
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
	for (const skillName of EXPECTED_SKILL_ROLES.keys()) {
		await writeFixtureFile(
			root,
			`.agents/skills/${skillName}/SKILL.md`,
			skillName === "implement-and-review"
				? await implementationSkillContents()
				: skillContents(skillName),
		);
		await writeFixtureFile(
			root,
			`.agents/skills/${skillName}/agents/openai.yaml`,
			skillInterface(skillName),
		);
	}
	await writeFixtureFile(root, "AGENTS.md", rootAgentContents());
	await writeFixtureFile(
		root,
		"docs/agents/agents-and-skills-architecture.md",
		architectureContents(),
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

async function mutateTrackedFixture(root, relativePath, mutate) {
	const path = join(root, relativePath);
	await writeFile(path, mutate(await readFile(path, "utf8")));
	await git(root, "add", "--", relativePath);
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
	assert.ok(result.skills.includes("implement-and-review"));
	assert.deepEqual(REQUIRED_SKILLS, ["implement-and-review"]);
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

test("Skill routing parser accepts only the repository two-column role format", () => {
	const routes = parseSkillRoutingTable(rootAgentContents());
	assert.equal(routes.length, EXPECTED_SKILL_ROLES.size);
	assert.deepEqual(routes[0], {
		task: "implement-and-review task",
		role: "general-primary",
		roleLabel: "Primary",
		skillPath: ".agents/skills/implement-and-review/SKILL.md",
		skillName: "implement-and-review",
	});
	assert.throws(
		() =>
			parseSkillRoutingTable(
				rootAgentContents().replace("## Skill routing", "## Other routing"),
			),
		/missing ## Skill routing section/,
	);
	assert.throws(
		() =>
			parseSkillRoutingTable(
				rootAgentContents().replace(
					"| Task | Primary or supporting Skill |",
					"| Request | Skill |",
				),
			),
		/must use the header "Task \| Primary or supporting Skill"/,
	);
	assert.throws(
		() =>
			parseSkillRoutingTable(
				rootAgentContents().replace(
					"Support: `.agents/skills/add-cli-command/SKILL.md`",
					"support: `.agents/skills/add-cli-command/SKILL.md`",
				),
			),
		/invalid role or Skill path/,
	);
	assert.throws(
		() =>
			parseSkillRoutingTable(
				rootAgentContents().replace(
					"Support: `.agents/skills/add-cli-command/SKILL.md`",
					"Support: `.agents/skills/add-cli-command/SKILL.md` and `.agents/skills/add-mcp-tool/SKILL.md`",
				),
		),
		/must reference exactly one Skill path/,
	);
	assert.throws(
		() =>
			parseSkillRoutingTable(
				rootAgentContents().replace(
					".agents/skills/add-cli-command/SKILL.md",
					".agents/skills/../SKILL.md",
				),
			),
		/invalid role or Skill path/,
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
		`${await readFile(join(root, "AGENTS.md"), "utf8")}

# references

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
		join(
			missingInterfaceRoot,
			".agents/skills/add-cli-command/agents/openai.yaml",
		),
	);
	let result = await auditAgentAndSkillContracts(missingInterfaceRoot);
	assertFailure(
		result,
		/missing Skill interface .*add-cli-command\/agents\/openai\.yaml/,
	);

	const mismatchRoot = await createContractFixture(t);
	await writeFixtureFile(
		mismatchRoot,
		".agents/skills/add-cli-command/SKILL.md",
		skillContents("other"),
	);
	await git(mismatchRoot, "add", "--", ".agents/skills/add-cli-command/SKILL.md");
	result = await auditAgentAndSkillContracts(mismatchRoot);
	assertFailure(result, /name other must match directory add-cli-command/);

	const duplicateRoot = await createContractFixture(t);
	await writeFixtureFile(
		duplicateRoot,
		".agents/skills/other/SKILL.md",
		skillContents("add-cli-command"),
	);
	await writeFixtureFile(
		duplicateRoot,
		".agents/skills/other/agents/openai.yaml",
		skillInterface("other"),
	);
	await git(duplicateRoot, "add", "--", ".agents/skills/other");
	result = await auditAgentAndSkillContracts(duplicateRoot);
	assertFailure(result, /duplicate Skill name add-cli-command/);
});

test("implementation orchestration lifecycle and routing are mandatory and unique", async (t) => {
	const missingRequiredRoot = await createContractFixture(t);
	await git(
		missingRequiredRoot,
		"rm",
		"--cached",
		"-r",
		"--",
		".agents/skills/implement-and-review",
	);
	await rm(
		join(missingRequiredRoot, ".agents/skills/implement-and-review"),
		{ recursive: true, force: true },
	);
	let result = await auditAgentAndSkillContracts(missingRequiredRoot);
	assertFailure(
		result,
		/missing required repository Skill implement-and-review/,
	);

	const missingLifecycleRoot = await createContractFixture(t);
	await writeFixtureFile(
		missingLifecycleRoot,
		".agents/skills/implement-and-review/SKILL.md",
		skillContents("implement-and-review", "## Primary orchestrator\n"),
	);
	await git(
		missingLifecycleRoot,
		"add",
		"--",
		".agents/skills/implement-and-review/SKILL.md",
	);
	result = await auditAgentAndSkillContracts(missingLifecycleRoot);
	assertFailure(
		result,
		/implement-and-review is missing required lifecycle marker ## 1\. Rule discovery/,
	);

	const duplicatePrimaryRoot = await createContractFixture(t);
	await writeFixtureFile(
		duplicatePrimaryRoot,
		".agents/skills/add-cli-command/SKILL.md",
		skillContents("add-cli-command", "## Primary orchestrator\n"),
	);
	await git(
		duplicatePrimaryRoot,
		"add",
		"--",
		".agents/skills/add-cli-command/SKILL.md",
	);
	result = await auditAgentAndSkillContracts(duplicatePrimaryRoot);
	assertFailure(
		result,
		/add-cli-command must not use the formal ## Primary orchestrator heading/,
	);

	const missingRouteRoot = await createContractFixture(t);
	const rootAgent = await readFile(join(missingRouteRoot, "AGENTS.md"), "utf8");
	await writeFixtureFile(
		missingRouteRoot,
		"AGENTS.md",
		rootAgent.replace(
			"| add-cli-command task | Support: `.agents/skills/add-cli-command/SKILL.md` |\n",
			"",
		),
	);
	await git(missingRouteRoot, "add", "--", "AGENTS.md");
	result = await auditAgentAndSkillContracts(missingRouteRoot);
	assertFailure(
		result,
		/AGENTS\.md Skill routing must include add-cli-command exactly once, found 0/,
	);
});

test("implementation lifecycle rejects unsafe discovery and incomplete task-base review", async (t) => {
	const cases = [
		{
			mutate: (contents) =>
				contents.replace(
					"git ls-files '*AGENTS.md'",
					"find .. -name AGENTS.md -print",
				),
			failure: /must not discover Agent rules with a parent-directory find/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"If Git discovery fails, report a blocker.",
					"If rule discovery fails, continue carefully.",
				),
			failure: /block on Git discovery failure without a filesystem fallback/,
		},
		{
			mutate: (contents) =>
				contents
					.replaceAll("task base", "starting point")
					.replaceAll("task-base", "starting-point"),
			failure: /must record an immutable task base/,
		},
		{
			mutate: (contents) =>
				contents.replaceAll("git rev-parse HEAD", "git show HEAD"),
			failure: /record the task base with git rev-parse HEAD/,
		},
		{
			mutate: (contents) =>
				contents.replace('git diff "$TASK_BASE_SHA"\n', "git diff\n"),
			failure: /missing required task-base diff command git diff "\$TASK_BASE_SHA"/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					'git diff "$TASK_BASE_SHA"..HEAD',
					"git diff HEAD",
				),
			failure: /missing required task-base diff command git diff "\$TASK_BASE_SHA"\.\.HEAD/,
		},
		{
			mutate: (contents) =>
				contents
					.replace("After a commit", "After implementation")
					.replace("clean post-commit", "clean final"),
			failure: /require complete diff review after a commit/,
		},
		{
			mutate: (contents) =>
				contents.replaceAll(
					"git branch --show-current",
					"git symbolic-ref --short HEAD",
				),
			failure: /missing final Git state command git branch --show-current/,
		},
	];
	for (const contractCase of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(
			root,
			".agents/skills/implement-and-review/SKILL.md",
			contractCase.mutate,
		);
		assertFailure(
			await auditAgentAndSkillContracts(root),
			contractCase.failure,
		);
	}
});

test("root Definition of done distinguishes all, read-only, and write tasks", async (t) => {
	const cases = [
		{
			mutate: (contents) => contents.replace("### All tasks", "### Every task"),
			failure: /Definition of done is missing ### All tasks/,
		},
		{
			mutate: (contents) =>
				contents.replace("### Read-only tasks", "### Analysis tasks"),
			failure: /Definition of done is missing ### Read-only tasks/,
		},
		{
			mutate: (contents) =>
				contents.replace("### Write tasks", "### Implementation tasks"),
			failure: /Definition of done is missing ### Write tasks/,
		},
		{
			mutate: (contents) =>
				contents.replace("Do not modify files.", "Modify files when useful."),
			failure: /read-only tasks must prohibit file writes/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"does not grant automatic repair authorization",
					"grants automatic repair authorization",
				),
			failure: /must not grant automatic repair authorization/,
		},
		{
			mutate: (contents) =>
				contents.replace("task-base-to-HEAD", "current HEAD"),
			failure: /write tasks must require task-base-to-current and task-base-to-HEAD review/,
		},
	];
	for (const contractCase of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(root, "AGENTS.md", contractCase.mutate);
		assertFailure(
			await auditAgentAndSkillContracts(root),
			contractCase.failure,
		);
	}
});

test("Skill routing audit rejects missing, duplicate, unknown, untracked, and prose-only routes", async (t) => {
	const missingRoot = await createContractFixture(t);
	await mutateTrackedFixture(missingRoot, "AGENTS.md", (contents) =>
		contents.replace("## Skill routing", "## Workflow routing"),
	);
	assertFailure(
		await auditAgentAndSkillContracts(missingRoot),
		/missing ## Skill routing section/,
	);

	const brokenHeaderRoot = await createContractFixture(t);
	await mutateTrackedFixture(brokenHeaderRoot, "AGENTS.md", (contents) =>
		contents.replace(
			"| Task | Primary or supporting Skill |",
			"| Request | Workflow |",
		),
	);
	assertFailure(
		await auditAgentAndSkillContracts(brokenHeaderRoot),
		/must use the header "Task \| Primary or supporting Skill"/,
	);

	const duplicateRoot = await createContractFixture(t);
	await mutateTrackedFixture(duplicateRoot, "AGENTS.md", (contents) =>
		contents.replace(
			"\n\n## Definition of done",
			`\n${routingRow("add-cli-command", "domain-support", "duplicate CLI task")}\n\n## Definition of done`,
		),
	);
	assertFailure(
		await auditAgentAndSkillContracts(duplicateRoot),
		/must include add-cli-command exactly once, found 2/,
	);

	const proseOnlyRoot = await createContractFixture(t);
	await mutateTrackedFixture(proseOnlyRoot, "AGENTS.md", (contents) =>
		`${contents.replace(`${routingRow("add-cli-command", "domain-support")}\n`, "")}

The Skill \`.agents/skills/add-cli-command/SKILL.md\` is discussed here.
`,
	);
	assertFailure(
		await auditAgentAndSkillContracts(proseOnlyRoot),
		/must include add-cli-command exactly once, found 0/,
	);

	const unknownRoot = await createContractFixture(t);
	await mutateTrackedFixture(unknownRoot, "AGENTS.md", (contents) =>
		contents.replace(
			"\n\n## Definition of done",
			`\n${routingRow("unknown", "domain-support")}\n\n## Definition of done`,
		),
	);
	assertFailure(
		await auditAgentAndSkillContracts(unknownRoot),
		/references unknown or untracked Skill .*unknown\/SKILL\.md/,
	);

	const untrackedRoot = await createContractFixture(t);
	await writeFixtureFile(
		untrackedRoot,
		".agents/skills/local-only/SKILL.md",
		skillContents("local-only"),
	);
	await mutateTrackedFixture(untrackedRoot, "AGENTS.md", (contents) =>
		contents.replace(
			"\n\n## Definition of done",
			`\n${routingRow("local-only", "domain-support")}\n\n## Definition of done`,
		),
	);
	assertFailure(
		await auditAgentAndSkillContracts(untrackedRoot),
		/references unknown or untracked Skill .*local-only\/SKILL\.md/,
	);
});

test("Skill routing audit enforces every explicit role", async (t) => {
	const cases = [
		{
			name: "implement-and-review",
			from: "Primary",
			to: "Support",
			failure: /role for implement-and-review must be general-primary, found domain-support/,
		},
		{
			name: "fix-github-actions",
			from: "Specialized primary",
			to: "Support",
			failure: /role for fix-github-actions must be specialized-primary, found domain-support/,
		},
		{
			name: "release-monorepo",
			from: "Specialized primary",
			to: "Primary",
			failure: /role for release-monorepo must be specialized-primary, found general-primary/,
		},
		{
			name: "run-codegen-tests",
			from: "Validation helper",
			to: "Specialized primary",
			failure: /role for run-codegen-tests must be validation-helper, found specialized-primary/,
		},
		{
			name: "add-mcp-tool",
			from: "Support",
			to: "Primary",
			failure: /role for add-mcp-tool must be domain-support, found general-primary/,
		},
	];
	for (const contractCase of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(root, "AGENTS.md", (contents) =>
			contents.replace(
				`${contractCase.from}: \`.agents/skills/${contractCase.name}/SKILL.md\``,
				`${contractCase.to}: \`.agents/skills/${contractCase.name}/SKILL.md\``,
			),
		);
		assertFailure(
			await auditAgentAndSkillContracts(root),
			contractCase.failure,
		);
	}
});

test("Skill role mapping is independent of prose and covers exactly tracked Skills", async (t) => {
	const proseRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		proseRoot,
		".agents/skills/add-cli-command/SKILL.md",
		(contents) =>
			`${contents}\nThis support Skill may discuss the phrase Primary orchestrator without changing its role.\n`,
	);
	assert.deepEqual(
		(await auditAgentAndSkillContracts(proseRoot)).failures,
		[],
	);

	const missingHeadingRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		missingHeadingRoot,
		".agents/skills/implement-and-review/SKILL.md",
		(contents) =>
			contents.replace("## Primary orchestrator", "## General workflow"),
	);
	assertFailure(
		await auditAgentAndSkillContracts(missingHeadingRoot),
		/missing required lifecycle marker ## Primary orchestrator/,
	);

	const unmappedTrackedRoot = await createContractFixture(t);
	await writeFixtureFile(
		unmappedTrackedRoot,
		".agents/skills/new-domain/SKILL.md",
		skillContents("new-domain"),
	);
	await writeFixtureFile(
		unmappedTrackedRoot,
		".agents/skills/new-domain/agents/openai.yaml",
		skillInterface("new-domain"),
	);
	await git(unmappedTrackedRoot, "add", "--", ".agents/skills/new-domain");
	assertFailure(
		await auditAgentAndSkillContracts(unmappedTrackedRoot),
		/EXPECTED_SKILL_ROLES is missing tracked Skill new-domain/,
	);

	const nonexistentMappedRoot = await createContractFixture(t);
	await git(
		nonexistentMappedRoot,
		"rm",
		"--cached",
		"-r",
		"--",
		".agents/skills/release-monorepo",
	);
	await rm(join(nonexistentMappedRoot, ".agents/skills/release-monorepo"), {
		recursive: true,
		force: true,
	});
	assertFailure(
		await auditAgentAndSkillContracts(nonexistentMappedRoot),
		/EXPECTED_SKILL_ROLES contains nonexistent Skill release-monorepo/,
	);
});

test("architecture role inventory stays aligned with tracked Skills and routing guarantees", async (t) => {
	const countRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		countRoot,
		"docs/agents/agents-and-skills-architecture.md",
		(contents) => contents.replace("Tracked Skill count: `10`.", "Tracked Skill count: `9`."),
	);
	assertFailure(
		await auditAgentAndSkillContracts(countRoot),
		/tracked Skill count must equal 10/,
	);

	const roleRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		roleRoot,
		"docs/agents/agents-and-skills-architecture.md",
		(contents) =>
			contents.replace(
				"| `run-codegen-tests` | validation-helper |",
				"| `run-codegen-tests` | specialized-primary |",
			),
	);
	assertFailure(
		await auditAgentAndSkillContracts(roleRoot),
		/role for run-codegen-tests must be validation-helper, found specialized-primary/,
	);

	const duplicateRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		duplicateRoot,
		"docs/agents/agents-and-skills-architecture.md",
		(contents) =>
			contents.replace(
				"| `run-codegen-tests` | validation-helper |",
				"| `run-codegen-tests` | validation-helper |\n| `run-codegen-tests` | validation-helper |",
			),
	);
	assertFailure(
		await auditAgentAndSkillContracts(duplicateRoot),
		/must document run-codegen-tests exactly once, found 2/,
	);
});

test("Skill commands and repository references must resolve to tracked contract inputs", async (t) => {
	const root = await createContractFixture(t);
	await writeFixtureFile(root, "references/local.md", "# untracked\n");
	await writeFixtureFile(root, "scripts/local.mjs", "export {};\n");
	await writeFixtureFile(
		root,
		".agents/skills/add-cli-command/SKILL.md",
		skillContents(
			"add-cli-command",
			`[local reference](../../../references/local.md)

\`scripts/local.mjs\`

\`\`\`sh
pnpm missing-script
\`\`\`
`,
		),
	);
	await git(root, "add", "--", ".agents/skills/add-cli-command/SKILL.md");

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
