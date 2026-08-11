import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	lstat,
	mkdtemp,
	readFile,
	realpath,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const implementationRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

export class PolicyError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "PolicyError";
		this.code = code;
	}
}

function fail(code, message) {
	throw new PolicyError(code, message);
}

export function byteLength(value) {
	return Buffer.byteLength(value, "utf8");
}

function canonicalize(value) {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonicalize(value[key])]),
		);
	}
	return value;
}

export function canonicalJson(value) {
	return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value) {
	return sha256(canonicalJson(value));
}

function assertPlainObject(value, code, label) {
	if (
		!value ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	) {
		fail(code, `${label} must be a JSON object`);
	}
}

function assertExactKeys(value, keys, code, label) {
	assertPlainObject(value, code, label);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		fail(code, `${label} has an unexpected field set`);
	}
}

function assertBoundedString(
	value,
	maximum,
	code,
	label,
	{ empty = true } = {},
) {
	if (typeof value !== "string") fail(code, `${label} must be a string`);
	if (!empty && value.trim() === "") fail(code, `${label} must not be empty`);
	if (byteLength(value) > maximum)
		fail(code, `${label} exceeds its byte limit`);
}

export async function loadImplementerPolicy(root = implementationRoot) {
	const contents = await readFile(
		join(root, ".github/codex/implementer-policy.json"),
		"utf8",
	);
	const policy = JSON.parse(contents);
	if (policy.schemaVersion !== "codex-implementer-policy-v1") {
		fail("POLICY_VERSION_INVALID", "implementer policy version is unsupported");
	}
	return policy;
}

export function validateTrigger(facts, policy) {
	assertExactKeys(
		facts,
		[
			"actor",
			"featureGate",
			"ref",
			"repository",
			"repositoryId",
			"runAttempt",
			"triggeringActor",
		],
		"TRIGGER_INVALID",
		"trigger facts",
	);
	if (facts.repository !== policy.repository.fullName) {
		fail("REPOSITORY_MISMATCH", "repository full name is not authorized");
	}
	if (Number(facts.repositoryId) !== policy.repository.id) {
		fail(
			"REPOSITORY_ID_MISMATCH",
			"repository numeric identity is not authorized",
		);
	}
	if (facts.ref !== policy.repository.authoritativeRef) {
		fail("REF_MISMATCH", "dispatch ref is not authoritative main");
	}
	if (!policy.repository.trustedActors.includes(facts.actor)) {
		fail(
			"ACTOR_NOT_TRUSTED",
			"dispatch actor is not in the explicit allowlist",
		);
	}
	if (
		facts.triggeringActor !== facts.actor ||
		!policy.repository.trustedActors.includes(facts.triggeringActor)
	) {
		fail("TRIGGERING_ACTOR_NOT_TRUSTED", "workflow initiator is not trusted");
	}
	if (facts.runAttempt !== "1") {
		fail("RERUN_FORBIDDEN", "workflow reruns are outside manual authority");
	}
	if (facts.featureGate !== policy.featureGate.enabledValue) {
		fail("FEATURE_DISABLED", "Codex implementer feature gate is disabled");
	}
	return true;
}

