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
	auditGitHubWorkflowContexts,
	auditPublicationContracts,
	auditRepositoryContracts,
	discoverAgentDocuments,
	EXPECTED_SKILL_ROLES,
	parseOpenAiSkillYaml,
	parseSkillFrontmatter,
	parseSkillRoutingTable,
	parseWorkspacePatterns,
	REQUIRED_AGENT_DOCUMENTS,
	REQUIRED_SKILLS,
	repositoryRoot,
} from "./repository-contract.mjs";

const execFileAsync = promisify(execFile);
const DOLLAR_SIGN = "$";

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

function consumerSkillFile(relativePath) {
	return readFile(
		join(repositoryRoot, ".agents/skills/openapi-to-generate", relativePath),
		"utf8",
	);
}

function setupSkillFile(relativePath) {
	return readFile(
		join(repositoryRoot, ".agents/skills/openapi-to-setup", relativePath),
		"utf8",
	);
}

function releaseSkillContents() {
	return `---
name: release-monorepo
description: Prepare Version Packages PRs and Changesets for RC or stable npm publication and dist-tags, Git tags, GitHub Releases, and partial-publication recovery. Use for release planning and exactly authorized manual publication; default to preparation-only without remote writes.
---

# Release

## Two-phase release state machine

This Skill defaults to preparation-only.

### Phase A: Version candidate

The Version Packages PR prepares versions and changelogs; it is not publication.

### Phase B: Publication

Require the exact expected \`main\` SHA, exact fixed-group version, \`rc\` or
\`latest\` channel, and manual publication Workflow. Use npm-production and
Trusted Publishing/OIDC, then verify every expected package version and
dist-tag before create the immutable version tag and GitHub Release.

For partial publication recovery, preserve a nonzero failure. Without exact
authorization, do not trigger the Workflow.

## Preparation workflow
`;
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
	const routes = [...EXPECTED_SKILL_ROLES].map(([name, role]) =>
		routingRow(name, role),
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

- A clean worktree preserves pre-existing changes or uses an isolated worktree.
- A combined diff must not claim agent ownership.
- Record the task base with \`git rev-parse HEAD\`.
- Review the task-base-to-current tree and task-base-to-HEAD diff.
- Run \`git ls-files --others --exclude-standard\` and read each task-created untracked text file in full.
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

## Real-task Pilot PR gate

Draft PR
local validation complete
autonomous review complete
repair P0/P1
push the latest commit
Ready for review
wait for remote required checks
human review of the PR diff
user decides whether to merge

Local \`PASS\` is not remote CI \`PASS\`.
\`Draft\` status is not completed remote acceptance.
\`REMOTE CI UNVERIFIED\`
Only the user may decide whether to merge.
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
				: skillName === "openapi-to-generate"
					? await consumerSkillFile("SKILL.md")
					: skillName === "openapi-to-setup"
						? await setupSkillFile("SKILL.md")
				: skillName === "release-monorepo"
					? releaseSkillContents()
					: skillContents(skillName),
		);
		await writeFixtureFile(
			root,
			`.agents/skills/${skillName}/agents/openai.yaml`,
			skillName === "openapi-to-generate"
				? await consumerSkillFile("agents/openai.yaml")
				: skillName === "openapi-to-setup"
					? await setupSkillFile("agents/openai.yaml")
				: skillInterface(skillName),
		);
	}
	for (const relativePath of [
		"references/mcp-workflow.md",
		"references/controlled-write.md",
		"references/evaluation-matrix.yaml",
	]) {
		await writeFixtureFile(
			root,
			`.agents/skills/openapi-to-generate/${relativePath}`,
			await consumerSkillFile(relativePath),
		);
	}
	for (const relativePath of [
		"references/diagnosis.md",
		"references/codex-setup.md",
		"references/safe-writes.md",
		"references/evaluation-matrix.yaml",
		"scripts/inspect-project.mjs",
		"scripts/hash-setup-plan.mjs",
	]) {
		await writeFixtureFile(
			root,
			`.agents/skills/openapi-to-setup/${relativePath}`,
			await setupSkillFile(relativePath),
		);
	}
	await writeFixtureFile(root, "AGENTS.md", rootAgentContents());
	await writeFixtureFile(
		root,
		"docs/agents/agents-and-skills-architecture.md",
		architectureContents(),
	);
	await writeFixtureFile(
		root,
		"docs/skills.md",
		await readFile(join(repositoryRoot, "docs/skills.md"), "utf8"),
	);
	await writeFixtureFile(
		root,
		"docs/setup-skill.md",
		await readFile(join(repositoryRoot, "docs/setup-skill.md"), "utf8"),
	);
	await writeFixtureFile(root, "scripts/known.mjs", "export {};\n");
	await git(root, "add", "--", ".");
	return root;
}

async function createPublicationContractFixture(t) {
	const root = await mkdtemp(
		join(tmpdir(), "openapi-to-publication-contract-"),
	);
	t.after(async () => {
		await rm(root, { recursive: true, force: true });
	});
	await git(root, "init", "--quiet");
	for (const relativePath of [
		".github/workflows/publish.yml",
		".github/workflows/version-packages.yml",
		".github/pull_request_template.md",
		"package.json",
		"pnpm-lock.yaml",
		"scripts/release/publication-sha-guard.mjs",
		"scripts/release/publication.mjs",
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
	const contents = await readFile(path, "utf8");
	const mutated = mutate(contents);
	assert.notEqual(
		mutated,
		contents,
		`fixture mutation must change ${relativePath}`,
	);
	await writeFile(path, mutated);
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
	assert.ok(result.skills.includes("openapi-to-generate"));
	assert.ok(result.skills.includes("openapi-to-setup"));
	assert.deepEqual(REQUIRED_SKILLS, [
		"implement-and-review",
		"openapi-to-generate",
		"openapi-to-setup",
	]);
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

test("GitHub YAML contracts reject runner context in Job env without rejecting runner-assigned contexts", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-workflow-context-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFixtureFile(
		root,
		".github/workflows/invalid.yml",
		`name: Invalid
jobs:
  build:
    env:
      CI_DIAGNOSTIC_DIR: \${{ runner.temp }}/diagnostics
      SAFE_DIR: \${{ github.workspace }}/.ci-artifacts/safe
      SAFE_TEXT: \${{ github.workspace }}/runner.temp
    steps:
      - run: echo ok
        env:
          STEP_TEMP: \${{ runner.temp }}/step
`,
	);
	await writeFixtureFile(
		root,
		".github/workflows/second.yaml",
		`name: Second invalid
jobs:
  test:
    env:
      RUNNER_HINT: \${{ runner.os }}
    steps:
      - run: echo test
`,
	);
	await writeFixtureFile(
		root,
		".github/setup/action.yml",
		`name: Setup
runs:
  using: composite
  steps:
    - shell: bash
      run: echo ok
      env:
        STEP_TEMP: \${{ runner.temp }}/composite
`,
	);

	const failures = await auditGitHubWorkflowContexts(root);
	assert.deepEqual(failures, [
		".github/workflows/invalid.yml: jobs.build.env.CI_DIAGNOSTIC_DIR must not use the runner context before a runner is assigned",
		".github/workflows/second.yaml: jobs.test.env.RUNNER_HINT must not use the runner context before a runner is assigned",
	]);
});

test("GitHub YAML contracts parse composite actions and report syntax failures", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-workflow-yaml-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFixtureFile(
		root,
		".github/actions/example/action.yaml",
		"name: Broken\nruns: [\n",
	);

	const failures = await auditGitHubWorkflowContexts(root);
	assert.equal(failures.length, 1);
	assert.match(
		failures[0],
		/^\.github\/actions\/example\/action\.yaml:\d+:\d+: invalid YAML:/,
	);
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

test("publication repository contract accepts the manual least-privilege workflow", async (t) => {
	const root = await createPublicationContractFixture(t);
	assert.deepEqual(await auditPublicationContracts(root), []);
});

test("publication contract rejects artifact transfer regressions", async (t) => {
	const cases = [
		{
			name: "missing include-hidden-files",
			mutate: (contents) =>
				contents.replace("          include-hidden-files: true\n", ""),
			failure: /include-hidden-files true/,
		},
		{
			name: "include-hidden-files false",
			mutate: (contents) =>
				contents.replace(
					"          include-hidden-files: true",
					"          include-hidden-files: false",
				),
			failure: /include-hidden-files true/,
		},
		{
			name: "include-hidden-files string",
			mutate: (contents) =>
				contents.replace(
					"          include-hidden-files: true",
					'          include-hidden-files: "true"',
				),
			failure: /include-hidden-files true/,
		},
		{
			name: "if-no-files-found warning",
			mutate: (contents) =>
				contents.replace(
					"          if-no-files-found: error",
					"          if-no-files-found: warn",
				),
			failure: /if-no-files-found error/,
		},
		{
			name: "artifact overwrite",
			mutate: (contents) =>
				contents.replace(
					"          if-no-files-found: error",
					"          overwrite: true\n          if-no-files-found: error",
				),
			failure: /must not configure overwrite/,
		},
		{
			name: "artifact overwrite string",
			mutate: (contents) =>
				contents.replace(
					"          if-no-files-found: error",
					'          overwrite: "true"\n          if-no-files-found: error',
				),
			failure: /must not configure overwrite/,
		},
		{
			name: "duplicate upload step",
			mutate: (contents) =>
				contents.replace(
					"          compression-level: 0\n",
					`          compression-level: 0

      - name: Upload an unsafe duplicate artifact
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: unsafe-duplicate
          path: .
          include-hidden-files: true
          if-no-files-found: error
`,
				),
			failure: /must upload only the controlled hidden publication artifact/,
		},
		{
			name: "artifact name omits run attempt",
			mutate: (contents) =>
				contents
					.replace(
						`          RUN_ATTEMPT: ${DOLLAR_SIGN}{{ github.run_attempt }}\n`,
						"",
					)
					.replace(
						`          printf 'name=openapi-to-publication-%s-attempt-%s\\n' \\
            "${DOLLAR_SIGN}{EXPECTED_SHA}" \\
            "${DOLLAR_SIGN}{RUN_ATTEMPT}" >> "${DOLLAR_SIGN}{GITHUB_OUTPUT}"`,
						`          printf 'name=openapi-to-publication-%s\\n' "${DOLLAR_SIGN}{EXPECTED_SHA}" >> "${DOLLAR_SIGN}{GITHUB_OUTPUT}"`,
					),
			failure: /verified expected SHA and validated github\.run_attempt/,
		},
		{
			name: "artifact name uses only expected SHA",
			mutate: (contents) =>
				contents.replace(
					"name=openapi-to-publication-%s-attempt-%s",
					"name=openapi-to-publication-%s",
				),
			failure: /verified expected SHA and validated github\.run_attempt/,
		},
		{
			name: "artifact name adds untrusted env",
			mutate: (contents) =>
				contents.replace(
					`          RUN_ATTEMPT: ${DOLLAR_SIGN}{{ github.run_attempt }}`,
					`          RUN_ATTEMPT: ${DOLLAR_SIGN}{{ github.run_attempt }}
          UNSAFE_VERSION: ${DOLLAR_SIGN}{{ inputs.expected_version }}`,
				),
			failure: /canonical output script/,
		},
		{
			name: "artifact name redirects canonical output",
			mutate: (contents) =>
				contents.replace(
					`  "${DOLLAR_SIGN}{RUN_ATTEMPT}" >> "${DOLLAR_SIGN}{GITHUB_OUTPUT}"`,
					`  "${DOLLAR_SIGN}{RUN_ATTEMPT}" >/dev/null
          printf 'name=unsafe-alternate\\n' >> "${DOLLAR_SIGN}{GITHUB_OUTPUT}"`,
				),
			failure: /canonical output script/,
		},
		{
			name: "duplicate artifact binding step",
			mutate: (contents) =>
				contents.replace(
					"      - name: Upload only the verified publication artifact\n",
					`      - name: Duplicate artifact binding
        id: artifact
        shell: bash
        run: printf 'name=unsafe-duplicate\\n' >> "${DOLLAR_SIGN}{GITHUB_OUTPUT}"

      - name: Upload only the verified publication artifact
`,
				),
			failure: /canonical output script/,
		},
		{
			name: "intervening artifact contamination step",
			mutate: (contents) =>
				contents.replace(
					"      - name: Upload only the verified publication artifact\n",
					`      - name: Contaminate the verified artifact
        run: touch .ci-artifacts/publication/unexpected

      - name: Upload only the verified publication artifact
`,
				),
			failure: /finish preflight with consecutive prepare, smoke, artifact-name/,
		},
		{
			name: "publish download uses hardcoded name",
			mutate: (contents) =>
				contents.replace(
					`          name: ${DOLLAR_SIGN}{{ needs.preflight-and-package.outputs.artifact_name }}`,
					"          name: openapi-to-publication-hardcoded",
				),
			failure: /jobs\.publish must download the upstream artifact_name/,
		},
		{
			name: "publish download recomputes name",
			mutate: (contents) =>
				contents.replace(
					`          name: ${DOLLAR_SIGN}{{ needs.preflight-and-package.outputs.artifact_name }}`,
					`          name: openapi-to-publication-${DOLLAR_SIGN}{{ needs.preflight-and-package.outputs.expected_sha }}-attempt-${DOLLAR_SIGN}{{ github.run_attempt }}`,
				),
			failure: /jobs\.publish must download the upstream artifact_name/,
		},
		{
			name: "publish download selects a different run",
			mutate: (contents) =>
				contents.replace(
					`          name: ${DOLLAR_SIGN}{{ needs.preflight-and-package.outputs.artifact_name }}
          path: .ci-artifacts/publication`,
					`          name: ${DOLLAR_SIGN}{{ needs.preflight-and-package.outputs.artifact_name }}
          path: .ci-artifacts/publication
          repository: other/repository
          run-id: 12345`,
				),
			failure: /jobs\.publish must download the upstream artifact_name/,
		},
		{
			name: "extra uncontrolled download",
			mutate: (contents) =>
				contents.replace(
					"      - name: Bind immutable artifact name\n",
					`      - name: Download an uncontrolled artifact
        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093
        with:
          name: uncontrolled
          path: .ci-artifacts/publication

      - name: Bind immutable artifact name
`,
				),
			failure: /exactly one controlled publication download/,
		},
		{
			name: "upload path expands to artifact root",
			mutate: (contents) =>
				contents.replace(
					"          path: .ci-artifacts/publication\n          include-hidden-files: true",
					"          path: .ci-artifacts\n          include-hidden-files: true",
				),
			failure: /controlled hidden publication artifact/,
		},
		{
			name: "upload path expands to repository root",
			mutate: (contents) =>
				contents.replace(
					"          path: .ci-artifacts/publication\n          include-hidden-files: true",
					"          path: .\n          include-hidden-files: true",
				),
			failure: /controlled hidden publication artifact/,
		},
		{
			name: "artifact job output removed",
			mutate: (contents) =>
				contents.replace(
					`      artifact_name: ${DOLLAR_SIGN}{{ steps.artifact.outputs.name }}\n`,
					"",
				),
			failure: /outputs\.artifact_name must come from steps\.artifact\.outputs\.name/,
		},
		{
			name: "run attempt replaced by user input",
			mutate: (contents) =>
				contents.replace(
					`          RUN_ATTEMPT: ${DOLLAR_SIGN}{{ github.run_attempt }}`,
					`          RUN_ATTEMPT: ${DOLLAR_SIGN}{{ inputs.expected_version }}`,
				),
			failure: /verified expected SHA and validated github\.run_attempt/,
		},
	];
	for (const fixture of cases) {
		await t.test(fixture.name, async (t) => {
			const root = await createPublicationContractFixture(t);
			await mutateTrackedFixture(
				root,
				".github/workflows/publish.yml",
				fixture.mutate,
			);
			assertFailure(
				{ failures: await auditPublicationContracts(root) },
				fixture.failure,
			);
		});
	}
});

test("publication contract rejects trigger, concurrency, permission, and dependency drift", async (t) => {
	const cases = [
		{
			path: ".github/workflows/publish.yml",
			mutate: (contents) =>
				contents.replace(
					"on:\n  workflow_dispatch:",
					"on:\n  push:\n  workflow_dispatch:",
				),
			failure: /only trigger/,
		},
		{
			path: ".github/workflows/publish.yml",
			mutate: (contents) =>
				contents.replace(
					"group: publish-openapi-to-fixed-group",
					`group: publish-openapi-to-fixed-group-${DOLLAR_SIGN}{{ inputs.channel }}`,
				),
			failure: /fixed-group publication lock|must not vary/,
		},
		{
			path: ".github/workflows/publish.yml",
			mutate: (contents) =>
				contents.replace(
					"concurrency:\n  group: publish-openapi-to-fixed-group\n  cancel-in-progress: false\n\n",
					"",
				),
			failure: /fixed-group publication lock/,
		},
		{
			path: ".github/workflows/publish.yml",
			mutate: (contents) =>
				contents.replace(
					"cancel-in-progress: false",
					"cancel-in-progress: true",
				),
			failure: /cancel-in-progress false/,
		},
		{
			path: ".github/workflows/publish.yml",
			mutate: (contents) =>
				contents.replace(
					"    permissions:\n      contents: read\n      id-token: write",
					"    permissions:\n      contents: write\n      id-token: write",
				),
			failure: /jobs\.publish\.permissions/,
		},
		{
			path: ".github/workflows/publish.yml",
			mutate: (contents) => contents.replace("      - verify-registry\n", ""),
			failure: /depend on registry verification/,
		},
	];
	for (const fixture of cases) {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(root, fixture.path, fixture.mutate);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			fixture.failure,
		);
	}
});

test("publication contract rejects tarball pipeline and approval-time SHA regressions", async (t) => {
	const cases = [
		{
			mutate: (contents) =>
				contents.replace(
					"publication.mjs prepare-artifacts",
					"publication.mjs preflight",
				),
			failure: /artifact preparation|prepare-artifacts/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					" -- --publication-manifest .ci-artifacts/publication/publication-manifest.json",
					"",
				),
			failure: /consumer smoke must install the exact/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"git fetch --no-tags origin main",
					"git status --short",
				),
			failure: /current-main guard|missing blocking behavior/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"publication.mjs verify-artifacts",
					"publication.mjs preflight",
				),
			failure:
				/artifact verification|GitHub release is missing verified behavior/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"        id: remote-release-guard\n",
					"        id: removed-remote-release-guard\n",
				),
			failure: /remote tag\/Release compatibility|remote collision guard/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"publication.mjs publish-artifacts",
					"npm publish packages/core",
				),
			failure: /verified tarball publication|forbidden source/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"node scripts/release/publication.mjs publish-artifacts",
					"pnpm pack && node scripts/release/publication.mjs publish-artifacts",
				),
			failure: /forbidden source\/rebuild behavior pnpm pack/,
		},
	];
	for (const fixture of cases) {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			".github/workflows/publish.yml",
			fixture.mutate,
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			fixture.failure,
		);
	}
});

test("publication contract preserves the zero-dependency SHA guard", async (t) => {
	await t.test("guard file deletion", async (t) => {
		const root = await createPublicationContractFixture(t);
		await rm(join(root, "scripts/release/publication-sha-guard.mjs"));
		await git(
			root,
			"add",
			"--update",
			"--",
			"scripts/release/publication-sha-guard.mjs",
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			/missing zero-dependency guard/,
		);
	});

	await t.test("workflow reverts to publication.mjs verify-sha", async (t) => {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			".github/workflows/publish.yml",
			(contents) =>
				contents.replaceAll(
					"publication-sha-guard.mjs",
					"publication.mjs verify-sha",
				),
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			/missing blocking behavior publication-sha-guard|guard must bind|current-main guard is missing/,
		);
	});

	await t.test("dependency installation moves before the first guard", async (t) => {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			".github/workflows/publish.yml",
			(contents) =>
				contents.replace(
					'          guard="$(node scripts/release/publication-sha-guard.mjs \\\n',
					'          pnpm install --frozen-lockfile\n          guard="$(node scripts/release/publication-sha-guard.mjs \\\n',
				),
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			/dependency installation must remain after the zero-dependency SHA guard/,
		);
	});

	await t.test("approval-time guard is removed", async (t) => {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			".github/workflows/publish.yml",
			(contents) =>
				contents.replace(
					"        id: approval-sha-guard\n",
					"        id: removed-approval-sha-guard\n",
				),
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			/must revalidate current main|approval-time zero-dependency SHA guard/,
		);
	});

	await t.test("guard imports a bare package", async (t) => {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			"scripts/release/publication-sha-guard.mjs",
			(contents) => `${contents}\nimport semver from "semver";\n`,
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			/must import only Node built-in modules; found semver|forbidden dependency behavior semver/,
		);
	});

	for (const [name, appendedSource] of [
		[
			"guard uses createRequire",
			'import { createRequire } from "node:module";\nconst loadPackage = createRequire(import.meta.url);\nloadPackage("third-party");',
		],
		[
			"guard uses a variable dynamic import",
			'const packageName = "third-party";\nawait import(packageName);',
		],
	]) {
		await t.test(name, async (t) => {
			const root = await createPublicationContractFixture(t);
			await mutateTrackedFixture(
				root,
				"scripts/release/publication-sha-guard.mjs",
				(contents) => `${contents}\n${appendedSource}\n`,
			);
			assertFailure(
				{ failures: await auditPublicationContracts(root) },
				/must not use runtime module loading/,
			);
		});
	}
});

test("publication contract rejects checksum, workspace, metadata, and recovery weakening", async (t) => {
	const cases = [
		[
			"verifyPublicationArtifacts",
			"verifyUncheckedArtifacts",
			/tarball-first safety behavior verifyPublicationArtifacts/,
		],
		[
			'createHash("sha256")',
			'createHash("md5")',
			/tarball-first safety behavior createHash/,
		],
		[
			"WORKSPACE_PROTOCOL_IN_TARBALL",
			"WORKSPACE_ALLOWED",
			/tarball-first safety behavior WORKSPACE_PROTOCOL/,
		],
		[
			"EXPECTED_REPOSITORY_URL",
			"UNVERIFIED_REPOSITORY_URL",
			/tarball-first safety behavior EXPECTED_REPOSITORY_URL/,
		],
		[
			"PUBLISHED_BYTES_MISMATCH",
			"PUBLISHED_BYTES_ALLOWED",
			/tarball-first safety behavior PUBLISHED_BYTES_MISMATCH/,
		],
		[
			"REGISTRY_UNAVAILABLE",
			"REGISTRY_ASSUMED_OK",
			/tarball-first safety behavior REGISTRY_UNAVAILABLE/,
		],
		[
			"PUBLICATION_TARBALL_CHANGED",
			"PUBLICATION_TARBALL_ASSUMED_STABLE",
			/tarball-first safety behavior PUBLICATION_TARBALL_CHANGED/,
		],
		[
			"PUBLICATION_WORKTREE_DIRTY",
			"PUBLICATION_WORKTREE_ASSUMED_CLEAN",
			/tarball-first safety behavior PUBLICATION_WORKTREE_DIRTY/,
		],
	];
	for (const [from, to, failure] of cases) {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			"scripts/release/publication.mjs",
			(contents) => contents.replaceAll(from, to),
		);
		assertFailure({ failures: await auditPublicationContracts(root) }, failure);
	}
});

test("publication contract rejects bypasses, tokens, Changesets publishing, and loose toolchains", async (t) => {
	const workflowCases = [
		{
			mutate: (contents) =>
				contents.replace(
					"    environment: npm-production\n",
					`    environment: npm-production
    env:
      NPM_TOKEN: ${DOLLAR_SIGN}{{ secrets.NPM_TOKEN }}
`,
				),
			failure: /forbidden publication behavior NPM_TOKEN/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"        id: publish\n",
					"        id: publish\n        if: false\n",
				),
			failure:
				/forbidden publication behavior if: false|unconditional blocking/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"--npm-version 12.0.2",
					"--npm-version 12.0.2 || true",
				),
			failure: /forbidden publication behavior \|\| true/,
		},
		{
			mutate: (contents) =>
				contents.replace(
					"publication.mjs publish-artifacts",
					"pnpm exec changeset publish",
				),
			failure: /changeset publish/,
		},
	];
	for (const fixture of workflowCases) {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			".github/workflows/publish.yml",
			fixture.mutate,
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			fixture.failure,
		);
	}

	const packageRoot = await createPublicationContractFixture(t);
	await mutateTrackedFixture(packageRoot, "package.json", (contents) =>
		contents.replace(
			'"@changesets/cli": "2.28.1"',
			'"@changesets/cli": "^2.28.1"',
		),
	);
	assertFailure(
		{ failures: await auditPublicationContracts(packageRoot) },
		/@changesets\/cli must remain exactly pinned/,
	);

	for (const forbidden of [
		'manifest.packageManager = "npm@12.0.2"',
		"await unlink(preStatePath)",
		"runChangesetsPublish()",
	]) {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			"scripts/release/publication.mjs",
			(contents) => `${contents}\n// ${forbidden}\n`,
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			/forbidden Changesets publication behavior/,
		);
	}
});

