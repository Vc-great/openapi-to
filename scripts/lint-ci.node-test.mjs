import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve("scripts/lint-ci.mjs");

function command(commandName, args, cwd, env) {
	const result = spawnSync(commandName, args, {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...env },
	});
	assert.equal(result.status, 0, result.stderr || result.stdout);
	return result;
}

test("lints tracked package files even when the worktree is clean", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "openapi-to-lint-ci-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	command("git", ["init", "-q"], directory);
	command("git", ["config", "user.email", "test@example.com"], directory);
	command("git", ["config", "user.name", "Test"], directory);
	await writeFile(join(directory, "package.json"), "{}\n");
	await writeFile(join(directory, ".gitignore"), "packages/generated/\n");
	await writeFile(join(directory, "recorded.jsonl"), "");
	await writeFile(join(directory, "fake-biome.mjs"), `
import { appendFileSync } from "node:fs";
appendFileSync(process.env.RECORDED_ARGS, JSON.stringify(process.argv.slice(2)) + "\\n");
`);
	await chmod(join(directory, "fake-biome.mjs"), 0o755);
	await mkdir(join(directory, "packages/source"), { recursive: true });
	await mkdir(join(directory, "packages/generated"), { recursive: true });
	await writeFile(
		join(directory, "packages/source/tracked.ts"),
		"export const tracked = true;\n",
	);
	await writeFile(
		join(directory, "packages/generated/output.ts"),
		"export const generated = true;\n",
	);
	command(
		"git",
		[
			"add",
			"--",
			".gitignore",
			"fake-biome.mjs",
			"package.json",
			"packages/source/tracked.ts",
		],
		directory,
	);
	command("git", ["commit", "-qm", "base"], directory);

	command(process.execPath, [script], directory, {
		LINT_CI_BIOME: join(directory, "fake-biome.mjs"),
		RECORDED_ARGS: join(directory, "recorded.jsonl"),
	});
	const invocations = (await readFile(join(directory, "recorded.jsonl"), "utf8"))
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	assert.equal(invocations.length, 1);
	assert.ok(invocations[0].includes("packages/source/tracked.ts"));
	assert.ok(!invocations[0].includes("packages/generated/output.ts"));
});
