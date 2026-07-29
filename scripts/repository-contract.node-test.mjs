import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
	auditRepositoryContracts,
	parseOpenAiSkillYaml,
	parseSkillFrontmatter,
	parseWorkspacePatterns,
	repositoryRoot,
} from "./repository-contract.mjs";

test("repository scripts, workspaces, docs, packages, and binary claims stay aligned", async () => {
	const result = await auditRepositoryContracts(repositoryRoot);
	assert.deepEqual(result.failures, []);
	assert.ok(result.workspaces.includes("packages/openapi"));
	assert.ok(result.workspaces.includes("packages/mcp"));
	assert.ok(result.workspaces.includes("e2e/common"));
	assert.ok(result.workspaces.includes("e2e/module"));
	assert.deepEqual(result.agents, [
		"AGENTS.md",
		"packages/core/AGENTS.md",
		"packages/cli/AGENTS.md",
		"packages/mcp/AGENTS.md",
		".github/AGENTS.md",
	]);
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

test("workspace parser accepts only quoted package entries", () => {
	assert.deepEqual(
		parseWorkspacePatterns(`packages:
  - 'packages/*'
  - "e2e/*"
`),
		["packages/*", "e2e/*"],
	);
});

test("Skill metadata parsers accept the repository schema and reject drift", () => {
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
`),
		{
			display_name: "Fix Example",
			short_description: "Diagnose and repair one example workflow",
			default_prompt: "Use $fix-example to repair the example.",
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
		/unsupported agents\/openai\.yaml line/,
	);
});