test("publication contract rejects Version Packages publication and unpinned Actions", async (t) => {
	const versionRoot = await createPublicationContractFixture(t);
	await mutateTrackedFixture(
		versionRoot,
		".github/workflows/version-packages.yml",
		(contents) =>
			`${contents}
  forbidden-publish:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm exec changeset publish
`,
	);
	assertFailure(
		{ failures: await auditPublicationContracts(versionRoot) },
		/version-packages\.yml contains forbidden publication behavior changeset publish/,
	);

	const actionRoot = await createPublicationContractFixture(t);
	await mutateTrackedFixture(
		actionRoot,
		".github/workflows/publish.yml",
		(contents) =>
			contents.replace(
				"actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
				"actions/checkout@v6",
			),
	);
	assertFailure(
		{ failures: await auditPublicationContracts(actionRoot) },
		/high-privilege Action must use a full commit SHA/,
	);

	for (const [from, to] of [
		["--prerelease", "--draft"],
		["--latest", "--notes-start-tag"],
		["--json tagName,isPrerelease", "--json tagName"],
		["isDraft", "draftState"],
		[".name == $title", ".name != $title"],
		[".body //", ".wrongBody //"],
		["/releases/latest", "/releases"],
	]) {
		const root = await createPublicationContractFixture(t);
		await mutateTrackedFixture(
			root,
			".github/workflows/publish.yml",
			(contents) => contents.replaceAll(from, to),
		);
		assertFailure(
			{ failures: await auditPublicationContracts(root) },
			/GitHub release is missing verified behavior/,
		);
	}
});

