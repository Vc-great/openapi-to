import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import {
	assertGeneratedOutput,
	assertSafeTemporaryRoot,
	cleanupTemporaryRoot,
	installedBinaryPath,
	main,
	parseArguments,
	runCommand,
} from "./consumer-codegen-smoke.mjs";
import {
	createPackedOverrides,
	packReleasePackages,
	parsePackResult,
	releasePackageDirectories,
} from "./release/pack-smoke-helpers.mjs";

test("parses supported arguments and rejects unknown arguments", () => {
	assert.deepEqual(parseArguments([]), { keep: false, json: false });
	assert.deepEqual(parseArguments(["--", "--json", "--keep"]), {
		keep: true,
		json: true,
	});
	assert.deepEqual(parseArguments(["--help"]), {
		keep: false,
		json: false,
		help: true,
	});
	assert.throws(() => parseArguments(["--wat"]), /Unknown argument/);
});

test("uses the Windows command suffix only on Windows", () => {
	assert.match(
		installedBinaryPath("C:\\consumer", "openapi", "win32"),
		/openapi\.cmd$/,
	);
	assert.match(
		installedBinaryPath("/tmp/consumer", "openapi", "linux"),
		/openapi$/,
	);
});

test("command failures include a bounded stage, command, exit code, and output", () => {
	assert.throws(
		() =>
			runCommand(
				"synthetic compile",
				process.execPath,
				[
					"-e",
					'process.stdout.write("x".repeat(5000)); process.stderr.write("bad"); process.exit(7)',
				],
				process.cwd(),
			),
		(error) => {
			assert.match(error.message, /synthetic compile/);
			assert.match(error.message, /Command:/);
			assert.match(error.message, /Exit code: 7/);
			assert.match(error.message, /characters omitted/);
			assert.match(error.message, /stderr:\nbad/);
			assert.ok(error.message.length < 5_000);
			return true;
		},
	);
});

test("cleanup accepts only owned prefixed roots beneath the OS temp directory", async () => {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-consumer-codegen-"));
	await writeFile(join(root, "owned.txt"), "owned");
	assert.equal(assertSafeTemporaryRoot(root), root);
	await cleanupTemporaryRoot(root);
	await assert.rejects(() => writeFile(join(root, "missing", "file"), "x"));
	assert.throws(() => assertSafeTemporaryRoot(tmpdir()), /Refusing to clean/);
	assert.throws(
		() => assertSafeTemporaryRoot(process.cwd()),
		/Refusing to clean/,
	);
});

test("JSON mode emits one JSON document and routes progress to stderr", async () => {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-consumer-codegen-"));
	const stdout = [];
	const stderr = [];
	const exitCode = await main({
		argv: ["--json"],
		stdout: (value) => stdout.push(value),
		stderr: (value) => stderr.push(value),
		createTemporaryRoot: async () => root,
		execute: async ({ log }) => {
			log("fake", "progress");
			return { idempotent: true };
		},
	});
	assert.equal(exitCode, 0);
	assert.equal(stdout.length, 1);
	assert.deepEqual(JSON.parse(stdout[0]), {
		success: true,
		report: { idempotent: true },
		temporaryRoot: null,
	});
	assert.match(stderr.join(""), /\[consumer-codegen:fake] progress/);
	await assert.rejects(() => access(root));
});

test("--keep retains and reports the absolute consumer workspace", async () => {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-consumer-codegen-"));
	const stdout = [];
	const exitCode = await main({
		argv: ["--keep"],
		stdout: (value) => stdout.push(value),
		stderr: () => {},
		createTemporaryRoot: async () => root,
		execute: async () => ({ idempotent: true }),
	});
	assert.equal(exitCode, 0);
	assert.match(
		stdout.join(""),
		new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
	);
	await writeFile(join(root, "still-present"), "yes");
	await cleanupTemporaryRoot(root);
});

test("empty output and TypeScript command failures make main return nonzero", async () => {
	for (const execute of [
		async () => assertGeneratedOutput([]),
		async () =>
			runCommand(
				"TypeScript compile",
				process.execPath,
				["-e", "process.exit(2)"],
				process.cwd(),
			),
	]) {
		const root = await mkdtemp(join(tmpdir(), "openapi-to-consumer-codegen-"));
		const stderr = [];
		const exitCode = await main({
			argv: [],
			stdout: () => {},
			stderr: (value) => stderr.push(value),
			createTemporaryRoot: async () => root,
			execute,
		});
		assert.equal(exitCode, 1);
		assert.notEqual(stderr.join(""), "");
	}
});

test("shared tarball helpers preserve pack JSON parsing and stable overrides", () => {
	assert.deepEqual(
		parsePackResult('notice\n{"name":"openapi-to","files":[]}'),
		{ name: "openapi-to", files: [] },
	);
	assert.deepEqual(
		createPackedOverrides([
			{ name: "openapi-to", archive: "/tmp/openapi.tgz" },
			{ name: "@openapi-to/core", archive: "/tmp/core.tgz" },
		]),
		{
			"@openapi-to/core": "file:/tmp/core.tgz",
			"openapi-to": "file:/tmp/openapi.tgz",
		},
	);
});

test("shared pack helper discovers every release package and preserves tarball safety checks", async () => {
	const root = await mkdtemp(join(tmpdir(), "openapi-to-pack-helper-"));
	const tarballDirectory = join(root, "tarballs");
	const packageNames = new Map();
	await mkdir(tarballDirectory);
	try {
		for (const directory of releasePackageDirectories) {
			const packageDirectory = join(root, directory);
			const packageName = `fixture-${basename(directory)}`;
			packageNames.set(packageDirectory, packageName);
			await mkdir(packageDirectory, { recursive: true });
			await writeFile(
				join(packageDirectory, "package.json"),
				`${JSON.stringify({
					name: packageName,
					version: "1.0.0",
				})}\n`,
			);
			await writeFile(
				join(tarballDirectory, `${basename(directory)}.tgz`),
				"tgz",
			);
		}
		const fakePnpm = (args, cwd, extraFiles = []) => {
			assert.deepEqual(args.slice(0, 2), ["pack", "--json"]);
			return {
				stdout: JSON.stringify({
					name: packageNames.get(cwd),
					version: "1.0.0",
					filename: join(tarballDirectory, `${basename(cwd)}.tgz`),
					files: [{ path: "package.json" }, ...extraFiles],
				}),
			};
		};
		const packed = await packReleasePackages({
			repositoryRoot: root,
			tarballDirectory,
			pnpm: (args, cwd) => fakePnpm(args, cwd),
		});
		assert.equal(packed.length, releasePackageDirectories.length);
		await assert.rejects(
			() =>
				packReleasePackages({
					repositoryRoot: root,
					tarballDirectory,
					pnpm: (args, cwd) =>
						fakePnpm(args, cwd, [{ path: "coverage/report.json" }]),
				}),
			/tarball contains forbidden files/,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
