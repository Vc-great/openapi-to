import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve("scripts/lint-changed.mjs");

function command(commandName, args, cwd, env) {
	const result = spawnSync(commandName, args, {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...env },
	});
	assert.equal(result.status, 0, result.stderr || result.stdout);
	return result;
}

async function fixture() {
	const directory = await mkdtemp(join(tmpdir(), "openapi-to-lint-changed-"));
	command("git", ["init", "-q"], directory);
	command("git", ["config", "user.email", "test@example.com"], directory);
	command("git", ["config", "user.name", "Test"], directory);
	await writeFile(join(directory, "deleted.ts"), "export const deleted = true;\n");
	await writeFile(join(directory, "base.ts"), "export const base = true;\n");
	const recorded = join(directory, "recorded.json");
	const fakeBiome = join(directory, "fake-biome.mjs");
	await writeFile(
		fakeBiome,
		`import { writeFileSync } from "node:fs";\nwriteFileSync(process.env.RECORDED_ARGS, JSON.stringify(process.argv.slice(2)));\n`,
	);
	await chmod(fakeBiome, 0o755);
	command("git", ["add", "--", "deleted.ts", "base.ts", "fake-biome.mjs"], directory);
	command("git", ["commit", "-qm", "base"], directory);
	return { directory, fakeBiome, recorded };
}

test("passes staged, unstaged, and untracked paths safely while excluding deleted files", async (t) => {
	const { directory, fakeBiome, recorded } = await fixture();
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "space name.ts"), "export const spaced = true;\n");
	command("git", ["add", "--", "space name.ts"], directory);
	await writeFile(join(directory, "base.ts"), "export const base = false;\n");
	await writeFile(join(directory, "untracked.ts"), "export const untracked = true;\n");
	await rm(join(directory, "deleted.ts"));

	command(process.execPath, [script], directory, {
		LINT_CHANGED_BIOME: fakeBiome,
		RECORDED_ARGS: recorded,
	});
	const args = JSON.parse(await readFile(recorded, "utf8"));
	assert.ok(args.includes("base.ts"));
	assert.ok(args.includes("space name.ts"));
	assert.ok(args.includes("untracked.ts"));
	assert.ok(!args.includes("deleted.ts"));
});

test("succeeds without invoking Biome when there are no changed files", async (t) => {
	const { directory, fakeBiome, recorded } = await fixture();
	t.after(() => rm(directory, { recursive: true, force: true }));
	const result = command(process.execPath, [script], directory, {
		LINT_CHANGED_BIOME: fakeBiome,
		RECORDED_ARGS: recorded,
	});
	assert.match(result.stdout, /No changed lintable files/);
});