export function normalizeRepositoryPath(rawPath, policy) {
	if (typeof rawPath !== "string") {
		fail("PATH_INVALID", "authorized path must be a string");
	}
	if (rawPath === "") fail("PATH_EMPTY", "authorized path must not be empty");
	if (byteLength(rawPath) > policy.limits.pathBytes) {
		fail("PATH_TOO_LONG", "authorized path exceeds its byte limit");
	}
	for (const character of rawPath) {
		const codePoint = character.codePointAt(0);
		if (codePoint <= 31 || codePoint === 127) {
			fail(
				"PATH_CONTROL_CHARACTER",
				"authorized path contains a control character",
			);
		}
	}
	if (rawPath.includes("\\")) {
		fail("PATH_BACKSLASH", "backslash path separators are ambiguous");
	}
	if (
		rawPath.startsWith("/") ||
		rawPath.startsWith("//") ||
		/^[A-Za-z]:/.test(rawPath)
	) {
		fail("PATH_ABSOLUTE", "absolute authorized paths are forbidden");
	}
	if (!/^[A-Za-z0-9._/-]+$/.test(rawPath)) {
		fail(
			"PATH_CHARACTER_INVALID",
			"authorized path has an unsupported character",
		);
	}
	const segments = rawPath.split("/");
	if (segments.some((segment) => segment === "" || segment === ".")) {
		fail("PATH_NOT_NORMALIZED", "authorized path is not normalized");
	}
	if (segments.some((segment) => segment === "..")) {
		fail("PATH_TRAVERSAL", "parent traversal is forbidden");
	}
	if (segments.some((segment) => segment.toLowerCase() === ".git")) {
		fail("PATH_GIT", ".git authority is forbidden");
	}
	for (const segment of segments) {
		if (/[. ]$/u.test(segment)) {
			fail(
				"PATH_WINDOWS_TRAILING_CHARACTER",
				"authorized path has a Windows-ambiguous trailing character",
			);
		}
		const deviceStem = segment.split(".", 1)[0].toUpperCase();
		if (/^(?:CON|PRN|AUX|NUL|CLOCK\$|COM[1-9]|LPT[1-9])$/u.test(deviceStem)) {
			fail(
				"PATH_WINDOWS_RESERVED_NAME",
				"authorized path uses a Windows-reserved device name",
			);
		}
	}
	const normalized = posix.normalize(rawPath);
	if (normalized !== rawPath || normalized === ".") {
		fail("PATH_NOT_NORMALIZED", "authorized path is not normalized");
	}
	return normalized;
}

export function isRootOfTrustPath(path, policy) {
	const lowerPath = path.toLowerCase();
	if (
		policy.pathPolicy.protectedExactPaths.some(
			(candidate) => candidate.toLowerCase() === lowerPath,
		)
	) {
		return true;
	}
	if (
		policy.pathPolicy.protectedPrefixes.some((prefix) =>
			lowerPath.startsWith(prefix.toLowerCase()),
		)
	) {
		return true;
	}
	if (
		policy.pathPolicy.protectedBasenames.some(
			(candidate) => candidate.toLowerCase() === basename(path).toLowerCase(),
		)
	) {
		return true;
	}
	return policy.pathPolicy.protectedBasenamePatterns.some((pattern) =>
		new RegExp(pattern, "iu").test(basename(path)),
	);
}

function isAllowedSurface(path, policy) {
	return policy.pathPolicy.allowedPathPatterns.some((pattern) =>
		new RegExp(pattern, "u").test(path),
	);
}

export function validateNormalizedPathArray(paths, policy) {
	if (!Array.isArray(paths)) {
		fail("PATH_LIST_INVALID", "authorized paths must be a JSON array");
	}
	if (paths.length === 0) {
		fail("PATH_LIST_EMPTY", "at least one authorized path is required");
	}
	if (paths.length > policy.limits.authorizedPathCount) {
		fail("PATH_COUNT_EXCEEDED", "authorized path count exceeds policy");
	}
	const normalized = paths.map((path) => normalizeRepositoryPath(path, policy));
	const exact = new Set();
	const foldedPrefixes = new Map();
	for (const path of normalized) {
		if (exact.has(path))
			fail("PATH_DUPLICATE", "authorized path is duplicated");
		exact.add(path);
		let prefix = "";
		for (const segment of path.split("/")) {
			prefix = prefix ? `${prefix}/${segment}` : segment;
			const caseKey = prefix.toLowerCase();
			const existing = foldedPrefixes.get(caseKey);
			if (existing !== undefined && existing !== prefix) {
				fail(
					"PATH_CASE_AMBIGUOUS",
					"authorized path components are case-ambiguous",
				);
			}
			foldedPrefixes.set(caseKey, prefix);
		}
		if (isRootOfTrustPath(path, policy)) {
			fail(
				"ROOT_OF_TRUST_PATH",
				"authorized path intersects the Root of Trust",
			);
		}
		if (!isAllowedSurface(path, policy)) {
			fail(
				"PATH_SURFACE_UNSUPPORTED",
				"authorized path surface is not registered",
			);
		}
	}
	return normalized.sort();
}

