import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
	createPublicationFacts,
	publishWithChangesetsNpm,
	readReleaseNotes,
	verifyRegistry,
	verifyWorkflowSha,
} from "./publication.mjs";

async function writeFixtureFile(root, relativePath, contents) {
	const path = join(root, relativePath);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, contents);
}

async function createPublicationFixture(t, version = "4.0.0-rc.2") {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-publication-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFixtureFile(
		root,
		"package.json",
		`${JSON.stringify({
			name: "fixture",
			private: true,
			workspaces: { packages: ["packages/*"] },
			packageManager: "pnpm@10.14.0",
		})}\n`,
	);
	await writeFixtureFile(
		root,
		"pnpm-workspace.yaml",
		"packages:\n  - 'packages/*'\n",
	);
	for (const [directory, name, isPrivate] of [
		["a", "@fixture/a", false],
		["b", "fixture-b", false],
		["private", "@fixture/private", true],
	]) {
		await writeFixtureFile(
			root,
			`packages/${directory}/package.json`,
			`${JSON.stringify({
				name,
				version: isPrivate ? "1.0.0" : version,
				private: isPrivate || undefined,
				publishConfig: isPrivate
					? undefined
					: {
							access: "public",
							registry: "https://registry.npmjs.org/",
						},
			})}\n`,
		);
	}
	await writeFixtureFile(
		root,
		".changeset/config.json",
		`${JSON.stringify({
			fixed: [["@fixture/a", "fixture-b"]],
		})}\n`,
	);
	if (version.includes("-")) {
		await writeFixtureFile(
			root,
			".changeset/pre.json",
			'{"mode":"pre","tag":"rc","initialVersions":{},"changesets":[]}\n',
		);
	}
	await writeFixtureFile(
		root,
		"packages/openapi/CHANGELOG.md",
		`# fixture

## ${version}

- Current release notes.

## 3.2.2

- Older notes.
`,
	);
	return root;
}

function registryResponse(metadata, status = 200) {
	const body = new TextEncoder().encode(JSON.stringify(metadata));
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: () => String(body.byteLength) },
		arrayBuffer: async () =>
			body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
	};
}

test("workflow SHA guard blocks ref, dispatch SHA, and remote-main drift", async () => {
	const sha = "a".repeat(40);
	assert.deepEqual(
		await verifyWorkflowSha({
			expectedSha: sha,
			githubSha: sha,
			githubRef: "refs/heads/main",
			resolveRemoteSha: async () => sha,
		}),
		{
			success: true,
			expectedSha: sha,
			githubRef: "refs/heads/main",
			remoteMain: sha,
		},
	);
	for (const fixture of [
		{ expectedSha: "not-a-sha", githubSha: sha, githubRef: "refs/heads/main" },
		{ expectedSha: sha, githubSha: "b".repeat(40), githubRef: "refs/heads/main" },
		{ expectedSha: sha, githubSha: sha, githubRef: "refs/heads/feature" },
	]) {
		await assert.rejects(
			verifyWorkflowSha({
				...fixture,
				resolveRemoteSha: async () => sha,
			}),
		);
	}
	await assert.rejects(
		verifyWorkflowSha({
			expectedSha: sha,
			githubSha: sha,
			githubRef: "refs/heads/main",
			resolveRemoteSha: async () => "b".repeat(40),
		}),
		/current fetched origin\/main commit/,
	);
});

test("publication facts discover the real public fixed group and validate RC channel", async (t) => {
	const root = await createPublicationFixture(t);
	const facts = await createPublicationFacts({
		root,
		expectedVersion: "4.0.0-rc.2",
		channel: "rc",
	});
	assert.deepEqual(facts, {
		success: true,
		version: "4.0.0-rc.2",
		channel: "rc",
		distTag: "rc",
		prerelease: true,
		tag: "v4.0.0-rc.2",
		packageCount: 2,
		packages: [
			{
				name: "@fixture/a",
				version: "4.0.0-rc.2",
				directory: "packages/a",
			},
			{
				name: "fixture-b",
				version: "4.0.0-rc.2",
				directory: "packages/b",
			},
		],
	});
});

