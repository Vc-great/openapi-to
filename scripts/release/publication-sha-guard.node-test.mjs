import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	access,
	cp,
	mkdir,
	mkdtemp,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const guardSourcePath = fileURLToPath(
	new URL("./publication-sha-guard.mjs", import.meta.url),
);

async function git(root, ...argumentsList) {
	const { stdout } = await execFileAsync("git", argumentsList, {
		cwd: root,
		encoding: "utf8",
	});
	return stdout.trim();
}

async function createCheckout(t) {
	const fixtureRoot = await mkdtemp(
		join(tmpdir(), "openapi-to-publication-sha-guard-"),
	);
	t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
	const origin = join(fixtureRoot, "origin.git");
	const checkout = join(fixtureRoot, "checkout");
	await mkdir(origin);
	await git(origin, "init", "--bare", "--quiet");
	await mkdir(checkout);
	await git(checkout, "init", "--quiet", "--initial-branch=main");
	await git(checkout, "config", "user.name", "Publication SHA Guard Test");
	await git(
		checkout,
		"config",
		"user.email",
		"publication-sha-guard@example.invalid",
	);
	await mkdir(join(checkout, "scripts/release"), { recursive: true });
	await cp(
		guardSourcePath,
		join(checkout, "scripts/release/publication-sha-guard.mjs"),
	);
	await writeFile(join(checkout, "fixture.txt"), "fixture\n");
	await git(checkout, "add", "--", ".");
	await git(checkout, "commit", "--quiet", "-m", "Create guard fixture");
	await git(checkout, "remote", "add", "origin", origin);
	await git(checkout, "push", "--quiet", "--set-upstream", "origin", "main");
	const sha = await git(checkout, "rev-parse", "HEAD");
	return { checkout, sha };
}

async function alternateCommit(checkout, parentSha) {
	const tree = await git(checkout, "rev-parse", `${parentSha}^{tree}`);
	return git(
		checkout,
		"commit-tree",
		tree,
		"-p",
		parentSha,
		"-m",
		"Alternate commit",
	);
}

async function runGuard(
	checkout,
	{ expectedSha, githubSha, githubRef = "refs/heads/main" },
) {
	const argumentsList = [
		join(checkout, "scripts/release/publication-sha-guard.mjs"),
		"--expected-sha",
		expectedSha,
		"--github-sha",
		githubSha,
		"--github-ref",
		githubRef,
	];
	try {
		const { stdout, stderr } = await execFileAsync(
			process.execPath,
			argumentsList,
			{
				cwd: checkout,
				encoding: "utf8",
			},
		);
		return { code: 0, stdout, stderr };
	} catch (error) {
		return {
			code: error.code,
			stdout: error.stdout,
			stderr: error.stderr,
		};
	}
}

function assertGuardFailure(result, expectedCode) {
	assert.notEqual(result.code, 0);
	assert.deepEqual(JSON.parse(result.stdout), {
		success: false,
		code: expectedCode,
	});
	assert.match(result.stderr, new RegExp(`^${expectedCode}:`));
}

test("SHA guard succeeds in a temporary checkout without node_modules", async (t) => {
	const { checkout, sha } = await createCheckout(t);
	await assert.rejects(access(join(checkout, "node_modules")), {
		code: "ENOENT",
	});

	const result = await runGuard(checkout, {
		expectedSha: sha,
		githubSha: sha,
	});

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.deepEqual(JSON.parse(result.stdout), {
		success: true,
		expectedSha: sha,
		githubSha: sha,
		githubRef: "refs/heads/main",
		checkoutHead: sha,
		remoteMain: sha,
	});
	await assert.rejects(access(join(checkout, "node_modules")), {
		code: "ENOENT",
	});
});

test("SHA guard rejects a GitHub dispatch SHA mismatch", async (t) => {
	const { checkout, sha } = await createCheckout(t);
	const result = await runGuard(checkout, {
		expectedSha: sha,
		githubSha: "b".repeat(40),
	});
	assertGuardFailure(result, "DISPATCH_SHA_MISMATCH");
});

test("SHA guard rejects origin/main drift", async (t) => {
	const { checkout, sha } = await createCheckout(t);
	const alternateSha = await alternateCommit(checkout, sha);
	await git(
		checkout,
		"update-ref",
		"refs/remotes/origin/main",
		alternateSha,
	);

	const result = await runGuard(checkout, {
		expectedSha: sha,
		githubSha: sha,
	});
	assertGuardFailure(result, "REMOTE_MAIN_SHA_MISMATCH");
});

test("SHA guard rejects a mismatched checkout HEAD", async (t) => {
	const { checkout, sha } = await createCheckout(t);
	const alternateSha = await alternateCommit(checkout, sha);
	await git(checkout, "update-ref", "HEAD", alternateSha);

	const result = await runGuard(checkout, {
		expectedSha: sha,
		githubSha: sha,
	});
	assertGuardFailure(result, "CHECKOUT_HEAD_SHA_MISMATCH");
});

test("SHA guard rejects dispatches from refs other than main", async (t) => {
	const { checkout, sha } = await createCheckout(t);
	const result = await runGuard(checkout, {
		expectedSha: sha,
		githubSha: sha,
		githubRef: "refs/heads/feature",
	});
	assertGuardFailure(result, "INVALID_PUBLICATION_REF");
});

test("SHA guard rejects empty, short, uppercase, and non-hex expected SHAs", async (t) => {
	const { checkout, sha } = await createCheckout(t);
	for (const expectedSha of [
		"",
		sha.slice(0, 12),
		sha.toUpperCase(),
		`${sha.slice(0, 39)}z`,
	]) {
		const result = await runGuard(checkout, {
			expectedSha,
			githubSha: sha,
		});
		assertGuardFailure(result, "INVALID_EXPECTED_SHA");
	}
});