export function parseAuthorizedPathsJson(raw, policy) {
	assertBoundedString(
		raw,
		policy.limits.authorizedPathInputBytes,
		"PATH_INPUT_TOO_LARGE",
		"authorized path input",
		{ empty: false },
	);
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		fail("PATH_JSON_INVALID", "authorized paths must be valid JSON");
	}
	return validateNormalizedPathArray(parsed, policy);
}

async function pathExists(path) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

export async function assertRepositoryPathFacts(root, path) {
	const repositoryRealPath = await realpath(root);
	let trackedPaths;
	try {
		trackedPaths = execFileSync("git", ["ls-files", "-z", "--cached"], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 4 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"],
		})
			.split("\0")
			.filter(Boolean);
	} catch {
		fail("PATH_GIT_INSPECTION_FAILED", "could not inspect tracked path state");
	}
	const trackedPrefixes = new Map();
	for (const trackedPath of trackedPaths) {
		let trackedPrefix = "";
		for (const segment of trackedPath.split("/")) {
			trackedPrefix = trackedPrefix ? `${trackedPrefix}/${segment}` : segment;
			const folded = trackedPrefix.toLowerCase();
			if (!trackedPrefixes.has(folded))
				trackedPrefixes.set(folded, trackedPrefix);
		}
	}
	let authorizedPrefix = "";
	for (const segment of path.split("/")) {
		authorizedPrefix = authorizedPrefix
			? `${authorizedPrefix}/${segment}`
			: segment;
		const trackedPrefix = trackedPrefixes.get(authorizedPrefix.toLowerCase());
		if (trackedPrefix !== undefined && trackedPrefix !== authorizedPrefix) {
			fail(
				"PATH_CASE_AMBIGUOUS",
				"authorized path component collides with a tracked path",
			);
		}
	}
	let cursor = repositoryRealPath;
	let repositoryPrefix = "";
	for (const segment of path.split("/")) {
		cursor = join(cursor, segment);
		repositoryPrefix = repositoryPrefix
			? `${repositoryPrefix}/${segment}`
			: segment;
		let stage = "";
		try {
			stage = execFileSync(
				"git",
				["ls-files", "--stage", "--", repositoryPrefix],
				{
					cwd: root,
					encoding: "utf8",
					maxBuffer: 64 * 1024,
					stdio: ["ignore", "pipe", "pipe"],
				},
			);
		} catch {
			fail(
				"PATH_GIT_INSPECTION_FAILED",
				"could not inspect authorized path state",
			);
		}
		const exactGitlink = stage.split(/\r?\n/).some((line) => {
			const match = line.match(/^160000 [a-f0-9]+ \d\t([\s\S]+)$/u);
			return match?.[1] === repositoryPrefix;
		});
		if (exactGitlink) {
			fail("PATH_SUBMODULE", "submodule authority is forbidden");
		}
		if (!(await pathExists(cursor))) break;
		const facts = await lstat(cursor);
		if (facts.isSymbolicLink()) {
			fail("PATH_SYMLINK", "authorized path traverses a symbolic link");
		}
		const resolved = await realpath(cursor);
		if (
			resolved !== repositoryRealPath &&
			!resolved.startsWith(`${repositoryRealPath}${sep}`)
		) {
			fail("PATH_ESCAPE", "authorized path resolves outside the repository");
		}
	}
}

const ISSUE_FIELDS = [
	"Goal",
	"Scope",
	"Non-goals",
	"Execution / Authorization Mode",
	"Dependencies",
	"Parallelization",
	"Conflict surface",
	"Risk",
	"Acceptance criteria",
	"Validation expectations",
];

