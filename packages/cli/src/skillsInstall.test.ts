import { createHash } from "node:crypto";
import {
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rename,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ExitCode } from "@openapi-to/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildConsumerSkillAssets,
	consumerSkillNames,
} from "../../../scripts/build-consumer-skill-assets.mjs";
import { type CLIIO, run } from "./index.ts";
import {
	installCodexSkills,
	parseSkillsInstallRequest,
	SkillsInstallError,
	skillsInstallHumanOutput,
} from "./skillsInstall.ts";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../..",
);
const packageVersion = "9.8.7-test";

async function filesBelow(root: string, relativeDirectory = "") {
	const directory = path.join(
		root,
		...relativeDirectory.split("/").filter(Boolean),
	);
	const entries = (await readdir(directory, { withFileTypes: true })).sort(
		(left, right) =>
			left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
	);
	const files: Array<{ path: string; bytes: Buffer; sha256: string }> = [];
	for (const entry of entries) {
		const relativePath = relativeDirectory
			? `${relativeDirectory}/${entry.name}`
			: entry.name;
		if (entry.isDirectory()) {
			files.push(...(await filesBelow(root, relativePath)));
		} else if (entry.isFile()) {
			const bytes = await readFile(path.join(root, ...relativePath.split("/")));
			files.push({
				path: relativePath,
				bytes,
				sha256: createHash("sha256").update(bytes).digest("hex"),
			});
		}
	}
	return files;
}

