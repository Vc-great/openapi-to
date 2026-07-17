import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./sync-claude-skills.mjs", import.meta.url));

async function createRepository(t) {
	const repository = await mkdtemp(path.join(tmpdir(), "sync-claude-skills-test-"));
	t.after(async () => {
		await rm(repository, { recursive: true, force: true });
	});
	return repository;
}

async function writeCanonicalSkill(repository, name = "example-skill") {
	const skillRoot = path.join(repository, ".agents", "skills", name);
	await mkdir(path.join(skillRoot, "agents"), { recursive: true });
	await mkdir(path.join(skillRoot, "references"), { recursive: true });
	await writeFile(path.join(skillRoot, "SKILL.md"), `---\nname: ${name}\ndescription: Validate a small repository workflow. Use for sync tests; do not use elsewhere.\n---\n\n# Example\n\nRead [details](references/details.md).\n`);
	await writeFile(path.join(skillRoot, "references", "details.md"), "# Details\n");
	await writeFile(path.join(skillRoot, "agents", "openai.yaml"), `interface:\n  display_name: "Example Skill"\n  short_description: "Validate a repository Skill mirror"\n  default_prompt: "Use $${name} to validate the repository Skill mirror."\n`);
	return skillRoot;
}

function run(repository, args = []) {
	return spawnSync(process.execPath, [SCRIPT, ...args], {
		cwd: repository,
		encoding: "utf8",
		timeout: 10_000,
	});
}

test("default check mode detects a missing mirror without writing", async (t) => {
	const repository = await createRepository(t);
	await writeCanonicalSkill(repository);
	const result = run(repository);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /mirror is missing/);
	await assert.rejects(readFile(path.join(repository, ".claude", "skills", "example-skill", "SKILL.md")), /ENOENT/);
});

test("explicit sync creates a verified mirror", async (t) => {
	const repository = await createRepository(t);
	await writeCanonicalSkill(repository);
	const sync = run(repository, ["--sync"]);
	assert.equal(sync.status, 0, sync.stderr);
	assert.match(sync.stdout, /Synchronized and verified 3 managed Claude Skill file\(s\)/);
	const check = run(repository, ["--check"]);
	assert.equal(check.status, 0, check.stderr);
	assert.match(check.stdout, /Verified 3 managed Claude Skill file\(s\)/);
});

test("check mode detects content drift", async (t) => {
	const repository = await createRepository(t);
	await writeCanonicalSkill(repository);
	assert.equal(run(repository, ["--sync"]).status, 0);
	await writeFile(path.join(repository, ".claude", "skills", "example-skill", "SKILL.md"), "drift\n");
	const result = run(repository, ["--check"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /content drift/);
});

test("sync preserves unknown files and removes only stale managed files", async (t) => {
	const repository = await createRepository(t);
	const skillRoot = await writeCanonicalSkill(repository);
	await writeFile(path.join(skillRoot, "managed-extra.txt"), "managed\n");
	assert.equal(run(repository, ["--sync"]).status, 0);
	const unknown = path.join(repository, ".claude", "skills", "user-note.txt");
	await writeFile(unknown, "user-owned\n");
	await rm(path.join(skillRoot, "managed-extra.txt"));
	assert.equal(run(repository, ["--sync"]).status, 0);
	assert.equal(await readFile(unknown, "utf8"), "user-owned\n");
	await assert.rejects(readFile(path.join(repository, ".claude", "skills", "example-skill", "managed-extra.txt")), /ENOENT/);
});

test("a malicious managed manifest path cannot delete an unknown file", async (t) => {
	const repository = await createRepository(t);
	await writeCanonicalSkill(repository);
	assert.equal(run(repository, ["--sync"]).status, 0);
	const unknown = path.join(repository, ".claude", "unknown.txt");
	await writeFile(unknown, "keep me\n");
	const manifestPath = path.join(repository, ".claude", "skills", ".openapi-to-skill-mirror.json");
	const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
	manifest.files.push({ path: "../unknown.txt", bytes: 8, sha256: "0".repeat(64) });
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

	const result = run(repository, ["--sync"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /may not traverse/);
	assert.equal(await readFile(unknown, "utf8"), "keep me\n");
});

test("canonical validation rejects metadata invocation mismatches", async (t) => {
	const repository = await createRepository(t);
	const skillRoot = await writeCanonicalSkill(repository);
	await writeFile(path.join(skillRoot, "agents", "openai.yaml"), `interface:\n  display_name: "Example Skill"\n  short_description: "Validate a repository Skill mirror"\n  default_prompt: "Use $wrong-name to validate the mirror."\n`);
	const result = run(repository, ["--sync"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /must invoke \$example-skill/);
});

test("canonical validation rejects broken relative links", async (t) => {
	const repository = await createRepository(t);
	const skillRoot = await writeCanonicalSkill(repository);
	await writeFile(path.join(skillRoot, "SKILL.md"), `---\nname: example-skill\ndescription: Validate a small repository workflow. Use for sync tests; do not use elsewhere.\n---\n\nRead [missing](references/missing.md).\n`);
	const result = run(repository, ["--sync"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /Broken Markdown link/);
});

test("canonical validation rejects a missing repository script path in a shell block", async (t) => {
	const repository = await createRepository(t);
	const skillRoot = await writeCanonicalSkill(repository);
	await writeFile(path.join(skillRoot, "SKILL.md"), `---\nname: example-skill\ndescription: Validate a small repository workflow. Use for sync tests; do not use elsewhere.\n---\n\n\`\`\`sh\nnode .agents/skills/example-skill/scripts/missing.mjs\n\`\`\`\n`);
	const result = run(repository, ["--sync"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /Referenced Skill path does not exist/);
});