export function parseDevelopmentTaskBody(body, policy) {
	assertBoundedString(
		body,
		policy.limits.issueBodyBytes,
		"ISSUE_BODY_TOO_LARGE",
		"Issue body",
		{ empty: false },
	);
	const normalizedBody = body.replace(/\r\n?/g, "\n");
	const fields = new Map();
	let active;
	for (const line of normalizedBody.split("\n")) {
		const heading = line.match(/^### (.+)$/u)?.[1];
		if (heading && ISSUE_FIELDS.includes(heading)) {
			if (fields.has(heading)) {
				fail("ISSUE_FORM_DUPLICATE", `Issue field ${heading} is duplicated`);
			}
			active = heading;
			fields.set(active, []);
			continue;
		}
		if (active) fields.get(active).push(line);
	}
	const parsed = {};
	for (const field of ISSUE_FIELDS) {
		if (!fields.has(field)) {
			fail("ISSUE_FORM_MALFORMED", `Issue field ${field} is missing`);
		}
		const value = fields.get(field).join("\n").trim();
		assertBoundedString(
			value,
			policy.limits.issueFieldBytes,
			"ISSUE_FIELD_TOO_LARGE",
			`Issue field ${field}`,
			{ empty: false },
		);
		parsed[field] = value;
	}
	return { fields: parsed, normalizedBody };
}

export function validateIssueForExecution(issue, issueNumber, policy) {
	if (!issue) fail("ISSUE_NOT_FOUND", "Issue does not exist");
	if (issue.pull_request)
		fail("ISSUE_NOT_FOUND", "task number names a pull request");
	if (Number(issue.number) !== Number(issueNumber)) {
		fail("ISSUE_NUMBER_MISMATCH", "Issue number does not match dispatch input");
	}
	if (issue.state !== "open") fail("ISSUE_CLOSED", "Issue must be open");
	assertBoundedString(issue.title, 1024, "ISSUE_TITLE_INVALID", "Issue title", {
		empty: false,
	});
	const parsed = parseDevelopmentTaskBody(issue.body, policy);
	const mode = parsed.fields["Execution / Authorization Mode"];
	if (!policy.authorization.supportedModes.includes(mode)) {
		fail("AUTHORIZATION_MODE_UNSUPPORTED", "only MANUAL tasks are executable");
	}
	const risk = parsed.fields.Risk;
	if (!policy.authorization.supportedRisks.includes(risk)) {
		fail(
			"RISK_UNSUPPORTED",
			"task risk is outside the initial runtime boundary",
		);
	}
	if (
		parsed.fields.Dependencies.toLowerCase() !==
		policy.authorization.requiredDependenciesValue
	) {
		fail(
			"DEPENDENCY_UNSUPPORTED",
			"initial runtime requires Dependencies: none",
		);
	}
	if (
		!["Parallel Safe", "Shared Surface", "Dependent"].includes(
			parsed.fields.Parallelization,
		)
	) {
		fail("ISSUE_FORM_MALFORMED", "Issue parallelization value is invalid");
	}
	return parsed;
}

function taskFields(parsed) {
	return {
		acceptanceCriteria: parsed.fields["Acceptance criteria"],
		conflictSurface: parsed.fields["Conflict surface"],
		dependencies: parsed.fields.Dependencies,
		goal: parsed.fields.Goal,
		nonGoals: parsed.fields["Non-goals"],
		parallelization: parsed.fields.Parallelization,
		risk: parsed.fields.Risk,
		scope: parsed.fields.Scope,
		validationExpectations: parsed.fields["Validation expectations"],
		authorizationMode: parsed.fields["Execution / Authorization Mode"],
	};
}

export function createTaskSnapshot({
	authorizedPaths,
	baseSha,
	dispatchActor,
	dispatchRunAttempt,
	dispatchTriggeringActor,
	issue,
	issueNumber,
	parsedIssue,
	policy,
}) {
	if (!/^[a-f0-9]{40}$/u.test(baseSha)) {
		fail("BASE_SHA_INVALID", "base SHA must be a full lowercase commit SHA");
	}
	const snapshot = {
		authorizedPaths,
		baseSha,
		dispatchActor,
		dispatchRunAttempt,
		dispatchTriggeringActor,
		issue: {
			bodySha256: sha256(parsedIssue.normalizedBody),
			number: Number(issueNumber),
			updatedAt: issue.updated_at,
		},
		pathPolicyVersion: policy.pathPolicy.version,
		repository: {
			fullName: policy.repository.fullName,
			id: policy.repository.id,
		},
		schemaVersion: policy.taskSnapshotSchemaVersion,
		task: taskFields(parsedIssue),
		triggerPolicyVersion: policy.triggerPolicyVersion,
	};
	return { ...snapshot, taskSnapshotHash: hashJson(snapshot) };
}

export function validateTaskSnapshot(snapshot, policy) {
	assertPlainObject(snapshot, "SNAPSHOT_INVALID", "task snapshot");
	const { taskSnapshotHash, ...unsigned } = snapshot;
	if (!/^[a-f0-9]{64}$/u.test(taskSnapshotHash ?? "")) {
		fail("SNAPSHOT_HASH_INVALID", "task snapshot hash is malformed");
	}
	if (hashJson(unsigned) !== taskSnapshotHash) {
		fail(
			"SNAPSHOT_HASH_MISMATCH",
			"task snapshot hash does not match its contents",
		);
	}
	if (
		snapshot.schemaVersion !== policy.taskSnapshotSchemaVersion ||
		snapshot.triggerPolicyVersion !== policy.triggerPolicyVersion ||
		snapshot.pathPolicyVersion !== policy.pathPolicy.version
	) {
		fail("SNAPSHOT_POLICY_STALE", "task snapshot policy binding is stale");
	}
	validateNormalizedPathArray(snapshot.authorizedPaths, policy);
	return snapshot;
}

export function verifyIssueSnapshot(snapshot, issue, policy) {
	const parsed = validateIssueForExecution(
		issue,
		snapshot.issue.number,
		policy,
	);
	if (
		issue.updated_at !== snapshot.issue.updatedAt ||
		sha256(parsed.normalizedBody) !== snapshot.issue.bodySha256
	) {
		fail("ISSUE_SNAPSHOT_STALE", "Issue task contract changed after dispatch");
	}
	return true;
}

export function validateImplementationResult(rawResult, snapshot, policy) {
	assertBoundedString(
		rawResult,
		policy.limits.resultBytes,
		"RESULT_TOO_LARGE",
		"implementation result",
		{ empty: false },
	);
	let result;
	try {
		result = JSON.parse(rawResult);
	} catch {
		fail("RESULT_JSON_INVALID", "implementation result must be JSON");
	}
	const keys = [
		"baseSha",
		"claimedChangedPaths",
		"implementationSummary",
		"limitations",
		"localValidationSummary",
		"proposedPatch",
		"schemaVersion",
		"taskSnapshotHash",
	];
	assertExactKeys(
		result,
		keys,
		"RESULT_SCHEMA_INVALID",
		"implementation result",
	);
	if (result.schemaVersion !== policy.resultSchemaVersion) {
		fail(
			"RESULT_SCHEMA_INVALID",
			"implementation result version is unsupported",
		);
	}
	if (result.taskSnapshotHash !== snapshot.taskSnapshotHash) {
		fail(
			"RESULT_TASK_HASH_MISMATCH",
			"implementation result names another task",
		);
	}
	if (result.baseSha !== snapshot.baseSha) {
		fail(
			"RESULT_BASE_SHA_MISMATCH",
			"implementation result names another base",
		);
	}
	assertBoundedString(
		result.implementationSummary,
		policy.limits.summaryBytes,
		"RESULT_SUMMARY_TOO_LARGE",
		"implementation summary",
	);
	assertBoundedString(
		result.localValidationSummary,
		policy.limits.validationSummaryBytes,
		"RESULT_VALIDATION_TOO_LARGE",
		"local validation summary",
	);
	assertBoundedString(
		result.limitations,
		policy.limits.limitationsBytes,
		"RESULT_LIMITATIONS_TOO_LARGE",
		"limitations",
	);
	assertBoundedString(
		result.proposedPatch,
		policy.limits.patchBytes,
		"PATCH_TOO_LARGE",
		"proposed patch",
		{ empty: false },
	);
	const claimed = validateNormalizedPathArray(
		result.claimedChangedPaths,
		policy,
	);
	for (const path of claimed) {
		if (!snapshot.authorizedPaths.includes(path)) {
			fail(
				"PATCH_PATH_UNAUTHORIZED",
				"claimed path is outside dispatch authority",
			);
		}
	}
	return { ...result, claimedChangedPaths: claimed };
}

export function validatePatchText(patch, policy) {
	assertBoundedString(
		patch,
		policy.limits.patchBytes,
		"PATCH_TOO_LARGE",
		"patch",
		{ empty: false },
	);
	if (patch.includes("\0")) fail("PATCH_NUL", "patch contains a NUL byte");
	for (const [pattern, code] of [
		[/^GIT binary patch$/mu, "PATCH_BINARY"],
		[/^Binary files /mu, "PATCH_BINARY"],
		[/^(?:rename|copy) (?:from|to) /mu, "PATCH_RENAME"],
		[/^(?:old|new) mode /mu, "PATCH_MODE"],
		[/^(?:new|deleted) file mode (?!100644$)/mu, "PATCH_MODE"],
		[/^Submodule /mu, "PATCH_SUBMODULE"],
	]) {
		if (pattern.test(patch))
			fail(code, "patch contains an unsupported change type");
	}
	return true;
}

function git(root, args, options = {}) {
	try {
		return execFileSync("git", args, {
			cwd: root,
			encoding: options.encoding ?? "utf8",
			maxBuffer: options.maxBuffer ?? 2 * 1024 * 1024,
			stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
		});
	} catch {
		fail("GIT_VALIDATION_FAILED", `trusted Git validation failed: ${args[0]}`);
	}
}

function nulRecords(buffer) {
	return buffer
		.toString("utf8")
		.split("\0")
		.filter((record) => record !== "");
}

function patchNumstatPaths(root, patchFile) {
	const output = git(root, ["apply", "--numstat", "-z", "--", patchFile], {
		encoding: "buffer",
	});
	const paths = [];
	for (const record of nulRecords(output)) {
		const match = record.match(/^(\d+|-)\t(\d+|-)\t([\s\S]+)$/u);
		if (!match) fail("PATCH_NUMSTAT_INVALID", "patch numstat is malformed");
		if (match[1] === "-" || match[2] === "-") {
			fail("PATCH_BINARY", "binary patch content is unsupported");
		}
		paths.push(match[3]);
	}
	return paths;
}

function inspectModes(root, diffArguments) {
	const records = nulRecords(
		git(
			root,
			["diff", ...diffArguments, "--raw", "-z", "--no-renames", "--full-index"],
			{ encoding: "buffer" },
		),
	);
	if (records.length % 2 !== 0) {
		fail("PATCH_RAW_INVALID", "staged raw diff is malformed");
	}
	const paths = [];
	for (let index = 0; index < records.length; index += 2) {
		const header = records[index];
		const path = records[index + 1];
		const match = header.match(
			/^:(\d{6}) (\d{6}) [a-f0-9]+ [a-f0-9]+ ([AMD])$/u,
		);
		if (!match) fail("PATCH_CHANGE_TYPE", "patch change type is unsupported");
		const [, oldMode, newMode, status] = match;
		const regular = new Set(["100644", "100755"]);
		const valid =
			(status === "A" && oldMode === "000000" && newMode === "100644") ||
			(status === "D" && regular.has(oldMode) && newMode === "000000") ||
			(status === "M" && oldMode === newMode && regular.has(oldMode));
		if (!valid) fail("PATCH_MODE", "patch changes an unsupported file mode");
		paths.push(path);
	}
	return paths;
}

function sortedUnique(values) {
	return [...new Set(values)].sort();
}

function sameStrings(left, right) {
	return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function assertCandidateWorkspaceState(root, expectedPaths, policy) {
	git(root, ["diff", "--cached", "--check"]);
	const changedPaths = sortedUnique(
		nulRecords(
			git(root, ["diff", "--cached", "--name-only", "-z", "--no-renames"], {
				encoding: "buffer",
			}),
		),
	);
	if (!sameStrings(changedPaths, expectedPaths)) {
		fail(
			"PATCH_PATH_MISMATCH",
			"actual changed paths differ from validated paths",
		);
	}
	for (const path of changedPaths) {
		normalizeRepositoryPath(path, policy);
		if (isRootOfTrustPath(path, policy)) {
			fail("ROOT_OF_TRUST_PATH", "actual diff intersects the Root of Trust");
		}
	}
	const modePaths = sortedUnique(inspectModes(root, ["--cached"]));
	if (!sameStrings(modePaths, changedPaths)) {
		fail("PATCH_MODE", "mode inspection did not cover every changed path");
	}
	const status = nulRecords(
		git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
			encoding: "buffer",
		}),
	);
	const statusPaths = [];
	for (const record of status) {
		const match = record.match(/^([AMD]) {2}([\s\S]+)$/u);
		if (!match)
			fail("CANDIDATE_DRIFT", "candidate workspace contains unexpected drift");
		statusPaths.push(match[2]);
	}
	if (!sameStrings(statusPaths, changedPaths)) {
		fail("CANDIDATE_DRIFT", "candidate status differs from the validated diff");
	}
	const untracked = nulRecords(
		git(root, ["ls-files", "--others", "--exclude-standard", "-z"], {
			encoding: "buffer",
		}),
	);
	if (untracked.length > 0) {
		fail(
			"CANDIDATE_UNTRACKED",
			"candidate workspace contains an unexpected file",
		);
	}
	const canonicalPatch = git(root, [
		"diff",
		"--cached",
		"--binary",
		"--full-index",
		"--no-ext-diff",
		"--no-textconv",
		"--no-color",
	]);
	validatePatchText(canonicalPatch, policy);
	return {
		canonicalPatch,
		changedPaths,
		patchSha256: sha256(canonicalPatch),
	};
}