describe.sequential("Codex Skill installer", () => {
	let root: string;
	let assetRoot: string;
	let codexHome: string;
	let dependencies: {
		assetRoot: string;
		environment: NodeJS.ProcessEnv;
		homeDirectory: () => string;
	};

	beforeEach(async () => {
		root = await mkdtemp(path.join(os.tmpdir(), "openapi-to-skills-install-"));
		const packageDirectory = path.join(root, "package");
		assetRoot = path.join(root, "assets");
		codexHome = path.join(root, "Codex Home 空格");
		await mkdir(packageDirectory, { recursive: true });
		await writeFile(
			path.join(packageDirectory, "package.json"),
			`${JSON.stringify({
				name: "@openapi-to/cli",
				version: packageVersion,
			})}\n`,
		);
		await buildConsumerSkillAssets({
			sourceRoot: path.join(repositoryRoot, ".agents", "skills"),
			packageDirectory,
			outputDirectory: assetRoot,
		});
		dependencies = {
			assetRoot,
			environment: { CODEX_HOME: codexHome },
			homeDirectory: () => path.join(root, "unused-home"),
		};
	});

	afterEach(async () => {
		process.exitCode = 0;
		vi.restoreAllMocks();
		await rm(root, { recursive: true, force: true });
	});

	it("requires exactly --host codex and rejects unsupported actions", () => {
		expect(() => parseSkillsInstallRequest("install", {})).toThrowError(
			expect.objectContaining({ code: "SKILLS_HOST_REQUIRED" }),
		);
		expect(() =>
			parseSkillsInstallRequest("install", { host: true }),
		).toThrowError(expect.objectContaining({ code: "SKILLS_HOST_EMPTY" }));
		expect(() =>
			parseSkillsInstallRequest("install", { host: ["codex", "codex"] }),
		).toThrowError(expect.objectContaining({ code: "SKILLS_HOST_DUPLICATE" }));
		expect(() =>
			parseSkillsInstallRequest("install", { host: "cursor" }),
		).toThrowError(
			expect.objectContaining({ code: "SKILLS_HOST_UNSUPPORTED" }),
		);
		expect(() =>
			parseSkillsInstallRequest("update", { host: "codex" }),
		).toThrowError(
			expect.objectContaining({ code: "SKILLS_ACTION_UNSUPPORTED" }),
		);
		expect(
			parseSkillsInstallRequest("install", {
				host: "codex",
				dryRun: true,
				json: true,
			}),
		).toEqual({ dryRun: true, json: true });
	});

	it("dry-runs with an exact JSON-ready plan and creates no CODEX_HOME", async () => {
		const output = await installCodexSkills(
			{ dryRun: true, json: true },
			packageVersion,
			dependencies,
		);
		expect(output).toMatchObject({
			success: true,
			command: "skills install",
			mode: "dry-run",
			host: "codex",
			packageVersion,
			source: "packaged-npm-assets",
			destinationRoot: path.join(codexHome, "skills"),
			skills: consumerSkillNames,
			installed: [],
			restartRequired: true,
		});
		expect(output.actions).toEqual(
			consumerSkillNames.map((skill) => ({
				action: "install",
				skill,
				destination: path.join(codexHome, "skills", skill),
			})),
		);
		expect(JSON.parse(JSON.stringify(output))).toEqual(output);
		await expect(lstat(codexHome)).rejects.toMatchObject({ code: "ENOENT" });
		expect(skillsInstallHumanOutput(output)).toContain(
			"No files were written.",
		);
		expect(skillsInstallHumanOutput(output).join("\n")).not.toContain(root);
	});

	it("installs both Skills, verifies every byte, and requires restart", async () => {
		const output = await installCodexSkills(
			{ dryRun: false, json: true },
			packageVersion,
			dependencies,
		);
		expect(output).toMatchObject({
			mode: "install",
			installed: consumerSkillNames,
			restartRequired: true,
		});
		for (const name of consumerSkillNames) {
			const packaged = await filesBelow(path.join(assetRoot, name));
			const installed = await filesBelow(path.join(codexHome, "skills", name));
			expect(installed.map(({ path, sha256 }) => ({ path, sha256 }))).toEqual(
				packaged.map(({ path, sha256 }) => ({ path, sha256 })),
			);
			for (const [index, file] of installed.entries()) {
				expect(file.bytes).toEqual(packaged.at(index)?.bytes);
			}
		}
		expect(await readdir(path.join(codexHome, "skills"))).toEqual(
			consumerSkillNames,
		);
		expect(skillsInstallHumanOutput(output)).toContain("restartRequired: true");
	});

	it("fails before writing when either destination already exists", async () => {
		for (const conflict of consumerSkillNames) {
			await rm(codexHome, { recursive: true, force: true });
			const skillsRoot = path.join(codexHome, "skills");
			await mkdir(path.join(skillsRoot, conflict), { recursive: true });
			await writeFile(
				path.join(skillsRoot, conflict, "sentinel.txt"),
				"preserved\n",
			);
			const before = await filesBelow(codexHome);
			await expect(
				installCodexSkills(
					{ dryRun: false, json: true },
					packageVersion,
					dependencies,
				),
			).rejects.toMatchObject({ code: "SKILLS_DESTINATION_CONFLICT" });
			const after = await filesBelow(codexHome);
			expect(after).toEqual(before);
			const other = consumerSkillNames.find((name) => name !== conflict);
			expect(other).toBeDefined();
			await expect(
				lstat(path.join(skillsRoot, String(other))),
			).rejects.toMatchObject({
				code: "ENOENT",
			});
		}
	});

	it("rejects a destination symlink without following or modifying it", async (t) => {
		const skillsRoot = path.join(codexHome, "skills");
		const external = path.join(root, "external");
		await Promise.all([
			mkdir(skillsRoot, { recursive: true }),
			mkdir(external, { recursive: true }),
		]);
		try {
			await symlink(
				external,
				path.join(skillsRoot, "openapi-to-generate"),
				process.platform === "win32" ? "junction" : "dir",
			);
		} catch (error) {
			if (
				process.platform === "win32" &&
				["EPERM", "EACCES"].includes(
					(error as NodeJS.ErrnoException).code ?? "",
				)
			) {
				t.skip();
				return;
			}
			throw error;
		}
		await expect(
			installCodexSkills(
				{ dryRun: false, json: true },
				packageVersion,
				dependencies,
			),
		).rejects.toMatchObject({ code: "SKILLS_DESTINATION_CONFLICT" });
		expect(await readdir(external)).toEqual([]);
	});

	it("rolls back the first committed Skill when the second commit fails", async () => {
		const skillsRoot = path.join(codexHome, "skills");
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				beforeTargetCommit: async (skill) => {
					if (skill === "openapi-to-setup") {
						throw new Error("injected second commit failure");
					}
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_INSTALL_FAILED" });
		for (const name of consumerSkillNames) {
			await expect(lstat(path.join(skillsRoot, name))).rejects.toMatchObject({
				code: "ENOENT",
			});
		}
		await expect(lstat(skillsRoot)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("never overwrites a target that appears during commit", async () => {
		const skillsRoot = path.join(codexHome, "skills");
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				beforeTargetCommit: async (skill) => {
					if (skill === "openapi-to-generate") {
						await mkdir(path.join(skillsRoot, skill));
					}
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_DESTINATION_CONFLICT" });
		expect(await readdir(path.join(skillsRoot, "openapi-to-generate"))).toEqual(
			[],
		);
		await expect(
			lstat(path.join(skillsRoot, "openapi-to-setup")),
		).rejects.toMatchObject({ code: "ENOENT" });
		expect(await readdir(skillsRoot)).toEqual(["openapi-to-generate"]);
	});

	it("recovers a retained transaction before retrying the complete install", async () => {
		const skillsRoot = path.join(codexHome, "skills");
		const processId = 999_999;
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				processId,
				beforeTargetCommit: async (skill) => {
					if (skill === "openapi-to-setup") {
						throw new Error("injected second commit failure");
					}
				},
				beforeTargetRollback: async (skill) => {
					if (skill === "openapi-to-generate") {
						throw new Error("injected rollback failure");
					}
				},
				transactionNonce: () => "retained-transaction",
			}),
		).rejects.toMatchObject({ code: "SKILLS_INSTALL_RECOVERY_REQUIRED" });
		await expect(
			lstat(path.join(skillsRoot, "openapi-to-generate")),
		).resolves.toBeDefined();
		await expect(
			lstat(path.join(skillsRoot, "openapi-to-setup")),
		).rejects.toMatchObject({ code: "ENOENT" });

		const output = await installCodexSkills(
			{ dryRun: false, json: true },
			packageVersion,
			dependencies,
		);
		expect(output.installed).toEqual(consumerSkillNames);
		expect((await readdir(skillsRoot)).sort()).toEqual(consumerSkillNames);
	});

	it("recovers a partially materialized owned target before retrying", async () => {
		const skillsRoot = path.join(codexHome, "skills");
		const destination = path.join(skillsRoot, "openapi-to-generate");
		let injected = false;
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				processId: 999_999,
				transactionNonce: () => "partial-owned-target",
				writeFile: async (...arguments_) => {
					const target = String(arguments_[0]);
					if (
						!injected &&
						target.startsWith(`${destination}${path.sep}`) &&
						path.basename(target) !== ".openapi-to-install-owner"
					) {
						injected = true;
						throw new Error("injected target copy failure");
					}
					return writeFile(...arguments_);
				},
				beforeTargetRollback: async () => {
					throw new Error("retain transaction for recovery");
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_INSTALL_RECOVERY_REQUIRED" });
		expect(injected).toBe(true);
		expect(await readdir(destination)).toContain(".openapi-to-install-owner");

		const output = await installCodexSkills(
			{ dryRun: false, json: true },
			packageVersion,
			dependencies,
		);
		expect(output.installed).toEqual(consumerSkillNames);
		expect((await readdir(skillsRoot)).sort()).toEqual(consumerSkillNames);
	});

	it("reports success when retrying a fully committed interrupted transaction", async () => {
		const skillsRoot = path.join(codexHome, "skills");
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				processId: 999_999,
				transactionNonce: () => "complete-owned-targets",
				afterTargetCommit: async (_skill, index) => {
					if (index === consumerSkillNames.length - 1) {
						throw new Error("injected interruption after complete commit");
					}
				},
				beforeTargetRollback: async () => {
					throw new Error("retain completed transaction for recovery");
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_INSTALL_RECOVERY_REQUIRED" });
		expect((await readdir(skillsRoot)).sort()).toEqual([
			".openapi-to-skills-install-complete-owned-targets",
			".openapi-to-skills-install.lock",
			...consumerSkillNames,
		]);

		const output = await installCodexSkills(
			{ dryRun: false, json: true },
			packageVersion,
			dependencies,
		);
		expect(output).toMatchObject({
			success: true,
			mode: "install",
			installed: consumerSkillNames,
			restartRequired: true,
		});
		expect((await readdir(skillsRoot)).sort()).toEqual(consumerSkillNames);
	});

	it("preserves a replaced target during rollback for manual recovery", async () => {
		const skillsRoot = path.join(codexHome, "skills");
		const displaced = path.join(codexHome, "displaced-owned-skill");
		const replacement = path.join(skillsRoot, "openapi-to-generate");
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				beforeTargetCommit: async (skill) => {
					if (skill === "openapi-to-setup") {
						throw new Error("injected second commit failure");
					}
				},
				beforeTargetRollback: async (skill) => {
					if (skill === "openapi-to-generate") {
						await rename(replacement, displaced);
						await mkdir(replacement);
						await writeFile(
							path.join(replacement, "foreign.txt"),
							"preserved\n",
						);
					}
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_INSTALL_RECOVERY_REQUIRED" });
		expect(await readFile(path.join(replacement, "foreign.txt"), "utf8")).toBe(
			"preserved\n",
		);
		await expect(
			readFile(path.join(displaced, "SKILL.md"), "utf8"),
		).resolves.toContain("openapi-to-generate");
	});

	it("cleans staging and destinations after a copy failure", async () => {
		let writes = 0;
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				writeFile: async (...arguments_) => {
					writes += 1;
					if (writes === 2) throw new Error("injected copy failure");
					return writeFile(...arguments_);
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_INSTALL_FAILED" });
		expect(writes).toBe(2);
		await expect(lstat(codexHome)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("fails closed before staging without leaving a lock", async () => {
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				beforeStaging: async () => {
					throw new Error("injected staging failure");
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_INSTALL_FAILED" });
		await expect(lstat(codexHome)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("detects a replaced skills root before staging and never follows it", async (t) => {
		const skillsRoot = path.join(codexHome, "skills");
		const displaced = path.join(codexHome, "displaced-skills");
		const external = path.join(root, "external-race-target");
		await mkdir(external);
		let swapped = false;
		await expect(
			installCodexSkills({ dryRun: false, json: true }, packageVersion, {
				...dependencies,
				beforeStaging: async () => {
					await rename(skillsRoot, displaced);
					try {
						await symlink(
							external,
							skillsRoot,
							process.platform === "win32" ? "junction" : "dir",
						);
					} catch (error) {
						if (
							process.platform === "win32" &&
							["EPERM", "EACCES"].includes(
								(error as NodeJS.ErrnoException).code ?? "",
							)
						) {
							await rename(displaced, skillsRoot);
							t.skip();
							return;
						}
						throw error;
					}
					swapped = true;
				},
			}),
		).rejects.toMatchObject({ code: "SKILLS_DESTINATION_CHANGED" });
		if (!swapped) return;
		expect(await readdir(external)).toEqual([]);
		expect(await readdir(displaced)).toEqual([
			".openapi-to-skills-install.lock",
		]);
	});

	it("fails closed for missing, malformed, mismatched, or corrupted manifests", async () => {
		const manifestPath = path.join(assetRoot, "manifest.json");
		const original = await readFile(manifestPath);
		for (const mutation of [
			async () => rm(manifestPath),
			async () => writeFile(manifestPath, "{"),
			async () =>
				writeFile(
					manifestPath,
					original.toString().replace(packageVersion, "wrong-version"),
				),
		]) {
			await writeFile(manifestPath, original);
			await mutation();
			await expect(
				installCodexSkills(
					{ dryRun: true, json: true },
					packageVersion,
					dependencies,
				),
			).rejects.toBeInstanceOf(SkillsInstallError);
			await expect(lstat(codexHome)).rejects.toMatchObject({ code: "ENOENT" });
		}
		await writeFile(manifestPath, original);
		const target = path.join(assetRoot, "openapi-to-generate", "SKILL.md");
		await writeFile(target, `${await readFile(target, "utf8")}\ncorrupted\n`);
		await expect(
			installCodexSkills(
				{ dryRun: true, json: true },
				packageVersion,
				dependencies,
			),
		).rejects.toMatchObject({ code: "SKILLS_ASSET_INTEGRITY_FAILED" });
	});

	it("rejects empty/relative CODEX_HOME and invalid destination roots", async () => {
		for (const value of ["", "relative/codex"]) {
			await expect(
				installCodexSkills({ dryRun: true, json: true }, packageVersion, {
					...dependencies,
					environment: { CODEX_HOME: value },
				}),
			).rejects.toMatchObject({ code: "SKILLS_DESTINATION_INVALID" });
		}
		await writeFile(codexHome, "not a directory\n");
		await expect(
			installCodexSkills(
				{ dryRun: false, json: true },
				packageVersion,
				dependencies,
			),
		).rejects.toMatchObject({ code: "SKILLS_DESTINATION_INVALID" });
		await rm(codexHome);
		await mkdir(codexHome);
		await writeFile(path.join(codexHome, "skills"), "not a directory\n");
		await expect(
			installCodexSkills(
				{ dryRun: false, json: true },
				packageVersion,
				dependencies,
			),
		).rejects.toMatchObject({ code: "SKILLS_DESTINATION_INVALID" });
		await expect(
			installCodexSkills({ dryRun: true, json: true }, packageVersion, {
				...dependencies,
				environment: {},
				homeDirectory: () => "",
			}),
		).rejects.toMatchObject({ code: "SKILLS_DESTINATION_INVALID" });
	});

	it("uses ~/.codex when CODEX_HOME is unset", async () => {
		const home = path.join(root, "User Home");
		const output = await installCodexSkills(
			{ dryRun: true, json: true },
			packageVersion,
			{
				...dependencies,
				environment: {},
				homeDirectory: () => home,
			},
		);
		expect(output.destinationRoot).toBe(path.join(home, ".codex", "skills"));
		await expect(lstat(home)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("rejects a second install without modifying installed bytes", async () => {
		await installCodexSkills(
			{ dryRun: false, json: true },
			packageVersion,
			dependencies,
		);
		const before = await filesBelow(path.join(codexHome, "skills"));
		await expect(
			installCodexSkills(
				{ dryRun: false, json: true },
				packageVersion,
				dependencies,
			),
		).rejects.toMatchObject({ code: "SKILLS_DESTINATION_CONFLICT" });
		expect(await filesBelow(path.join(codexHome, "skills"))).toEqual(before);
	});
});

describe.sequential("skills command CLI contract", () => {
	let stdout: string[];
	let stderr: string[];
	let io: CLIIO;

	beforeEach(() => {
		stdout = [];
		stderr = [];
		io = {
			stdout: (message) => stdout.push(message),
			stderr: (message) => stderr.push(message),
		};
	});

	afterEach(() => {
		process.exitCode = 0;
		vi.restoreAllMocks();
	});

	it("emits stable JSON for host validation before or after the command", async () => {
		for (const argv of [
			["node", "openapi", "--json", "skills", "install"],
			["node", "openapi", "skills", "install", "--host", "cursor", "--json"],
			[
				"node",
				"openapi",
				"skills",
				"install",
				"--host",
				"codex",
				"--host",
				"codex",
				"--json",
			],
		]) {
			stdout = [];
			stderr = [];
			const result = await run(argv, io);
			expect(result.exitCode).toBe(ExitCode.GeneralError);
			expect(stderr).toEqual([]);
			expect(JSON.parse(stdout.join("\n"))).toMatchObject({
				success: false,
				command: "skills install",
				diagnostics: [{ code: expect.stringMatching(/^SKILLS_HOST_/) }],
			});
		}
	});

	it("rejects overwrite flags through the existing CLI error contract", async () => {
		const result = await run(
			[
				"node",
				"openapi",
				"skills",
				"install",
				"--host",
				"codex",
				"--force",
				"--json",
			],
			io,
		);
		expect(result.exitCode).toBe(ExitCode.GeneralError);
		expect(stderr).toEqual([]);
		expect(JSON.parse(stdout.join("\n"))).toMatchObject({
			success: false,
			diagnostics: [{ code: "CLI_EXECUTION_FAILED" }],
		});
	});

	it("shows focused help without running the installer", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const result = await run(
			["node", "openapi", "skills", "install", "--help"],
			io,
		);
		expect(result.exitCode).toBe(ExitCode.Success);
		expect(log.mock.calls.flat().join("\n")).toContain(
			"skills install --host codex",
		);
		expect(stdout).toEqual([]);
		expect(stderr).toEqual([]);
	});
});
