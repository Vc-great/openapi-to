import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./verify-generated-output.mjs", import.meta.url));
const HASH_X = createHash("sha256").update("x").digest("hex");

async function createRepository(t) {
	const repository = await mkdtemp(path.join(tmpdir(), "verify-generated-output-test-"));
	const output = path.join(repository, "output");
	await mkdir(output);
	t.after(async () => {
		await rm(repository, { recursive: true, force: true });
	});
	return { repository, output };
}

function run(repository, args) {
	return spawnSync(process.execPath, [SCRIPT, ...args], {
		cwd: repository,
		encoding: "utf8",
		timeout: 10_000,
	});
}

function expectSuccess(result, outputPattern) {
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
	if (outputPattern) assert.match(result.stdout, outputPattern);
}

function expectFailure(result, errorPattern) {
	assert.notEqual(result.status, 0, result.stdout);
	assert.match(result.stderr, errorPattern);
}

async function writeOutput(output, relativePath, content = "x") {
	const destination = path.join(output, ...relativePath.split("/"));
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, content);
	return destination;
}

function validManifest(overrides = {}) {
	return {
		format: 1,
		entries: [{ path: "a.txt", bytes: 1, sha256: HASH_X }],
		...overrides,
	};
}

async function writeJson(filePath, value) {
	await writeFile(filePath, `${JSON.stringify(value)}\n`);
}

test("accepts a valid generated directory", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	expectSuccess(run(repository, ["--root", output]), /Verified generated output: 1 file\(s\)/);
});

test("rejects an empty generated directory", async (t) => {
	const { repository, output } = await createRepository(t);
	expectFailure(run(repository, ["--root", output]), /Generated output is empty/);
});

test("rejects an empty file by default", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "empty.txt", "");
	expectFailure(run(repository, ["--root", output]), /Empty generated file: empty\.txt/);
});

test("allows an explicitly matched empty file and records it", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "allowed.empty", "");
	const manifest = path.join(repository, "manifest.json");
	const result = run(repository, ["--root", output, "--allow-empty", "*.empty", "--write-manifest", manifest]);
	expectSuccess(result, /Wrote manifest:[\s\S]*Verified generated output/);
	const parsed = JSON.parse(await readFile(manifest, "utf8"));
	assert.equal(parsed.entries[0].bytes, 0);
});

test("rejects a dangerously broad empty-file pattern", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "empty.txt", "");
	expectFailure(run(repository, ["--root", output, "--allow-empty", "**/*"]), /too broad/);
});

test("rejects symlinks in generated output", async (t) => {
	const { repository, output } = await createRepository(t);
	const target = await writeOutput(output, "target.txt");
	try {
		await symlink(target, path.join(output, "link.txt"));
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && ["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
			t.skip(`Symlinks are unavailable on this platform: ${error.code}`);
			return;
		}
		throw error;
	}
	expectFailure(run(repository, ["--root", output]), /Symlink found in generated output/);
});

test("rejects case-insensitive generated path collisions when the filesystem supports both names", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "A.ts", "A");
	await writeOutput(output, "a.ts", "a");
	const names = await readdir(output);
	if (!(names.includes("A.ts") && names.includes("a.ts"))) {
		t.skip("The filesystem is case-insensitive.");
		return;
	}
	expectFailure(run(repository, ["--root", output]), /Case-insensitive path collision/);
});

test("rejects duplicate manifest paths before comparison", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const manifest = path.join(repository, "manifest.json");
	await writeJson(manifest, validManifest({
		entries: [
			{ path: "a.txt", bytes: 999, sha256: "0".repeat(64) },
			{ path: "a.txt", bytes: 1, sha256: HASH_X },
		],
	}));
	expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /Duplicate manifest path: a\.txt/);
});

test("rejects case-insensitive manifest path collisions", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const manifest = path.join(repository, "manifest.json");
	await writeJson(manifest, validManifest({ entries: [
		{ path: "A.ts", bytes: 1, sha256: HASH_X },
		{ path: "a.ts", bytes: 1, sha256: HASH_X },
	] }));
	expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /Case-insensitive manifest path collision/);
});

test("rejects an invalid SHA-256", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const manifest = path.join(repository, "manifest.json");
	await writeJson(manifest, validManifest({ entries: [{ path: "a.txt", bytes: 1, sha256: "not-a-hash" }] }));
	expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /64 hexadecimal characters/);
});

test("rejects negative, fractional, and unsafe manifest byte counts", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	for (const bytes of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
		const manifest = path.join(repository, `manifest-${String(bytes).replaceAll(".", "-")}.json`);
		await writeJson(manifest, validManifest({ entries: [{ path: "a.txt", bytes, sha256: HASH_X }] }));
		expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /non-negative safe integer/);
	}
});

test("rejects absolute, parent, backslash, dot, and non-canonical manifest paths", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const invalidPaths = ["/a.txt", "../a.txt", "dir\\a.txt", ".", "a//b.txt", "a/./b.txt"];
	for (let index = 0; index < invalidPaths.length; index += 1) {
		const manifest = path.join(repository, `invalid-path-${index}.json`);
		await writeJson(manifest, validManifest({ entries: [{ path: invalidPaths[index], bytes: 1, sha256: HASH_X }] }));
		expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /(relative path|POSIX|normalized|canonical|empty or)/);
	}
});

test("writes a manifest in the repository root", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const result = run(repository, ["--root", output, "--write-manifest", "generated-manifest.json"]);
	expectSuccess(result, /Wrote manifest:[\s\S]*Verified generated output/);
	assert.equal((await readFile(path.join(repository, "generated-manifest.json"), "utf8")).length > 0, true);
});