export function assertCommittedCandidateState(
	root,
	baseSha,
	expectedPaths,
	policy,
) {
	if (!/^[a-f0-9]{40}$/u.test(baseSha)) {
		fail("BASE_SHA_INVALID", "committed candidate base SHA is malformed");
	}
	git(root, ["diff", "--check", `${baseSha}..HEAD`]);
	const changedPaths = sortedUnique(
		nulRecords(
			git(
				root,
				["diff", "--name-only", "-z", "--no-renames", `${baseSha}..HEAD`],
				{ encoding: "buffer" },
			),
		),
	);
	if (!sameStrings(changedPaths, expectedPaths)) {
		fail(
			"PATCH_PATH_MISMATCH",
			"committed paths differ from validation evidence",
		);
	}
	for (const path of changedPaths) {
		normalizeRepositoryPath(path, policy);
		if (isRootOfTrustPath(path, policy)) {
			fail("ROOT_OF_TRUST_PATH", "committed diff intersects the Root of Trust");
		}
	}
	const modePaths = sortedUnique(inspectModes(root, [`${baseSha}..HEAD`]));
	if (!sameStrings(modePaths, changedPaths)) {
		fail("PATCH_MODE", "committed mode evidence does not match changed paths");
	}
	const status = git(root, [
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	]);
	if (status !== "") {
		fail("CANDIDATE_DRIFT", "publisher workspace is dirty after commit");
	}
	const untracked = nulRecords(
		git(root, ["ls-files", "--others", "--exclude-standard", "-z"], {
			encoding: "buffer",
		}),
	);
	if (untracked.length > 0) {
		fail("CANDIDATE_UNTRACKED", "publisher has unexpected untracked files");
	}
	const canonicalPatch = git(root, [
		"diff",
		"--binary",
		"--full-index",
		"--no-ext-diff",
		"--no-textconv",
		"--no-color",
		`${baseSha}..HEAD`,
	]);
	validatePatchText(canonicalPatch, policy);
	return {
		canonicalPatch,
		changedPaths,
		patchSha256: sha256(canonicalPatch),
	};
}

