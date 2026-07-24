import assert from "node:assert/strict";
import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
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

test("collects the stable tracked repository lint surface", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "openapi-to-lint-ci-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	command("git", ["init", "-q"], directory);
	command("git", ["config", "user.email", "test@example.com"], directory);
	command("git", ["config", "user.name", "Test"], directory);
	await writeFile(join(directory, "package.json"), "{}\n");
	await writeFile(
		join(directory, ".gitignore"),
		"packages/generated/\nscripts/untracked.mjs\n",
	);
	await writeFile(join(directory, "recorded.jsonl"), "");
	await writeFile(
		join(directory, "fake-biome.mjs"),
		`
import { appendFileSync } from "node:fs";
appendFileSync(process.env.RECORDED_ARGS, JSON.stringify(process.argv.slice(2)) + "\\n");
`,
	);
	await chmod(join(directory, "fake-biome.mjs"), 0o755);
	await mkdir(join(directory, "packages/source"), { recursive: true });
	await mkdir(join(directory, "packages/example/mock"), { recursive: true });
	await mkdir(join(directory, "packages/plugin-ts-type/mock/typeModels"), {
		recursive: true,
	});
	await mkdir(join(directory, "packages/generated"), { recursive: true });
	await mkdir(join(directory, "scripts/release"), { recursive: true });
	await mkdir(join(directory, "e2e/example"), { recursive: true });
	await mkdir(join(directory, "configs"), { recursive: true });
	await writeFile(
		join(directory, "packages/source/tracked.ts"),
		"export const tracked = true;\n",
	);
	await writeFile(
		join(directory, "packages/generated/output.ts"),
		"export const generated = true;\n",
	);
	await writeFile(
		join(directory, "packages/example/mock/maintained.ts"),
		"export const maintainedMock = true;\n",
	);
	await writeFile(
		join(directory, "packages/plugin-ts-type/mock/typeModels/generated.ts"),
		"export const generatedFixture = true;\n",
	);
	await writeFile(
		join(directory, "scripts/release/pack-install-smoke.mjs"),
		"export const releaseScript = true;\n",
	);
	await writeFile(
		join(directory, "e2e/example/setup.cjs"),
		"module.exports = true;\n",
	);
	await writeFile(join(directory, "configs/tool.json"), '{"enabled":true}\n');
	await writeFile(
		join(directory, "scripts/untracked.mjs"),
		"export const untracked = true;\n",
	);
	command(
		"git",
		[
			"add",
			"--",
			".gitignore",
			"fake-biome.mjs",
			"package.json",
			"configs/tool.json",
			"e2e/example/setup.cjs",
			"packages/example/mock/maintained.ts",
			"packages/plugin-ts-type/mock/typeModels/generated.ts",
			"packages/source/tracked.ts",
			"scripts/release/pack-install-smoke.mjs",
		],
		directory,
	);
	command("git", ["commit", "-qm", "base"], directory);

	command(process.execPath, [script], directory, {
		LINT_CI_BIOME: join(directory, "fake-biome.mjs"),
		RECORDED_ARGS: join(directory, "recorded.jsonl"),
	});
	const invocations = (
		await readFile(join(directory, "recorded.jsonl"), "utf8")
	)
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	assert.equal(invocations.length, 1);
	assert.ok(invocations[0].includes("packages/source/tracked.ts"));
	assert.ok(invocations[0].includes("packages/example/mock/maintained.ts"));
	assert.ok(invocations[0].includes("scripts/release/pack-install-smoke.mjs"));
	assert.ok(invocations[0].includes("e2e/example/setup.cjs"));
	assert.ok(invocations[0].includes("configs/tool.json"));
	assert.ok(
		!invocations[0].includes(
			"packages/plugin-ts-type/mock/typeModels/generated.ts",
		),
	);
	assert.ok(!invocations[0].includes("packages/generated/output.ts"));
	assert.ok(!invocations[0].includes("scripts/untracked.mjs"));
});