test("Skill contracts reject removal of remote handoff and two-phase release safety", async (t) => {
	const implementationRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		implementationRoot,
		".agents/skills/implement-and-review/SKILL.md",
		(contents) =>
			contents.replaceAll("`REMOTE CI UNVERIFIED`", "`REMOTE CI UNKNOWN`"),
	);
	assertFailure(
		await auditAgentAndSkillContracts(implementationRoot),
		/missing required lifecycle marker `REMOTE CI UNVERIFIED`/,
	);

	const releaseRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		releaseRoot,
		".agents/skills/release-monorepo/SKILL.md",
		(contents) =>
			contents.replace(
				"partial publication recovery",
				"publication troubleshooting",
			),
	);
	assertFailure(
		await auditAgentAndSkillContracts(releaseRoot),
		/missing safety marker partial publication recovery/,
	);
});

test("consumer generation Skill preserves trigger, workflow, approval, and evaluation contracts", async (t) => {
	const cases = [
		{
			path: ".agents/skills/openapi-to-generate/SKILL.md",
			mutate: (contents) => contents.replace("pure frontend", "visual-only"),
			failure: /description is missing trigger boundary pure frontend/,
		},
		{
			path: ".agents/skills/openapi-to-generate/SKILL.md",
			mutate: (contents) =>
				contents.replace('"type": "operations"', '"type": "full"'),
			failure: /missing required workflow marker "type": "operations"/,
		},
		{
			path: ".agents/skills/openapi-to-generate/SKILL.md",
			mutate: (contents) =>
				contents.replace(
					/Never silently substitute a\s+global installation/,
					"Use any available installation",
				),
			failure: /missing required workflow marker Never silently substitute/,
		},
		{
			path: ".agents/skills/openapi-to-generate/SKILL.md",
			mutate: (contents) =>
				contents.replace(
					"Never automate Prepare followed by Apply",
					"Automate Prepare followed by Apply",
				),
			failure: /missing required workflow marker Never automate Prepare/,
		},
		{
			path: ".agents/skills/openapi-to-generate/SKILL.md",
			mutate: (contents) =>
				contents.replace(
					"Tool existence and Tool count do not prove",
					"Tool names and counts prove",
				),
			failure: /missing required workflow marker Tool existence and Tool count do not prove/,
		},
		{
			path: ".agents/skills/openapi-to-generate/references/mcp-workflow.md",
			mutate: (contents) =>
				contents.replace('  "targets": ["<exact-target>"],\n', ""),
			failure: /operation-scoped Dry Run JSON example 1 must pass exactly one/,
		},
		{
			path: ".agents/skills/openapi-to-generate/agents/openai.yaml",
			mutate: (contents) =>
				contents.replace(
					"Discover API operations and safely generate client code",
					"Generate API clients for consumer projects",
				),
			failure: /short_description must equal/,
		},
		{
			path: ".agents/skills/openapi-to-generate/references/evaluation-matrix.yaml",
			mutate: (contents) => {
				let replacements = 7;
				return contents.replaceAll("category: degraded", (category) => {
					if (replacements === 0) return category;
					replacements -= 1;
					return "category: reject";
				});
			},
			failure: /requires at least 4 degraded cases, found 3/,
		},
		{
			path: ".agents/skills/openapi-to-generate/references/evaluation-matrix.yaml",
			mutate: (contents) =>
				contents.replace(
					"degraded-schema-not-visible",
					"degraded-schema-hidden",
				),
			failure: /missing required case degraded-schema-not-visible/,
		},
	];
	for (const contractCase of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(root, contractCase.path, contractCase.mutate);
		assertFailure(
			await auditAgentAndSkillContracts(root),
			contractCase.failure,
		);
	}

	for (const relativePath of [
		".agents/skills/openapi-to-generate/SKILL.md",
		"docs/skills.md",
	]) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(root, relativePath, (contents) =>
			`${contents}\nLegacy: \`.OpenAPI/openapi.config.ts\`.\n`,
		);
		assertFailure(
			await auditAgentAndSkillContracts(root),
			/must not use legacy config path \.OpenAPI\/openapi\.config\.ts/,
		);
	}

	const missingReferenceRoot = await createContractFixture(t);
	await mutateTrackedFixture(
		missingReferenceRoot,
		".agents/skills/openapi-to-generate/SKILL.md",
		(contents) =>
			contents.replace(
				"references/mcp-workflow.md",
				"references/missing-workflow.md",
			),
	);
	assertFailure(
		await auditAgentAndSkillContracts(missingReferenceRoot),
		/references missing path references\/missing-workflow\.md/,
	);
});