export async function applyCandidatePatch({
	authorizedPaths,
	claimedChangedPaths,
	patch,
	policy,
	root,
}) {
	validatePatchText(patch, policy);
	const beforeStatus = git(root, [
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	]);
	if (beforeStatus !== "") {
		fail(
			"BASE_WORKSPACE_DIRTY",
			"candidate checkout is not clean before apply",
		);
	}
	const patchDirectory = await mkdtemp(join(tmpdir(), "codex-patch-"));
	const patchFile = join(patchDirectory, "candidate.patch");
	try {
		await writeFile(patchFile, patch, { encoding: "utf8", mode: 0o600 });
		git(root, ["apply", "--check", "--index", "--", patchFile]);
		const proposedPaths = sortedUnique(patchNumstatPaths(root, patchFile));
		const normalizedProposed = validateNormalizedPathArray(
			proposedPaths,
			policy,
		);
		if (!sameStrings(normalizedProposed, claimedChangedPaths)) {
			fail(
				"PATCH_CLAIM_MISMATCH",
				"claimed paths differ from proposed patch paths",
			);
		}
		for (const path of normalizedProposed) {
			if (!authorizedPaths.includes(path)) {
				fail(
					"PATCH_PATH_UNAUTHORIZED",
					"patch changes a path outside authority",
				);
			}
			await assertRepositoryPathFacts(root, path);
		}
		git(root, ["apply", "--index", "--", patchFile]);
		return assertCandidateWorkspaceState(root, normalizedProposed, policy);
	} finally {
		await rm(patchDirectory, { recursive: true, force: true });
	}
}

