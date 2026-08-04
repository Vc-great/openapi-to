import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
	access,
	lstat,
	mkdir,
	readdir,
	readFile,
	rm,
	rmdir,
	unlink,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const supportedSkillNames = [
	"openapi-to-generate",
	"openapi-to-setup",
] as const;
const manifestByteLimit = 1024 * 1024;
const skillFileByteLimit = 16 * 1024 * 1024;
const distributionByteLimit = 64 * 1024 * 1024;
const installLockName = ".openapi-to-skills-install.lock";
const installJournalName = "transaction.json";
const stagingDirectoryPrefix = ".openapi-to-skills-install-";
const installJournalByteLimit = 16 * 1024;
const targetOwnerMarkerName = ".openapi-to-install-owner";
const activeTransactionNonces = new Set<string>();

type SupportedSkillName = (typeof supportedSkillNames)[number];

interface SkillFileManifest {
	path: string;
	size: number;
	sha256: string;
}

interface SkillManifest {
	name: SupportedSkillName;
	files: SkillFileManifest[];
}

interface DistributionManifest {
	schemaVersion: 1;
	packageVersion: string;
	skills: SkillManifest[];
}

interface VerifiedSkillFile extends SkillFileManifest {
	bytes: Buffer;
}

interface VerifiedSkill {
	name: SupportedSkillName;
	files: VerifiedSkillFile[];
}

interface InstallJournal {
	schemaVersion: 1;
	packageVersion: string;
	pid: number;
	nonce: string;
	stagingDirectory: string;
	skills: SupportedSkillName[];
}

interface FileIdentity {
	device: string;
	inode: string;
}

interface DestinationIdentity {
	codexHome: FileIdentity;
	skillsRoot: FileIdentity;
	lock: FileIdentity;
}

interface OwnedSkillTarget {
	skill: VerifiedSkill;
	identity: FileIdentity;
	markerPresent: boolean;
}

export interface SkillsInstallRequest {
	dryRun: boolean;
	json: boolean;
}

export interface SkillsInstallDependencies {
	assetRoot?: string;
	environment?: NodeJS.ProcessEnv;
	homeDirectory?: () => string;
	beforeStaging?: () => Promise<void>;
	beforeTargetCommit?: (
		skill: SupportedSkillName,
		index: number,
	) => Promise<void>;
	afterTargetCommit?: (
		skill: SupportedSkillName,
		index: number,
	) => Promise<void>;
	beforeTargetRollback?: (skill: SupportedSkillName) => Promise<void>;
	processId?: number;
	remove?: typeof rm;
	transactionNonce?: () => string;
	writeFile?: typeof writeFile;
}

export interface SkillsInstallOutput {
	success: true;
	command: "skills install";
	mode: "dry-run" | "install";
	host: "codex";
	packageVersion: string;
	source: "packaged-npm-assets";
	destinationRoot: string;
	skills: SupportedSkillName[];
	actions: Array<{
		action: "install";
		skill: SupportedSkillName;
		destination: string;
	}>;
	installed: SupportedSkillName[];
	restartRequired: true;
}

export class SkillsInstallError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "SkillsInstallError";
		this.code = code;
	}
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function safeRelativePath(relativePath: unknown): relativePath is string {
	return (
		typeof relativePath === "string" &&
		relativePath.length > 0 &&
		!relativePath.includes("\\") &&
		!relativePath.includes("\0") &&
		!path.posix.isAbsolute(relativePath) &&
		path.posix.normalize(relativePath) === relativePath &&
		relativePath !== "." &&
		!relativePath.startsWith("../") &&
		relativePath.split("/").every((segment) => segment.length > 0)
	);
}

function fail(code: string, message: string): never {
	throw new SkillsInstallError(code, message);
}