test("publication facts reject version, channel, prerelease-state, and fixed-group drift", async (t) => {
	const root = await createPublicationFixture(t);
	await assert.rejects(
		createPublicationFacts({
			root,
			expectedVersion: "4.0.0-rc.2",
			channel: "latest",
		}),
		/Prerelease version .* requires the rc channel/,
	);
	await assert.rejects(
		createPublicationFacts({
			root,
			expectedVersion: "4.0.0-rc.3",
			channel: "rc",
		}),
		/Public packages must all use expected version/,
	);
	await writeFixtureFile(
		root,
		".changeset/pre.json",
		'{"mode":"pre","tag":"beta","initialVersions":{},"changesets":[]}\n',
	);
	await assert.rejects(
		createPublicationFacts({
			root,
			expectedVersion: "4.0.0-rc.2",
			channel: "rc",
		}),
		/requires Changesets prerelease mode with tag rc/,
	);
	await writeFixtureFile(
		root,
		".changeset/config.json",
		'{"fixed":[["@fixture/a"]]}\n',
	);
	await assert.rejects(
		createPublicationFacts({
			root,
			expectedVersion: "4.0.0-rc.2",
			channel: "rc",
		}),
		/exact Changesets fixed group/,
	);
});

test("publication facts reject workspace traversal before reading package manifests", async (t) => {
	const root = await createPublicationFixture(t);
	await writeFixtureFile(
		root,
		"package.json",
		'{"name":"fixture","private":true,"workspaces":{"packages":["../*"]}}\n',
	);
	await writeFixtureFile(root, "pnpm-workspace.yaml", "packages:\n  - '../*'\n");
	await assert.rejects(
		createPublicationFacts({
			root,
			expectedVersion: "4.0.0-rc.2",
			channel: "rc",
		}),
		/not a safe repository-relative path/,
	);
});

test("stable publication facts require latest outside prerelease mode", async (t) => {
	const root = await createPublicationFixture(t, "4.0.0");
	const facts = await createPublicationFacts({
		root,
		expectedVersion: "4.0.0",
		channel: "latest",
	});
	assert.equal(facts.prerelease, false);
	assert.equal(facts.distTag, "latest");
	await assert.rejects(
		createPublicationFacts({
			root,
			expectedVersion: "4.0.0",
			channel: "rc",
		}),
		/Stable version .* requires the latest channel/,
	);
});

test("Changesets publication selects pinned npm and restores the root manifest", async (t) => {
	const root = await createPublicationFixture(t);
	const manifestPath = join(root, "package.json");
	const preStatePath = join(root, ".changeset/pre.json");
	const originalManifest = await readFile(manifestPath, "utf8");
	const originalPreState = await readFile(preStatePath, "utf8");
	let invocation;
	const result = await publishWithChangesetsNpm({
		root,
		expectedVersion: "4.0.0-rc.2",
		channel: "rc",
		npmVersion: "12.0.2",
		readNpmVersion: async () => "12.0.2",
		runPublish: async (details) => {
			invocation = details;
			assert.equal(
				JSON.parse(await readFile(manifestPath, "utf8")).packageManager,
				"npm@12.0.2",
			);
			await assert.rejects(readFile(preStatePath, "utf8"), {
				code: "ENOENT",
			});
		},
	});
	assert.equal(result.publisher, "npm");
	assert.equal(result.npmVersion, "12.0.2");
	assert.equal(invocation.command, join(root, "node_modules/.bin/changeset"));
	assert.deepEqual(invocation.arguments, [
		"publish",
		"--tag",
		"rc",
		"--no-git-tag",
	]);
	assert.equal(await readFile(manifestPath, "utf8"), originalManifest);
	assert.equal(await readFile(preStatePath, "utf8"), originalPreState);

	await assert.rejects(
		publishWithChangesetsNpm({
			root,
			expectedVersion: "4.0.0-rc.2",
			channel: "rc",
			npmVersion: "12.0.2",
			readNpmVersion: async () => "12.0.2",
			runPublish: async () => {
				throw new Error("fixture publish failure");
			},
		}),
		/fixture publish failure/,
	);
	assert.equal(await readFile(manifestPath, "utf8"), originalManifest);
	assert.equal(await readFile(preStatePath, "utf8"), originalPreState);
});

test("stable Changesets publication explicitly selects latest outside pre mode", async (t) => {
	const root = await createPublicationFixture(t, "4.0.0");
	let invocation;
	await publishWithChangesetsNpm({
		root,
		expectedVersion: "4.0.0",
		channel: "latest",
		npmVersion: "12.0.2",
		readNpmVersion: async () => "12.0.2",
		runPublish: async (details) => {
			invocation = details;
		},
	});
	assert.deepEqual(invocation.arguments, [
		"publish",
		"--tag",
		"latest",
		"--no-git-tag",
	]);
});