export function createValidationEvidence({ patchFacts, snapshot, policy }) {
	const evidence = {
		baseSha: snapshot.baseSha,
		changedPaths: patchFacts.changedPaths,
		commands: policy.validationPolicy.commands,
		patchSha256: patchFacts.patchSha256,
		schemaVersion: policy.validationEvidenceSchemaVersion,
		taskSnapshotHash: snapshot.taskSnapshotHash,
		validationPolicyVersion: policy.validationPolicy.version,
	};
	return { ...evidence, evidenceHash: hashJson(evidence) };
}

export function validateValidationEvidence(evidence, snapshot, policy) {
	assertPlainObject(evidence, "EVIDENCE_INVALID", "validation evidence");
	const { evidenceHash, ...unsigned } = evidence;
	if (hashJson(unsigned) !== evidenceHash) {
		fail("EVIDENCE_HASH_MISMATCH", "validation evidence hash is invalid");
	}
	if (
		evidence.schemaVersion !== policy.validationEvidenceSchemaVersion ||
		evidence.validationPolicyVersion !== policy.validationPolicy.version ||
		evidence.taskSnapshotHash !== snapshot.taskSnapshotHash ||
		evidence.baseSha !== snapshot.baseSha
	) {
		fail("EVIDENCE_BINDING_MISMATCH", "validation evidence binding is invalid");
	}
	if (
		JSON.stringify(evidence.commands) !==
		JSON.stringify(policy.validationPolicy.commands)
	) {
		fail(
			"EVIDENCE_COMMAND_MISMATCH",
			"validation command evidence is not fixed policy",
		);
	}
	validateNormalizedPathArray(evidence.changedPaths, policy);
	return evidence;
}

export function validatePublisherState({
	baseSha,
	branchExists,
	currentMainSha,
	openPullRequestExists,
}) {
	if (currentMainSha !== baseSha) {
		fail("MAIN_STALE", "authoritative main changed after task dispatch");
	}
	if (branchExists) fail("BRANCH_COLLISION", "runtime branch already exists");
	if (openPullRequestExists) {
		fail("PULL_REQUEST_COLLISION", "runtime pull request already exists");
	}
	return true;
}

export function deterministicBranchName(issueNumber) {
	if (!Number.isSafeInteger(Number(issueNumber)) || Number(issueNumber) < 1) {
		fail("ISSUE_NUMBER_INVALID", "Issue number must be a positive integer");
	}
	return `codex/${Number(issueNumber)}-implementer`;
}