async function lstatIfPresent(target: string) {
	try {
		return await lstat(target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

function fileIdentity(details: { dev: bigint | number; ino: bigint | number }) {
	return {
		device: details.dev.toString(),
		inode: details.ino.toString(),
	};
}

function sameIdentity(
	details: { dev: bigint | number; ino: bigint | number },
	expected: FileIdentity,
) {
	return (
		details.dev.toString() === expected.device &&
		details.ino.toString() === expected.inode
	);
}

async function captureDestinationIdentity(
	codexHome: string,
	skillsRoot: string,
	lockPath: string,
): Promise<DestinationIdentity> {
	try {
		const [home, root, lock] = await Promise.all([
			lstat(codexHome, { bigint: true }),
			lstat(skillsRoot, { bigint: true }),
			lstat(lockPath, { bigint: true }),
		]);
		if (
			home.isSymbolicLink() ||
			!home.isDirectory() ||
			root.isSymbolicLink() ||
			!root.isDirectory() ||
			lock.isSymbolicLink() ||
			!lock.isDirectory()
		) {
			return fail(
				"SKILLS_DESTINATION_CHANGED",
				"The Codex Skill destination changed during installation and requires manual inspection.",
			);
		}
		return {
			codexHome: fileIdentity(home),
			skillsRoot: fileIdentity(root),
			lock: fileIdentity(lock),
		};
	} catch (error) {
		if (error instanceof SkillsInstallError) throw error;
		return fail(
			"SKILLS_DESTINATION_CHANGED",
			"The Codex Skill destination changed during installation and requires manual inspection.",
		);
	}
}

async function assertDestinationStable(
	codexHome: string,
	skillsRoot: string,
	lockPath: string,
	expected: DestinationIdentity,
) {
	try {
		const [home, root, lock] = await Promise.all([
			lstat(codexHome, { bigint: true }),
			lstat(skillsRoot, { bigint: true }),
			lstat(lockPath, { bigint: true }),
		]);
		if (
			home.isSymbolicLink() ||
			!home.isDirectory() ||
			!sameIdentity(home, expected.codexHome) ||
			root.isSymbolicLink() ||
			!root.isDirectory() ||
			!sameIdentity(root, expected.skillsRoot) ||
			lock.isSymbolicLink() ||
			!lock.isDirectory() ||
			!sameIdentity(lock, expected.lock)
		) {
			return fail(
				"SKILLS_DESTINATION_CHANGED",
				"The Codex Skill destination changed during installation and requires manual inspection.",
			);
		}
	} catch (error) {
		if (error instanceof SkillsInstallError) throw error;
		return fail(
			"SKILLS_DESTINATION_CHANGED",
			"The Codex Skill destination changed during installation and requires manual inspection.",
		);
	}
}

async function destinationIsStable(
	codexHome: string,
	skillsRoot: string,
	lockPath: string,
	expected: DestinationIdentity,
) {
	try {
		await assertDestinationStable(codexHome, skillsRoot, lockPath, expected);
		return true;
	} catch {
		return false;
	}
}

function validateManifest(
	value: unknown,
	expectedPackageVersion: string,
): DistributionManifest {
	if (
		!value ||
		typeof value !== "object" ||
		(value as { schemaVersion?: unknown }).schemaVersion !== 1 ||
		(value as { packageVersion?: unknown }).packageVersion !==
			expectedPackageVersion ||
		!Array.isArray((value as { skills?: unknown }).skills)
	) {
		return fail(
			"SKILLS_MANIFEST_INVALID",
			"The packaged Skill manifest is missing, malformed, or does not match this package version.",
		);
	}
	const skills = (value as { skills: unknown[] }).skills;
	if (
		skills.length !== supportedSkillNames.length ||
		skills.some(
			(skill, index) =>
				!skill ||
				typeof skill !== "object" ||
				(skill as { name?: unknown }).name !== supportedSkillNames[index] ||
				!Array.isArray((skill as { files?: unknown }).files),
		)
	) {
		return fail(
			"SKILLS_MANIFEST_INVALID",
			"The packaged Skill manifest must contain exactly the supported Codex Skills in stable order.",
		);
	}
	for (const skill of skills as SkillManifest[]) {
		const paths = new Set<string>();
		if (skill.files.length === 0) {
			return fail(
				"SKILLS_MANIFEST_INVALID",
				`The packaged Skill manifest contains no files for ${skill.name}.`,
			);
		}
		for (const file of skill.files) {
			if (
				!file ||
				typeof file !== "object" ||
				!safeRelativePath(file.path) ||
				!Number.isSafeInteger(file.size) ||
				file.size <= 0 ||
				file.size > skillFileByteLimit ||
				typeof file.sha256 !== "string" ||
				!/^[a-f0-9]{64}$/.test(file.sha256) ||
				paths.has(file.path)
			) {
				return fail(
					"SKILLS_MANIFEST_INVALID",
					`The packaged Skill manifest contains an invalid file record for ${skill.name}.`,
				);
			}
			paths.add(file.path);
		}
		if (!paths.has("SKILL.md")) {
			return fail(
				"SKILLS_MANIFEST_INVALID",
				`The packaged Skill manifest is missing ${skill.name}/SKILL.md.`,
			);
		}
	}
	return value as DistributionManifest;
}

async function listSkillTree(
	root: string,
	relativeDirectory = "",
): Promise<{ directories: string[]; files: string[] }> {
	const directory = path.join(
		root,
		...relativeDirectory.split("/").filter(Boolean),
	);
	const entries = (await readdir(directory, { withFileTypes: true })).sort(
		(left, right) => compareText(left.name, right.name),
	);
	const tree = { directories: [] as string[], files: [] as string[] };
	for (const entry of entries) {
		const relativePath = relativeDirectory
			? `${relativeDirectory}/${entry.name}`
			: entry.name;
		if (!safeRelativePath(relativePath)) {
			return fail(
				"SKILLS_ASSET_INTEGRITY_FAILED",
				"The packaged Skill assets contain an unsafe path.",
			);
		}
		const absolutePath = path.join(root, ...relativePath.split("/"));
		const details = await lstat(absolutePath);
		if (details.isSymbolicLink()) {
			return fail(
				"SKILLS_ASSET_INTEGRITY_FAILED",
				`The packaged Skill assets contain a symlink at ${relativePath}.`,
			);
		}
		if (details.isDirectory()) {
			tree.directories.push(relativePath);
			const nested = await listSkillTree(root, relativePath);
			tree.directories.push(...nested.directories);
			tree.files.push(...nested.files);
			continue;
		}
		if (!details.isFile()) {
			return fail(
				"SKILLS_ASSET_INTEGRITY_FAILED",
				`The packaged Skill assets contain a non-regular file at ${relativePath}.`,
			);
		}
		tree.files.push(relativePath);
	}
	return tree;
}

async function listRegularFiles(
	root: string,
	relativeDirectory = "",
): Promise<string[]> {
	return (await listSkillTree(root, relativeDirectory)).files;
}

async function verifyPackagedSkills(
	assetRoot: string,
	expectedPackageVersion: string,
): Promise<VerifiedSkill[]> {
	const rootDetails = await lstatIfPresent(assetRoot);
	if (!rootDetails?.isDirectory() || rootDetails.isSymbolicLink()) {
		return fail(
			"SKILLS_MANIFEST_INVALID",
			"The packaged Skill asset directory is missing or invalid.",
		);
	}
	const rootEntries = (await readdir(assetRoot, { withFileTypes: true })).sort(
		(left, right) => compareText(left.name, right.name),
	);
	const expectedRootEntries = ["manifest.json", ...supportedSkillNames].sort(
		compareText,
	);
	if (
		JSON.stringify(rootEntries.map(({ name }) => name)) !==
		JSON.stringify(expectedRootEntries)
	) {
		return fail(
			"SKILLS_ASSET_INTEGRITY_FAILED",
			"The packaged Skill asset directory contains an unexpected file set.",
		);
	}
	for (const entry of rootEntries) {
		if (entry.isSymbolicLink()) {
			return fail(
				"SKILLS_ASSET_INTEGRITY_FAILED",
				"The packaged Skill asset directory contains a symlink.",
			);
		}
		if (
			(entry.name === "manifest.json" && !entry.isFile()) ||
			(entry.name !== "manifest.json" && !entry.isDirectory())
		) {
			return fail(
				"SKILLS_ASSET_INTEGRITY_FAILED",
				"The packaged Skill asset directory has an invalid structure.",
			);
		}
	}
	const manifestPath = path.join(assetRoot, "manifest.json");
	const manifestDetails = await lstat(manifestPath);
	if (
		manifestDetails.isSymbolicLink() ||
		!manifestDetails.isFile() ||
		manifestDetails.size > manifestByteLimit
	) {
		return fail(
			"SKILLS_MANIFEST_INVALID",
			"The packaged Skill manifest is missing or exceeds its safety limit.",
		);
	}
	let parsedManifest: unknown;
	try {
		parsedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
	} catch {
		return fail(
			"SKILLS_MANIFEST_INVALID",
			"The packaged Skill manifest is not valid JSON.",
		);
	}
	const manifest = validateManifest(parsedManifest, expectedPackageVersion);
	let totalBytes = 0;
	const verified: VerifiedSkill[] = [];
	for (const skill of manifest.skills) {
		const skillRoot = path.join(assetRoot, skill.name);
		const rootDetails = await lstat(skillRoot);
		if (rootDetails.isSymbolicLink() || !rootDetails.isDirectory()) {
			return fail(
				"SKILLS_ASSET_INTEGRITY_FAILED",
				`The packaged Skill directory is invalid for ${skill.name}.`,
			);
		}
		const actualPaths = await listRegularFiles(skillRoot);
		const declaredPaths = skill.files.map(({ path }) => path);
		if (JSON.stringify(actualPaths) !== JSON.stringify(declaredPaths)) {
			return fail(
				"SKILLS_ASSET_INTEGRITY_FAILED",
				`The packaged file set does not match the manifest for ${skill.name}.`,
			);
		}
		const files: VerifiedSkillFile[] = [];
		for (const file of skill.files) {
			const absolutePath = path.join(skillRoot, ...file.path.split("/"));
			const details = await lstat(absolutePath);
			if (
				details.isSymbolicLink() ||
				!details.isFile() ||
				details.size !== file.size
			) {
				return fail(
					"SKILLS_ASSET_INTEGRITY_FAILED",
					`The packaged bytes do not match the manifest for ${skill.name}/${file.path}.`,
				);
			}
			totalBytes += details.size;
			if (totalBytes > distributionByteLimit) {
				return fail(
					"SKILLS_ASSET_INTEGRITY_FAILED",
					"The packaged Skill assets exceed their safety limit.",
				);
			}
			const bytes = await readFile(absolutePath);
			const sha256 = createHash("sha256").update(bytes).digest("hex");
			if (sha256 !== file.sha256) {
				return fail(
					"SKILLS_ASSET_INTEGRITY_FAILED",
					`The packaged bytes do not match the manifest for ${skill.name}/${file.path}.`,
				);
			}
			files.push({ ...file, bytes });
		}
		verified.push({ name: skill.name, files });
	}
	return verified;
}

function resolveCodexHome(
	environment: NodeJS.ProcessEnv,
	homeDirectory: () => string,
): string {
	const configured = Object.hasOwn(environment, "CODEX_HOME");
	const rawCodexHome = configured
		? environment.CODEX_HOME
		: path.join(homeDirectory(), ".codex");
	if (typeof rawCodexHome !== "string" || rawCodexHome.length === 0) {
		return fail(
			"SKILLS_DESTINATION_INVALID",
			"CODEX_HOME must be a non-empty absolute path; only the Codex Host is supported.",
		);
	}
	if (!path.isAbsolute(rawCodexHome)) {
		return fail(
			"SKILLS_DESTINATION_INVALID",
			"CODEX_HOME must be an absolute path; only the Codex Host is supported.",
		);
	}
	const normalized = path.resolve(rawCodexHome);
	if (normalized === path.parse(normalized).root) {
		return fail(
			"SKILLS_DESTINATION_INVALID",
			"CODEX_HOME must not be a filesystem root.",
		);
	}
	return normalized;
}

async function preflightDestination(
	codexHome: string,
	skillsRoot: string,
	options: { checkConflicts?: boolean; checkLock?: boolean } = {},
): Promise<{ codexHomePresent: boolean; skillsRootPresent: boolean }> {
	let codexHomeDetails: Awaited<ReturnType<typeof lstat>> | undefined;
	let skillsRootDetails: Awaited<ReturnType<typeof lstat>> | undefined;
	try {
		codexHomeDetails = await lstatIfPresent(codexHome);
		skillsRootDetails = await lstatIfPresent(skillsRoot);
	} catch {
		return fail(
			"SKILLS_DESTINATION_INVALID",
			"The Codex Skill destination cannot be inspected safely.",
		);
	}
	if (
		codexHomeDetails &&
		(codexHomeDetails.isSymbolicLink() || !codexHomeDetails.isDirectory())
	) {
		return fail(
			"SKILLS_DESTINATION_INVALID",
			"CODEX_HOME must be a real directory, not a file or symlink.",
		);
	}
	if (
		skillsRootDetails &&
		(skillsRootDetails.isSymbolicLink() || !skillsRootDetails.isDirectory())
	) {
		return fail(
			"SKILLS_DESTINATION_INVALID",
			"The Codex skills root must be a real directory, not a file or symlink.",
		);
	}
	if (skillsRootDetails) {
		try {
			await access(skillsRoot, constants.W_OK);
		} catch {
			return fail(
				"SKILLS_DESTINATION_INVALID",
				"The Codex skills root is not writable.",
			);
		}
	}
	if (options.checkConflicts !== false) {
		const conflicts: SupportedSkillName[] = [];
		for (const name of supportedSkillNames) {
			try {
				if (await lstatIfPresent(path.join(skillsRoot, name))) {
					conflicts.push(name);
				}
			} catch {
				return fail(
					"SKILLS_DESTINATION_INVALID",
					"The Codex Skill destinations cannot be inspected safely.",
				);
			}
		}
		if (conflicts.length > 0) {
			return fail(
				"SKILLS_DESTINATION_CONFLICT",
				`Codex Skill destination already exists for: ${conflicts.join(", ")}. Inspect it manually; this installer never overwrites or merges.`,
			);
		}
	}
	if (
		options.checkLock !== false &&
		(await lstatIfPresent(path.join(skillsRoot, installLockName)))
	) {
		return fail(
			"SKILLS_INSTALL_BUSY",
			"A Codex Skill installation is already active or requires manual inspection.",
		);
	}
	return {
		codexHomePresent: codexHomeDetails !== undefined,
		skillsRootPresent: skillsRootDetails !== undefined,
	};
}

async function writeStagedSkills(
	stagingRoot: string,
	skills: VerifiedSkill[],
	write: typeof writeFile,
) {
	for (const skill of skills) {
		for (const file of skill.files) {
			const destination = path.join(
				stagingRoot,
				skill.name,
				...file.path.split("/"),
			);
			await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
			await write(destination, file.bytes, { flag: "wx", mode: 0o644 });
		}
	}
}

async function verifyInstalledSkill(
	root: string,
	skill: VerifiedSkill,
): Promise<void> {
	const actualPaths = await listRegularFiles(root);
	if (
		JSON.stringify(actualPaths) !==
		JSON.stringify(skill.files.map(({ path }) => path))
	) {
		return fail(
			"SKILLS_INSTALL_VERIFICATION_FAILED",
			`Installed file verification failed for ${skill.name}.`,
		);
	}
	for (const file of skill.files) {
		const bytes = await readFile(path.join(root, ...file.path.split("/")));
		if (
			bytes.byteLength !== file.size ||
			createHash("sha256").update(bytes).digest("hex") !== file.sha256
		) {
			return fail(
				"SKILLS_INSTALL_VERIFICATION_FAILED",
				`Installed byte verification failed for ${skill.name}/${file.path}.`,
			);
		}
	}
}

function expectedSkillDirectories(skill: VerifiedSkill) {
	const directories = new Set<string>();
	for (const file of skill.files) {
		const segments = file.path.split("/");
		for (let index = 1; index < segments.length; index += 1) {
			directories.add(segments.slice(0, index).join("/"));
		}
	}
	return directories;
}

async function captureOwnedSkillTarget(
	root: string,
	skill: VerifiedSkill,
	markerPresent: boolean,
): Promise<OwnedSkillTarget> {
	const details = await lstat(root, { bigint: true });
	if (details.isSymbolicLink() || !details.isDirectory()) {
		return fail(
			"SKILLS_DESTINATION_CHANGED",
			`The Codex Skill destination changed during installation for ${skill.name}.`,
		);
	}
	return {
		skill,
		identity: fileIdentity(details),
		markerPresent,
	};
}

async function assertOwnedSkillTarget(
	root: string,
	target: OwnedSkillTarget,
	code:
		| "SKILLS_DESTINATION_CHANGED"
		| "SKILLS_INSTALL_RECOVERY_REQUIRED" = "SKILLS_DESTINATION_CHANGED",
) {
	try {
		const details = await lstat(root, { bigint: true });
		if (
			details.isSymbolicLink() ||
			!details.isDirectory() ||
			!sameIdentity(details, target.identity)
		) {
			return fail(
				code,
				`The Codex Skill destination changed during installation for ${target.skill.name}.`,
			);
		}
	} catch (error) {
		if (error instanceof SkillsInstallError) throw error;
		return fail(
			code,
			`The Codex Skill destination changed during installation for ${target.skill.name}.`,
		);
	}
}

function ownerMarkerBytes(nonce: string) {
	return Buffer.from(`${nonce}\n`, "utf8");
}

async function verifyRemovableSkillTarget(
	root: string,
	target: OwnedSkillTarget,
	nonce: string,
	allowIncompleteWithoutMarker = false,
) {
	await assertOwnedSkillTarget(
		root,
		target,
		"SKILLS_INSTALL_RECOVERY_REQUIRED",
	);
	const tree = await listSkillTree(root);
	const expectedDirectories = expectedSkillDirectories(target.skill);
	if (
		tree.directories.some((directory) => !expectedDirectories.has(directory))
	) {
		return fail(
			"SKILLS_INSTALL_RECOVERY_REQUIRED",
			`Codex Skill installation recovery found unexpected directories for ${target.skill.name}.`,
		);
	}
	const expectedFiles = new Map(
		target.skill.files.map((file) => [file.path, file]),
	);
	const markerPath = path.join(root, targetOwnerMarkerName);
	const markerListed = tree.files.includes(targetOwnerMarkerName);
	if (target.markerPresent !== markerListed) {
		return fail(
			"SKILLS_INSTALL_RECOVERY_REQUIRED",
			`Codex Skill installation recovery could not prove ownership for ${target.skill.name}.`,
		);
	}
	if (markerListed) {
		const marker = await readFile(markerPath);
		if (!marker.equals(ownerMarkerBytes(nonce))) {
			return fail(
				"SKILLS_INSTALL_RECOVERY_REQUIRED",
				`Codex Skill installation recovery found invalid ownership for ${target.skill.name}.`,
			);
		}
	}
	const actualSkillFiles = tree.files.filter(
		(file) => file !== targetOwnerMarkerName,
	);
	for (const relativePath of actualSkillFiles) {
		const expected = expectedFiles.get(relativePath);
		if (!expected) {
			return fail(
				"SKILLS_INSTALL_RECOVERY_REQUIRED",
				`Codex Skill installation recovery found unexpected files for ${target.skill.name}.`,
			);
		}
		const bytes = await readFile(path.join(root, ...relativePath.split("/")));
		if (
			bytes.byteLength !== expected.size ||
			createHash("sha256").update(bytes).digest("hex") !== expected.sha256
		) {
			return fail(
				"SKILLS_INSTALL_RECOVERY_REQUIRED",
				`Codex Skill installation recovery found changed bytes for ${target.skill.name}.`,
			);
		}
	}
	if (
		!markerListed &&
		!allowIncompleteWithoutMarker &&
		actualSkillFiles.length !== target.skill.files.length
	) {
		return fail(
			"SKILLS_INSTALL_RECOVERY_REQUIRED",
			`Codex Skill installation recovery could not prove a complete target for ${target.skill.name}.`,
		);
	}
	await assertOwnedSkillTarget(
		root,
		target,
		"SKILLS_INSTALL_RECOVERY_REQUIRED",
	);
}

async function materializeReservedSkill(
	root: string,
	target: OwnedSkillTarget,
	nonce: string,
	write: typeof writeFile,
) {
	await write(path.join(root, targetOwnerMarkerName), ownerMarkerBytes(nonce), {
		flag: "wx",
		mode: 0o600,
	});
	target.markerPresent = true;
	await assertOwnedSkillTarget(root, target);
	await verifyRemovableSkillTarget(root, target, nonce, true);
	for (const file of target.skill.files) {
		const destination = path.join(root, ...file.path.split("/"));
		await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
		await verifyRemovableSkillTarget(root, target, nonce, true);
		await write(destination, file.bytes, { flag: "wx", mode: 0o644 });
		await verifyRemovableSkillTarget(root, target, nonce, true);
	}
	await unlink(path.join(root, targetOwnerMarkerName));
	target.markerPresent = false;
	await assertOwnedSkillTarget(root, target);
	await verifyInstalledSkill(root, target.skill);
	await assertOwnedSkillTarget(root, target);
}

function validateTransactionNonce(nonce: string) {
	if (!/^[a-zA-Z0-9-]{1,128}$/.test(nonce)) {
		return fail(
			"SKILLS_INSTALL_FAILED",
			"Codex Skill installation could not create a safe transaction identifier.",
		);
	}
	return nonce;
}

function validateInstallJournal(
	value: unknown,
	expectedPackageVersion: string,
): InstallJournal {
	if (
		!value ||
		typeof value !== "object" ||
		(value as { schemaVersion?: unknown }).schemaVersion !== 1 ||
		(value as { packageVersion?: unknown }).packageVersion !==
			expectedPackageVersion ||
		!Number.isSafeInteger((value as { pid?: unknown }).pid) ||
		((value as { pid: number }).pid ?? 0) <= 0 ||
		typeof (value as { nonce?: unknown }).nonce !== "string" ||
		!Array.isArray((value as { skills?: unknown }).skills)
	) {
		return fail(
			"SKILLS_INSTALL_RECOVERY_REQUIRED",
			"An interrupted Codex Skill installation requires manual inspection.",
		);
	}
	const journal = value as InstallJournal;
	if (
		!/^[a-zA-Z0-9-]{1,128}$/.test(journal.nonce) ||
		journal.stagingDirectory !== `${stagingDirectoryPrefix}${journal.nonce}` ||
		JSON.stringify(journal.skills) !== JSON.stringify(supportedSkillNames)
	) {
		return fail(
			"SKILLS_INSTALL_RECOVERY_REQUIRED",
			"An interrupted Codex Skill installation requires manual inspection.",
		);
	}
	return journal;
}

async function writeInstallJournal(
	lockPath: string,
	journal: InstallJournal,
): Promise<void> {
	await writeFile(
		path.join(lockPath, installJournalName),
		`${JSON.stringify(journal, null, 2)}\n`,
		{ flag: "wx", mode: 0o600 },
	);
}

async function readInstallJournal(
	lockPath: string,
	expectedPackageVersion: string,
): Promise<InstallJournal> {
	try {
		const entries = await readdir(lockPath, { withFileTypes: true });
		if (
			entries.length !== 1 ||
			entries[0]?.name !== installJournalName ||
			!entries[0].isFile() ||
			entries[0].isSymbolicLink()
		) {
			return fail(
				"SKILLS_INSTALL_RECOVERY_REQUIRED",
				"An interrupted Codex Skill installation requires manual inspection.",
			);
		}
		const journalPath = path.join(lockPath, installJournalName);
		const details = await lstat(journalPath);
		if (
			details.isSymbolicLink() ||
			!details.isFile() ||
			details.size <= 0 ||
			details.size > installJournalByteLimit
		) {
			return fail(
				"SKILLS_INSTALL_RECOVERY_REQUIRED",
				"An interrupted Codex Skill installation requires manual inspection.",
			);
		}
		return validateInstallJournal(
			JSON.parse(await readFile(journalPath, "utf8")),
			expectedPackageVersion,
		);
	} catch (error) {
		if (error instanceof SkillsInstallError) throw error;
		return fail(
			"SKILLS_INSTALL_RECOVERY_REQUIRED",
			"An interrupted Codex Skill installation requires manual inspection.",
		);
	}
}

function processIsActive(pid: number, nonce: string) {
	if (pid === process.pid) return activeTransactionNonces.has(nonce);
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== "ESRCH";
	}
}

async function assertOwnedDirectory(target: string, message: string) {
	const details = await lstatIfPresent(target);
	if (!details) return false;
	if (details.isSymbolicLink() || !details.isDirectory()) {
		return fail("SKILLS_INSTALL_RECOVERY_REQUIRED", message);
	}
	return true;
}

async function cleanupTransaction(
	lockPath: string,
	stagingRoot: string,
	stagingCreated: boolean,
) {
	if (
		stagingCreated &&
		(await assertOwnedDirectory(
			stagingRoot,
			"An interrupted Codex Skill staging path requires manual inspection.",
		))
	) {
		await rm(stagingRoot, { recursive: true, force: false });
	}
	await unlink(path.join(lockPath, installJournalName)).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		},
	);
	await rmdir(lockPath);
}