test("consumer setup Skill preserves routing, safety, files, and evaluation contracts", async (t) => {
	const cases = [
		{
			path: ".agents/skills/openapi-to-setup/SKILL.md",
			mutate: (contents) => contents.replace("Use `read-only` when the request is ambiguous", "Use `write-enabled` when the request is ambiguous"),
			failure: /missing required workflow marker Use `read-only` when the request is ambiguous/,
		},
		{
			path: ".agents/skills/openapi-to-setup/SKILL.md",
			mutate: (contents) => contents.replace("Never choose `latest`", "Choose `latest`"),
			failure: /missing required workflow marker Never choose `latest`/,
		},
		{
			path: ".agents/skills/openapi-to-setup/SKILL.md",
			mutate: (contents) => contents.replace("re-inspect, create a new plan and ID", "reuse the old plan"),
			failure: /missing required workflow marker re-inspect, create a new plan and ID/,
		},
		{
			path: ".agents/skills/openapi-to-setup/agents/openai.yaml",
			mutate: (contents) => contents.replace("Diagnose and configure local openapi-to and Codex MCP", "Configure openapi-to"),
			failure: /short_description must equal/,
		},
		{
			path: ".agents/skills/openapi-to-setup/references/evaluation-matrix.yaml",
			mutate: (contents) => contents.replace("degraded-count-schema-mismatch", "degraded-count-only"),
			failure: /missing required case degraded-count-schema-mismatch/,
		},
	];
	for (const contractCase of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(root, contractCase.path, contractCase.mutate);
		assertFailure(await auditAgentAndSkillContracts(root), contractCase.failure);
	}

	const missingScriptRoot = await createContractFixture(t);
	await git(missingScriptRoot, "rm", "--cached", "--", ".agents/skills/openapi-to-setup/scripts/inspect-project.mjs");
	assertFailure(
		await auditAgentAndSkillContracts(missingScriptRoot),
		/setup Skill file is not tracked by Git: .*inspect-project\.mjs/,
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
	await git(
		mismatchRoot,
		"add",
		"--",
		".agents/skills/add-cli-command/SKILL.md",
	);
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
	await rm(join(missingRequiredRoot, ".agents/skills/implement-and-review"), {
		recursive: true,
		force: true,
	});
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
			failure:
				/missing required task-base diff command git diff "\$TASK_BASE_SHA"/,
		},
		{
			mutate: (contents) =>
				contents.replace('git diff "$TASK_BASE_SHA"..HEAD', "git diff HEAD"),
			failure:
				/missing required task-base diff command git diff "\$TASK_BASE_SHA"\.\.HEAD/,
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

test("implementation lifecycle enforces clean-worktree ownership boundaries", async (t) => {
	const cases = [
		[
			"A clean worktree is the default precondition",
			"A dirty worktree is acceptable",
			/missing required lifecycle marker A clean worktree/,
		],
		[
			"pre-existing changes",
			"earlier edits",
			/missing required lifecycle marker pre-existing changes/,
		],
		[
			"must not claim agent ownership",
			"may claim agent ownership",
			/missing required lifecycle marker must not claim agent ownership/,
		],
		[
			"isolated worktree",
			"temporary checkout",
			/missing required lifecycle marker isolated worktree/,
		],
		[
			"Never automatically remove or overwrite",
			"Automatically remove or overwrite",
			/missing required lifecycle marker Never automatically remove/,
		],
		[
			"",
			"\n```sh\ngit clean -fd\n```",
			/must not recommend destructive command git clean/,
		],
		[
			"",
			"\n```sh\ngit reset --hard\n```",
			/must not recommend destructive command git reset --hard/,
		],
	];
	for (const [from, to, failure] of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(
			root,
			".agents/skills/implement-and-review/SKILL.md",
			(contents) =>
				from ? contents.replaceAll(from, to) : `${contents}${to}\n`,
		);
		assertFailure(await auditAgentAndSkillContracts(root), failure);
	}
});

test("implementation lifecycle fully reviews untracked and staged files", async (t) => {
	const cases = [
		[
			"git ls-files --others --exclude-standard",
			"git status --short",
			/missing required task-base diff command git ls-files/,
		],
		[
			"Read every task-created untracked text file in full",
			"Review every untracked filename",
			/missing required lifecycle marker Read every task-created/,
		],
		[
			"untracked file prevents `READY`",
			"untracked file is acceptable",
			/missing required lifecycle marker untracked file prevents/,
		],
		[
			"Unexpected untracked files prevent `READY`",
			"Unexpected files may be silently ignored",
			/missing required lifecycle marker Unexpected untracked/,
		],
		[
			"",
			"\n```sh\ngit add .\n```",
			/must not allow unbounded staging command git add \./,
		],
		[
			"git diff --cached --stat",
			"git diff --cached --name-only",
			/missing required task-base diff command git diff --cached --stat/,
		],
		[
			"After a commit, repeat untracked file discovery",
			"After a commit, skip untracked discovery",
			/missing required lifecycle marker After a commit/,
		],
	];
	for (const [from, to, failure] of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(
			root,
			".agents/skills/implement-and-review/SKILL.md",
			(contents) =>
				from ? contents.replaceAll(from, to) : `${contents}${to}\n`,
		);
		assertFailure(await auditAgentAndSkillContracts(root), failure);
	}
});

test("architecture contract enforces the Pilot Draft-to-Ready evidence gate", async (t) => {
	const cases = [
		[
			"Ready for review",
			"Open for discussion",
			/ordered Pilot PR gate through Ready for review/,
		],
		[
			"Local `PASS` is not remote CI `PASS`",
			"Local and remote PASS are equivalent",
			/missing Pilot PR evidence marker Local/,
		],
		[
			"`Draft` status is not",
			"Draft status is",
			/missing Pilot PR evidence marker `Draft`/,
		],
		[
			"`REMOTE CI UNVERIFIED`",
			"`PASS`",
			/missing Pilot PR evidence marker `REMOTE CI UNVERIFIED`/,
		],
		[
			"Only the user may decide whether to merge",
			"The service may automatically merge",
			/must not allow automatic merge/,
		],
	];
	for (const [from, to, failure] of cases) {
		const root = await createContractFixture(t);
		await mutateTrackedFixture(
			root,
			"docs/agents/agents-and-skills-architecture.md",
			(contents) => contents.replaceAll(from, to),
		);
		assertFailure(await auditAgentAndSkillContracts(root), failure);
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
			failure:
				/write tasks must require task-base-to-current and task-base-to-HEAD review/,
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
	await mutateTrackedFixture(
		proseOnlyRoot,
		"AGENTS.md",
		(contents) =>
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
			failure:
				/role for implement-and-review must be general-primary, found domain-support/,
		},
		{
			name: "openapi-to-generate",
			from: "Specialized primary",
			to: "Support",
			failure:
				/role for openapi-to-generate must be specialized-primary, found domain-support/,
		},
		{
			name: "openapi-to-setup",
			from: "Specialized primary",
			to: "Support",
			failure:
				/role for openapi-to-setup must be specialized-primary, found domain-support/,
		},
		{
			name: "fix-github-actions",
			from: "Specialized primary",
			to: "Support",
			failure:
				/role for fix-github-actions must be specialized-primary, found domain-support/,
		},
		{
			name: "release-monorepo",
			from: "Specialized primary",
			to: "Primary",
			failure:
				/role for release-monorepo must be specialized-primary, found general-primary/,
		},
		{
			name: "run-codegen-tests",
			from: "Validation helper",
			to: "Specialized primary",
			failure:
				/role for run-codegen-tests must be validation-helper, found specialized-primary/,
		},
		{
			name: "add-mcp-tool",
			from: "Support",
			to: "Primary",
			failure:
				/role for add-mcp-tool must be domain-support, found general-primary/,
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
	assert.deepEqual((await auditAgentAndSkillContracts(proseRoot)).failures, []);

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
		(contents) =>
			contents.replace(
				"Tracked Skill count: `12`.",
				"Tracked Skill count: `11`.",
			),
	);
	assertFailure(
		await auditAgentAndSkillContracts(countRoot),
		/tracked Skill count must equal 12/,
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