test("writes a manifest in a repository subdirectory", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	await mkdir(path.join(repository, "manifests"));
	expectSuccess(run(repository, ["--root", output, "--write-manifest", "manifests/generated.json"]), /Wrote manifest/);
});

test("writes a manifest in an OS temporary directory", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const destinationRoot = await mkdtemp(path.join(tmpdir(), "verify-manifest-destination-"));
	t.after(async () => {
		await rm(destinationRoot, { recursive: true, force: true });
	});
	expectSuccess(run(repository, ["--root", output, "--write-manifest", path.join(destinationRoot, "generated.json")]), /Wrote manifest/);
});

test("rejects writing a manifest inside generated output", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	expectFailure(run(repository, ["--root", output, "--write-manifest", path.join(output, "manifest.json")]), /must not be inside generated output/);
});

test("refuses to overwrite an existing manifest", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const manifest = path.join(repository, "manifest.json");
	await writeFile(manifest, "user content");
	expectFailure(run(repository, ["--root", output, "--write-manifest", manifest]), /will not be overwritten/);
	assert.equal(await readFile(manifest, "utf8"), "user content");
});

test("rejects reading a manifest from generated output", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const manifest = path.join(output, "manifest.json");
	await writeJson(manifest, validManifest());
	expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /must not be inside generated output/);
});

test("rejects a manifest symlink", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const target = path.join(repository, "target.json");
	const link = path.join(repository, "manifest.json");
	await writeJson(target, validManifest());
	try {
		await symlink(target, link);
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && ["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
			t.skip(`Symlinks are unavailable on this platform: ${error.code}`);
			return;
		}
		throw error;
	}
	expectFailure(run(repository, ["--root", output, "--manifest", link]), /Manifest must not be a symlink/);
});

test("matches an unchanged second run", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const manifest = path.join(repository, "manifest.json");
	expectSuccess(run(repository, ["--root", output, "--write-manifest", manifest]), /Wrote manifest/);
	expectSuccess(run(repository, ["--root", output, "--manifest", manifest]), /Manifest matches: 1 file\(s\)/);
});

test("reports changed, added, and deleted files", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt", "a");
	await writeOutput(output, "b.txt", "b");
	const manifest = path.join(repository, "manifest.json");
	expectSuccess(run(repository, ["--root", output, "--write-manifest", manifest]), /Wrote manifest/);

	await writeOutput(output, "a.txt", "changed");
	expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /changed: a\.txt/);
	await writeOutput(output, "a.txt", "a");
	await writeOutput(output, "c.txt", "c");
	expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /added: c\.txt/);
	await rm(path.join(output, "c.txt"));
	await rm(path.join(output, "b.txt"));
	expectFailure(run(repository, ["--root", output, "--manifest", manifest]), /deleted: b\.txt/);
});

test("enforces the generated file count limit", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	await writeOutput(output, "b.txt");
	expectFailure(run(repository, ["--root", output, "--max-files", "1"]), /file count exceeds/);
});

test("enforces the single-file byte limit before reading", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt", "ab");
	expectFailure(run(repository, ["--root", output, "--max-file-bytes", "1"]), /exceeds --max-file-bytes/);
});

test("enforces the total byte limit", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt", "ab");
	await writeOutput(output, "b.txt", "cd");
	expectFailure(run(repository, ["--root", output, "--max-total-bytes", "3"]), /exceeds --max-total-bytes/);
});

test("enforces the directory depth limit", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a/b/deep.txt");
	expectFailure(run(repository, ["--root", output, "--max-depth", "1"]), /exceeds --max-depth/);
});

test("enforces manifest file size and entry limits", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const largeManifest = path.join(repository, "large.json");
	await writeFile(largeManifest, " ".repeat(100));
	expectFailure(run(repository, ["--root", output, "--manifest", largeManifest, "--max-manifest-bytes", "10"]), /exceeds --max-manifest-bytes/);

	const entriesManifest = path.join(repository, "entries.json");
	await writeJson(entriesManifest, validManifest({ entries: [
		{ path: "a.txt", bytes: 1, sha256: HASH_X },
		{ path: "b.txt", bytes: 1, sha256: HASH_X },
	] }));
	expectFailure(run(repository, ["--root", output, "--manifest", entriesManifest, "--max-manifest-entries", "1"]), /entry count .* exceeds/);
});

test("rejects excessively deep or malformed manifest JSON without echoing it", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	const deep = path.join(repository, "deep.json");
	await writeFile(deep, `${"[".repeat(17)}0${"]".repeat(17)}`);
	expectFailure(run(repository, ["--root", output, "--manifest", deep]), /exceeds maximum depth/);

	const malformed = path.join(repository, "malformed.json");
	await writeFile(malformed, '{"secret":"do-not-echo"');
	const result = run(repository, ["--root", output, "--manifest", malformed]);
	expectFailure(result, /contains invalid JSON/);
	assert.doesNotMatch(result.stderr, /do-not-echo/);
});

test("returns expected exit codes for help and argument errors", async (t) => {
	const { repository, output } = await createRepository(t);
	await writeOutput(output, "a.txt");
	expectSuccess(run(repository, ["--help"]), /Usage:/);
	expectFailure(run(repository, []), /--root is required/);
	expectFailure(run(repository, ["--root"]), /Missing value for --root/);
	expectFailure(run(repository, ["--root", output, "--root", output]), /Duplicate argument: --root/);
	expectFailure(run(repository, ["--root", output, "--unknown", "value"]), /Unknown argument/);
	expectFailure(run(repository, ["--root", output, "--max-files", "0"]), /positive integer/);
});