async function recoverInterruptedInstallation(
	codexHome: string,
	skillsRoot: string,
	packageVersion: string,
	skills: VerifiedSkill[],
) {
	const lockPath = path.join(skillsRoot, installLockName);
	const lockDetails = await lstatIfPresent(lockPath);
	if (!lockDetails) return false;
	if (lockDetails.isSymbolicLink() || !lockDetails.isDirectory()) {
		return fail(
			"SKILLS_INSTALL_RECOVERY_REQUIRED",
			"An interrupted Codex Skill installation requires manual inspection.",
		);
	}
	const initialLockEntries = await readdir(lockPath);
	if (initialLockEntries.length === 0) {
		const identity = await captureDestinationIdentity(
			codexHome,
			skillsRoot,
			lockPath,
		);
		await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
		await rmdir(lockPath);
		return false;
	}
	const journal = await readInstallJournal(lockPath, packageVersion);
	if (processIsActive(journal.pid, journal.nonce)) {
		return fail(
			"SKILLS_INSTALL_BUSY",
			"A Codex Skill installation is already active or requires manual inspection.",
		);
	}
	const stagingRoot = path.join(skillsRoot, journal.stagingDirectory);
	const identity = await captureDestinationIdentity(
		codexHome,
		skillsRoot,
		lockPath,
	);
	await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
	const stagingPresent = await assertOwnedDirectory(
		stagingRoot,
		"An interrupted Codex Skill staging path requires manual inspection.",
	);
	const ownedTargets: OwnedSkillTarget[] = [];
	for (const skill of skills) {
		const destination = path.join(skillsRoot, skill.name);
		const destinationDetails = await lstatIfPresent(destination);
		if (destinationDetails) {
			if (
				destinationDetails.isSymbolicLink() ||
				!destinationDetails.isDirectory()
			) {
				return fail(
					"SKILLS_INSTALL_RECOVERY_REQUIRED",
					"An interrupted Codex Skill installation requires manual inspection.",
				);
			}
			const markerDetails = await lstatIfPresent(
				path.join(destination, targetOwnerMarkerName),
			);
			const target = await captureOwnedSkillTarget(
				destination,
				skill,
				markerDetails !== undefined,
			);
			try {
				if (markerDetails) {
					if (markerDetails.isSymbolicLink() || !markerDetails.isFile()) {
						throw new Error("invalid owner marker");
					}
					await verifyRemovableSkillTarget(destination, target, journal.nonce);
				} else {
					await verifyInstalledSkill(destination, skill);
					await assertOwnedSkillTarget(
						destination,
						target,
						"SKILLS_INSTALL_RECOVERY_REQUIRED",
					);
				}
			} catch {
				return fail(
					"SKILLS_INSTALL_RECOVERY_REQUIRED",
					"An interrupted Codex Skill installation requires manual inspection.",
				);
			}
			ownedTargets.push(target);
		}
	}
	const installationComplete =
		ownedTargets.length === skills.length &&
		ownedTargets.every((target) => !target.markerPresent);
	if (!installationComplete) {
		for (const target of [...ownedTargets].reverse()) {
			const destination = path.join(skillsRoot, target.skill.name);
			await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
			await verifyRemovableSkillTarget(destination, target, journal.nonce);
			await rm(destination, { recursive: true, force: false });
			await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
		}
	}
	await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
	await cleanupTransaction(lockPath, stagingRoot, stagingPresent);
	return installationComplete;
}