test("registry verification retries with an injected client and validates every dist-tag", async (t) => {
	const root = await createPublicationFixture(t);
	const facts = await createPublicationFacts({
		root,
		expectedVersion: "4.0.0-rc.2",
		channel: "rc",
	});
	let calls = 0;
	const sleeps = [];
	const attempts = [];
	const result = await verifyRegistry({
		facts,
		attempts: 2,
		delayMs: 7,
		sleepImpl: async (milliseconds) => sleeps.push(milliseconds),
		onAttempt: (attempt) => attempts.push(attempt),
		fetchImpl: async (url) => {
			calls += 1;
			const name = decodeURIComponent(new URL(url).pathname.slice(1));
			const firstAttempt = calls <= 2;
			const versionPresent = !(firstAttempt && name === "@fixture/a");
			return registryResponse({
				versions: versionPresent ? { "4.0.0-rc.2": {} } : {},
				"dist-tags": { rc: "4.0.0-rc.2" },
			});
		},
	});
	assert.equal(result.success, true);
	assert.equal(result.attempts, 2);
	assert.equal(result.requestTimeoutMs, 10_000);
	assert.equal(result.totalBudgetMs, 20_007);
	assert.equal(result.verifiedPackages, 2);
	assert.deepEqual(sleeps, [7]);
	assert.deepEqual(
		attempts.map(({ verified }) => verified),
		[1, 2],
	);
});

test("registry verification enforces per-request and total retry budgets", async (t) => {
	const root = await createPublicationFixture(t);
	const facts = await createPublicationFacts({
		root,
		expectedVersion: "4.0.0-rc.2",
		channel: "rc",
	});
	await assert.rejects(
		verifyRegistry({
			facts,
			requestTimeoutMs: 0,
		}),
		/request timeout must be an integer/,
	);
	await assert.rejects(
		verifyRegistry({
			facts,
			attempts: 12,
			delayMs: 30_000,
			requestTimeoutMs: 30_000,
		}),
		/verification budget must not exceed/,
	);
});

test("registry verification reports explicit partial-publication recovery facts", async (t) => {
	const root = await createPublicationFixture(t);
	const facts = await createPublicationFacts({
		root,
		expectedVersion: "4.0.0-rc.2",
		channel: "rc",
	});
	const result = await verifyRegistry({
		facts,
		attempts: 1,
		delayMs: 0,
		fetchImpl: async (url) => {
			const name = decodeURIComponent(new URL(url).pathname.slice(1));
			return registryResponse({
				versions: { "4.0.0-rc.2": {} },
				"dist-tags": {
					rc: name === "fixture-b" ? "4.0.0-rc.1" : "4.0.0-rc.2",
				},
			});
		},
	});
	assert.equal(result.success, false);
	assert.equal(result.verifiedPackages, 1);
	assert.equal(result.recovery.state, "PARTIAL_PUBLICATION");
	assert.equal(
		result.packages.find(({ name }) => name === "fixture-b").distTagVersion,
		"4.0.0-rc.1",
	);
});

test("registry verification bounds metadata before allocating an oversized body", async (t) => {
	const root = await createPublicationFixture(t);
	const facts = await createPublicationFacts({
		root,
		expectedVersion: "4.0.0-rc.2",
		channel: "rc",
	});
	let bodyRead = false;
	const result = await verifyRegistry({
		facts,
		attempts: 1,
		delayMs: 0,
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			headers: { get: () => String(5 * 1024 * 1024) },
			arrayBuffer: async () => {
				bodyRead = true;
				return new ArrayBuffer(0);
			},
		}),
	});
	assert.equal(result.success, false);
	assert.equal(bodyRead, false);
	assert.match(result.packages[0].error, /exceeds the response limit/);
});

test("release notes are bounded to the exact aggregate changelog section", async (t) => {
	const root = await createPublicationFixture(t);
	assert.equal(
		await readReleaseNotes({ root, version: "4.0.0-rc.2" }),
		"## 4.0.0-rc.2\n\n- Current release notes.",
	);
	await assert.rejects(
		readReleaseNotes({ root, version: "4.0.0-rc.9" }),
		/has no section for 4\.0\.0-rc\.9/,
	);
});