async function commitStagedSkills(
	skillsRoot: string,
	skills: VerifiedSkill[],
	nonce: string,
	write: typeof writeFile,
	remove: typeof rm,
	assertStable: () => Promise<void>,
	beforeTargetCommit?: SkillsInstallDependencies["beforeTargetCommit"],
	afterTargetCommit?: SkillsInstallDependencies["afterTargetCommit"],
	beforeTargetRollback?: SkillsInstallDependencies["beforeTargetRollback"],
) {
	const ownedTargets: OwnedSkillTarget[] = [];
	try {
		for (const [index, skill] of skills.entries()) {
			await assertStable();
			await beforeTargetCommit?.(skill.name, index);
			await assertStable();
			const destination = path.join(skillsRoot, skill.name);
			try {
				await mkdir(destination, { mode: 0o700 });
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				return fail(
					"SKILLS_DESTINATION_CONFLICT",
					`Codex Skill destination already exists for: ${skill.name}. Inspect it manually; this installer never overwrites or merges.`,
				);
			}
			const target = await captureOwnedSkillTarget(destination, skill, false);
			ownedTargets.push(target);
			await materializeReservedSkill(destination, target, nonce, write);
			await afterTargetCommit?.(skill.name, index);
			await assertStable();
		}
	} catch (error) {
		const rollbackFailures: SupportedSkillName[] = [];
		for (const target of [...ownedTargets].reverse()) {
			try {
				await beforeTargetRollback?.(target.skill.name);
				await assertStable();
				const destination = path.join(skillsRoot, target.skill.name);
				await verifyRemovableSkillTarget(destination, target, nonce, true);
				await remove(destination, { recursive: true, force: false });
				await assertStable();
			} catch {
				rollbackFailures.push(target.skill.name);
			}
		}
		if (rollbackFailures.length > 0) {
			return fail(
				"SKILLS_INSTALL_RECOVERY_REQUIRED",
				`Codex Skill installation rollback requires manual inspection for: ${rollbackFailures.join(", ")}.`,
			);
		}
		throw error;
	}
}

function packagedAssetRoot(): string {
	return path.join(__dirname, "skills");
}

export function parseSkillsInstallRequest(
	action: unknown,
	options: Record<string, unknown>,
): SkillsInstallRequest {
	if (action !== "install") {
		return fail(
			"SKILLS_ACTION_UNSUPPORTED",
			"Only `openapi skills install --host codex` is supported.",
		);
	}
	const hosts = Array.isArray(options.host)
		? options.host
		: options.host === undefined
			? []
			: [options.host];
	if (hosts.length === 0) {
		return fail(
			"SKILLS_HOST_REQUIRED",
			"`--host codex` is required; only the Codex Host is supported.",
		);
	}
	if (hosts.length > 1) {
		return fail(
			"SKILLS_HOST_DUPLICATE",
			"`--host` must be specified exactly once; only the Codex Host is supported.",
		);
	}
	if (
		hosts[0] === true ||
		hosts[0] === false ||
		typeof hosts[0] !== "string" ||
		hosts[0].length === 0
	) {
		return fail(
			"SKILLS_HOST_EMPTY",
			"`--host` requires the value `codex`; only the Codex Host is supported.",
		);
	}
	if (hosts[0] !== "codex") {
		return fail(
			"SKILLS_HOST_UNSUPPORTED",
			`Unsupported Skill Host ${JSON.stringify(hosts[0])}; only the Codex Host is supported.`,
		);
	}
	return {
		dryRun: options.dryRun === true,
		json: options.json === true,
	};
}

export async function installCodexSkills(
	request: SkillsInstallRequest,
	packageVersion: string,
	dependencies: SkillsInstallDependencies = {},
): Promise<SkillsInstallOutput> {
	try {
		const verifiedSkills = await verifyPackagedSkills(
			dependencies.assetRoot ?? packagedAssetRoot(),
			packageVersion,
		);
		const environment = dependencies.environment ?? process.env;
		const codexHome = resolveCodexHome(
			environment,
			dependencies.homeDirectory ?? homedir,
		);
		const skillsRoot = path.join(codexHome, "skills");
		if (path.relative(codexHome, skillsRoot) !== "skills") {
			return fail(
				"SKILLS_DESTINATION_INVALID",
				"The Codex Skill destination escapes CODEX_HOME.",
			);
		}
		await preflightDestination(codexHome, skillsRoot, {
			checkConflicts: false,
			checkLock: false,
		});
		const recoveredComplete =
			!request.dryRun &&
			(await recoverInterruptedInstallation(
				codexHome,
				skillsRoot,
				packageVersion,
				verifiedSkills,
			));
		const output: SkillsInstallOutput = {
			success: true,
			command: "skills install",
			mode: request.dryRun ? "dry-run" : "install",
			host: "codex",
			packageVersion,
			source: "packaged-npm-assets",
			destinationRoot: skillsRoot,
			skills: [...supportedSkillNames],
			actions: supportedSkillNames.map((skill) => ({
				action: "install",
				skill,
				destination: path.join(skillsRoot, skill),
			})),
			installed: request.dryRun ? [] : [...supportedSkillNames],
			restartRequired: true,
		};
		if (recoveredComplete) return output;
		const initialState = await preflightDestination(codexHome, skillsRoot);
		if (request.dryRun) return output;

		let lockAcquired = false;
		let journalWritten = false;
		let stagingCreated = false;
		let preserveTransaction = false;
		let identity: DestinationIdentity | undefined;
		let installed = false;
		const nonce = validateTransactionNonce(
			(dependencies.transactionNonce ?? randomUUID)(),
		);
		const lockPath = path.join(skillsRoot, installLockName);
		const stagingRoot = path.join(
			skillsRoot,
			`${stagingDirectoryPrefix}${nonce}`,
		);
		try {
			await mkdir(skillsRoot, { recursive: true, mode: 0o700 });
			const createdCodexHome = await lstat(codexHome);
			const createdSkillsRoot = await lstat(skillsRoot);
			if (
				createdCodexHome.isSymbolicLink() ||
				!createdCodexHome.isDirectory() ||
				createdSkillsRoot.isSymbolicLink() ||
				!createdSkillsRoot.isDirectory()
			) {
				return fail(
					"SKILLS_DESTINATION_INVALID",
					"The Codex Skill destination changed during installation.",
				);
			}
			try {
				await mkdir(lockPath, { mode: 0o700 });
				lockAcquired = true;
			} catch {
				return fail(
					"SKILLS_INSTALL_BUSY",
					"A Codex Skill installation is already active or requires manual inspection.",
				);
			}
			identity = await captureDestinationIdentity(
				codexHome,
				skillsRoot,
				lockPath,
			);
			activeTransactionNonces.add(nonce);
			await writeInstallJournal(lockPath, {
				schemaVersion: 1,
				packageVersion,
				pid: dependencies.processId ?? process.pid,
				nonce,
				stagingDirectory: path.basename(stagingRoot),
				skills: [...supportedSkillNames],
			});
			journalWritten = true;
			await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
			const lockedState = await preflightDestination(codexHome, skillsRoot, {
				checkLock: false,
			});
			if (!lockedState.skillsRootPresent) {
				return fail(
					"SKILLS_DESTINATION_INVALID",
					"The Codex Skill destination changed during installation.",
				);
			}
			await dependencies.beforeStaging?.();
			await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
			await mkdir(stagingRoot, { mode: 0o700 });
			stagingCreated = true;
			await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
			const fileWriter = dependencies.writeFile ?? writeFile;
			await writeStagedSkills(stagingRoot, verifiedSkills, fileWriter);
			await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
			for (const skill of verifiedSkills) {
				await verifyInstalledSkill(path.join(stagingRoot, skill.name), skill);
			}
			await assertDestinationStable(codexHome, skillsRoot, lockPath, identity);
			await commitStagedSkills(
				skillsRoot,
				verifiedSkills,
				nonce,
				fileWriter,
				dependencies.remove ?? rm,
				() =>
					assertDestinationStable(
						codexHome,
						skillsRoot,
						lockPath,
						identity as DestinationIdentity,
					),
				dependencies.beforeTargetCommit,
				dependencies.afterTargetCommit,
				dependencies.beforeTargetRollback,
			);
			installed = true;
		} catch (error) {
			if (
				error instanceof SkillsInstallError &&
				[
					"SKILLS_DESTINATION_CHANGED",
					"SKILLS_INSTALL_RECOVERY_REQUIRED",
				].includes(error.code)
			) {
				preserveTransaction = true;
			}
			throw error;
		} finally {
			activeTransactionNonces.delete(nonce);
			const cleanupSafe =
				!identity ||
				(await destinationIsStable(codexHome, skillsRoot, lockPath, identity));
			if (lockAcquired && !preserveTransaction && cleanupSafe) {
				if (journalWritten) {
					await cleanupTransaction(lockPath, stagingRoot, stagingCreated);
				} else {
					await rmdir(lockPath);
				}
			}
			if (
				!installed &&
				!preserveTransaction &&
				cleanupSafe &&
				!initialState.skillsRootPresent
			) {
				await rmdir(skillsRoot).catch(() => undefined);
			}
			if (
				!installed &&
				!preserveTransaction &&
				cleanupSafe &&
				!initialState.codexHomePresent
			) {
				await rmdir(codexHome).catch(() => undefined);
			}
		}
		return output;
	} catch (error) {
		if (error instanceof SkillsInstallError) throw error;
		throw new SkillsInstallError(
			"SKILLS_INSTALL_FAILED",
			"Codex Skill installation failed safely; no overwrite was attempted.",
		);
	}
}

export function skillsInstallHumanOutput(
	output: SkillsInstallOutput,
): string[] {
	if (output.mode === "dry-run") {
		return [
			"Codex Skill install plan (dry run)",
			`Package version: ${output.packageVersion}`,
			"Source: packaged npm assets (offline)",
			"Destination: Codex user Skills directory",
			"Skills:",
			...output.skills.map((name) => `- ${name}`),
			"No files were written.",
			"Restart Codex after applying this plan.",
		];
	}
	return [
		"Installed Codex Skills:",
		...output.installed.map((name) => `- ${name}`),
		"restartRequired: true",
		"Restart Codex to load the installed Skills.",
	];
}
