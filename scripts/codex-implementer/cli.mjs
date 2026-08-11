#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import {
	applyCandidatePatch,
	assertCandidateWorkspaceState,
	assertCommittedCandidateState,
	assertRepositoryPathFacts,
	byteLength,
	canonicalJson,
	createTaskSnapshot,
	createValidationEvidence,
	deterministicBranchName,
	implementationRoot,
	loadImplementerPolicy,
	PolicyError,
	parseAuthorizedPathsJson,
	sha256,
	validateImplementationResult,
	validateIssueForExecution,
	validatePublisherState,
	validateTaskSnapshot,
	validateTrigger,
	validateValidationEvidence,
	verifyIssueSnapshot,
} from "./policy.mjs";

function requiredEnvironment(name) {
	const value = process.env[name];
	if (!value)
		throw new PolicyError("ENVIRONMENT_MISSING", `${name} is required`);
	return value;
}

function positiveInteger(raw, label) {
	if (!/^[1-9]\d{0,9}$/u.test(raw)) {
		throw new PolicyError(
			"INTEGER_INVALID",
			`${label} must be a positive integer`,
		);
	}
	const value = Number(raw);
	if (!Number.isSafeInteger(value)) {
		throw new PolicyError(
			"INTEGER_INVALID",
			`${label} is outside the safe range`,
		);
	}
	return value;
}

function decodeBase64(raw, maximumBytes, label) {
	if (raw.length > Math.ceil((maximumBytes * 4) / 3) + 8) {
		throw new PolicyError(
			"INPUT_TOO_LARGE",
			`${label} encoding exceeds policy`,
		);
	}
	if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(raw) || raw.length % 4 !== 0) {
		throw new PolicyError(
			"BASE64_INVALID",
			`${label} must be canonical base64`,
		);
	}
	const buffer = Buffer.from(raw, "base64");
	if (buffer.toString("base64") !== raw || buffer.length > maximumBytes) {
		throw new PolicyError(
			"BASE64_INVALID",
			`${label} base64 is invalid or oversized`,
		);
	}
	return buffer.toString("utf8");
}

function decodeJsonBase64(raw, maximumBytes, label) {
	let parsed;
	try {
		parsed = JSON.parse(decodeBase64(raw, maximumBytes, label));
	} catch (error) {
		if (error instanceof PolicyError) throw error;
		throw new PolicyError("JSON_INVALID", `${label} must contain JSON`);
	}
	return parsed;
}

function base64(value) {
	return Buffer.from(value, "utf8").toString("base64");
}

async function appendOutput(name, value) {
	if (!/^[a-z][a-z0-9_]*$/u.test(name) || /[\r\n]/u.test(value)) {
		throw new PolicyError(
			"OUTPUT_INVALID",
			"workflow output is not single-line safe",
		);
	}
	await writeFile(requiredEnvironment("GITHUB_OUTPUT"), `${name}=${value}\n`, {
		flag: "a",
		encoding: "utf8",
	});
}

function apiHeaders() {
	return {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${requiredEnvironment("GITHUB_TOKEN")}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
}

async function githubRequest(path, { allowNotFound = false } = {}) {
	if (!path.startsWith("/repos/openapi-to/openapi-to/")) {
		throw new PolicyError(
			"GITHUB_PATH_INVALID",
			"GitHub API path is outside policy",
		);
	}
	const response = await fetch(`https://api.github.com${path}`, {
		headers: apiHeaders(),
		redirect: "error",
		signal: AbortSignal.timeout(15_000),
	});
	if (allowNotFound && response.status === 404) return undefined;
	if (!response.ok) {
		const code =
			response.status === 404 ? "ISSUE_NOT_FOUND" : "GITHUB_API_FAILED";
		throw new PolicyError(
			code,
			`GitHub API request failed with ${response.status}`,
		);
	}
	const text = await response.text();
	if (byteLength(text) > 192 * 1024) {
		throw new PolicyError(
			"GITHUB_RESPONSE_TOO_LARGE",
			"GitHub response exceeds policy",
		);
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new PolicyError(
			"GITHUB_RESPONSE_INVALID",
			"GitHub response is not JSON",
		);
	}
}

async function fetchIssue(issueNumber) {
	return githubRequest(`/repos/openapi-to/openapi-to/issues/${issueNumber}`, {
		allowNotFound: true,
	});
}

async function fetchCurrentMainSha() {
	const ref = await githubRequest(
		"/repos/openapi-to/openapi-to/git/ref/heads/main",
	);
	const sha = ref?.object?.sha;
	if (!/^[a-f0-9]{40}$/u.test(sha ?? "")) {
		throw new PolicyError(
			"MAIN_REF_INVALID",
			"authoritative main ref is malformed",
		);
	}
	return sha;
}

async function publicationCollisions(branchName) {
	const branch = await githubRequest(
		`/repos/openapi-to/openapi-to/git/ref/heads/${encodeURIComponent(branchName)}`,
		{ allowNotFound: true },
	);
	const query = new URLSearchParams({
		head: `openapi-to:${branchName}`,
		per_page: "2",
		state: "open",
	});
	const pulls = await githubRequest(
		`/repos/openapi-to/openapi-to/pulls?${query.toString()}`,
	);
	if (!Array.isArray(pulls)) {
		throw new PolicyError(
			"PULL_REQUEST_RESPONSE_INVALID",
			"pull request lookup failed",
		);
	}
	return {
		branchExists: Boolean(branch),
		openPullRequestExists: pulls.length > 0,
	};
}

function currentHead(root = implementationRoot) {
	const head = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 64 * 1024,
	}).trim();
	if (!/^[a-f0-9]{40}$/u.test(head)) {
		throw new PolicyError("HEAD_INVALID", "checkout HEAD is malformed");
	}
	return head;
}

function parseSnapshot(policy) {
	const snapshot = decodeJsonBase64(
		requiredEnvironment("TASK_SNAPSHOT_BASE64"),
		policy.limits.issueBodyBytes * 2,
		"task snapshot",
	);
	return validateTaskSnapshot(snapshot, policy);
}

async function assertLiveFeatureEnabled(policy) {
	const variable = await githubRequest(
		`/repos/openapi-to/openapi-to/actions/variables/${policy.featureGate.variable}`,
		{ allowNotFound: true },
	);
	if (
		variable?.name !== policy.featureGate.variable ||
		variable?.value !== policy.featureGate.enabledValue
	) {
		throw new PolicyError(
			"FEATURE_DISABLED",
			"Codex implementer live feature gate is disabled",
		);
	}
}

async function preflight(policy) {
	validateTrigger(
		{
			actor: requiredEnvironment("GITHUB_ACTOR"),
			featureGate: process.env[policy.featureGate.variable] ?? "",
			ref: requiredEnvironment("GITHUB_REF"),
			repository: requiredEnvironment("GITHUB_REPOSITORY"),
			repositoryId: requiredEnvironment("GITHUB_REPOSITORY_ID"),
			runAttempt: requiredEnvironment("DISPATCH_RUN_ATTEMPT"),
			triggeringActor: requiredEnvironment("DISPATCH_TRIGGERING_ACTOR"),
		},
		policy,
	);
	const issueNumber = positiveInteger(
		requiredEnvironment("ISSUE_NUMBER"),
		"Issue number",
	);
	const authorizedPaths = parseAuthorizedPathsJson(
		requiredEnvironment("AUTHORIZED_PATHS_JSON"),
		policy,
	);
	for (const path of authorizedPaths) {
		await assertRepositoryPathFacts(implementationRoot, path);
	}
	const baseSha = requiredEnvironment("GITHUB_SHA");
	if (currentHead() !== baseSha || (await fetchCurrentMainSha()) !== baseSha) {
		throw new PolicyError(
			"BASE_SHA_STALE",
			"dispatch checkout is not current main",
		);
	}
	const issue = await fetchIssue(issueNumber);
	const parsedIssue = validateIssueForExecution(issue, issueNumber, policy);
	const snapshot = createTaskSnapshot({
		authorizedPaths,
		baseSha,
		dispatchActor: requiredEnvironment("GITHUB_ACTOR"),
		dispatchRunAttempt: requiredEnvironment("DISPATCH_RUN_ATTEMPT"),
		dispatchTriggeringActor: requiredEnvironment("DISPATCH_TRIGGERING_ACTOR"),
		issue,
		issueNumber,
		parsedIssue,
		policy,
	});
	await appendOutput("base_sha", snapshot.baseSha);
	await appendOutput("snapshot_base64", base64(canonicalJson(snapshot)));
	await appendOutput("snapshot_hash", snapshot.taskSnapshotHash);
}

function assertInsideRunnerTemp(path) {
	const runnerTemp = resolve(requiredEnvironment("RUNNER_TEMP"));
	const target = resolve(path);
	if (target !== runnerTemp && !target.startsWith(`${runnerTemp}${sep}`)) {
		throw new PolicyError(
			"TEMP_PATH_INVALID",
			"runtime material belongs in runner temp",
		);
	}
	return target;
}

async function materialize(policy) {
	const snapshot = parseSnapshot(policy);
	if (snapshot.baseSha !== currentHead()) {
		throw new PolicyError(
			"BASE_SHA_MISMATCH",
			"implementation checkout is not task base",
		);
	}
	const snapshotPath = assertInsideRunnerTemp(
		requiredEnvironment("CODEX_TASK_SNAPSHOT_PATH"),
	);
	const codexHome = assertInsideRunnerTemp(
		requiredEnvironment("CODEX_HOME_PATH"),
	);
	await mkdir(codexHome, { recursive: true, mode: 0o700 });
	await writeFile(snapshotPath, `${canonicalJson(snapshot)}\n`, {
		encoding: "utf8",
		mode: 0o444,
	});
	await chmod(snapshotPath, 0o444);
	const config = `default_permissions = "bounded-implementer"

[permissions.bounded-implementer]
description = "Workspace edits with Root-of-Trust read-only and no command network"
extends = ":workspace"

[permissions.bounded-implementer.filesystem.":workspace_roots"]
".github" = "read"
".agents" = "read"
".changeset" = "read"
".codex" = "read"
".gitmodules" = "read"
".npmrc" = "read"
"docs/agents" = "read"
"docs/ai-hosts" = "read"
"docs/maintainers" = "read"
"docs/setup-skill.md" = "read"
"docs/skills.md" = "read"
"scripts/codex-implementer" = "read"
"scripts/release" = "read"
"scripts/repository-contract.mjs" = "read"
"scripts/repository-contract.node-test.mjs" = "read"
"AGENTS.md" = "read"
"package.json" = "read"
"pnpm-lock.yaml" = "read"
"pnpm-workspace.yaml" = "read"
"turbo.json" = "read"
"biome.json" = "read"
"tsconfig.json" = "read"
"**/AGENTS.md" = "read"
"**/package.json" = "read"
"**/package-lock.json" = "read"
"**/npm-shrinkwrap.json" = "read"
"**/pnpm-lock.yaml" = "read"
"**/pnpm-workspace.yaml" = "read"
"**/yarn.lock" = "read"
"**/bun.lock" = "read"
"**/bun.lockb" = "read"
"**/.npmrc" = "read"
"**/.yarnrc" = "read"
"**/.yarnrc.yml" = "read"
"**/biome.json" = "read"
"**/turbo.json" = "read"
"**/deno.json" = "read"
"**/deno.jsonc" = "read"
"**/tsconfig.json" = "read"
"**/tsconfig.*.json" = "read"
"**/babel.config.*" = "read"
"**/eslint.config.*" = "read"
"**/jest.config.*" = "read"
"**/playwright.config.*" = "read"
"**/prettier.config.*" = "read"
"**/rollup.config.*" = "read"
"**/tsup.config.*" = "read"
"**/vite.config.*" = "read"
"**/vitest.config.*" = "read"
"**/webpack.config.*" = "read"
"**/.env" = "deny"
"**/.env.*" = "deny"

[permissions.bounded-implementer.network]
enabled = false
`;
	await writeFile(join(codexHome, "config.toml"), config, {
		encoding: "utf8",
		mode: 0o600,
	});
}

async function validateResult(policy) {
	const snapshot = parseSnapshot(policy);
	if (snapshot.baseSha !== currentHead()) {
		throw new PolicyError(
			"BASE_SHA_MISMATCH",
			"validation checkout is not task base",
		);
	}
	const resultPath = assertInsideRunnerTemp(
		requiredEnvironment("CODEX_RESULT_PATH"),
	);
	let resultText;
	try {
		resultText = await readFile(resultPath, "utf8");
	} catch {
		throw new PolicyError(
			"RESULT_FILE_INVALID",
			"structured result file is invalid",
		);
	}
	if (byteLength(resultText) > policy.limits.resultBytes) {
		throw new PolicyError(
			"RESULT_TOO_LARGE",
			"structured result exceeds policy",
		);
	}
	const result = validateImplementationResult(resultText, snapshot, policy);
	const patchFacts = await applyCandidatePatch({
		authorizedPaths: snapshot.authorizedPaths,
		claimedChangedPaths: result.claimedChangedPaths,
		patch: result.proposedPatch,
		policy,
		root: implementationRoot,
	});
	const statePath = assertInsideRunnerTemp(
		requiredEnvironment("CODEX_VALIDATION_STATE_PATH"),
	);
	await writeFile(
		statePath,
		`${canonicalJson({
			changedPaths: patchFacts.changedPaths,
			initialPatchSha256: patchFacts.patchSha256,
			taskSnapshotHash: snapshot.taskSnapshotHash,
		})}\n`,
		{ encoding: "utf8", mode: 0o600 },
	);
}

async function finalizeValidation(policy) {
	const snapshot = parseSnapshot(policy);
	const statePath = assertInsideRunnerTemp(
		requiredEnvironment("CODEX_VALIDATION_STATE_PATH"),
	);
	let state;
	try {
		state = JSON.parse(await readFile(statePath, "utf8"));
	} catch {
		throw new PolicyError(
			"VALIDATION_STATE_INVALID",
			"validation state is invalid",
		);
	}
	if (state.taskSnapshotHash !== snapshot.taskSnapshotHash) {
		throw new PolicyError(
			"VALIDATION_STATE_STALE",
			"validation state belongs to another task",
		);
	}
	const patchFacts = assertCandidateWorkspaceState(
		implementationRoot,
		state.changedPaths,
		policy,
	);
	if (patchFacts.patchSha256 !== state.initialPatchSha256) {
		throw new PolicyError(
			"CANDIDATE_DRIFT",
			"candidate changed during validation",
		);
	}
	const evidence = createValidationEvidence({ patchFacts, snapshot, policy });
	const bundlePath = assertInsideRunnerTemp(
		requiredEnvironment("VALIDATED_BUNDLE_PATH"),
	);
	await writeFile(
		bundlePath,
		`${canonicalJson({
			schemaVersion: "codex-validated-bundle-v1",
			validatedPatch: patchFacts.canonicalPatch,
			validationEvidence: evidence,
		})}\n`,
		{ encoding: "utf8", mode: 0o600 },
	);
	await appendOutput("patch_sha256", patchFacts.patchSha256);
}

async function parsePublicationInputs(policy) {
	const snapshot = parseSnapshot(policy);
	const bundlePath = assertInsideRunnerTemp(
		requiredEnvironment("VALIDATED_BUNDLE_PATH"),
	);
	let bundleText;
	try {
		bundleText = await readFile(bundlePath, "utf8");
	} catch {
		throw new PolicyError(
			"VALIDATED_BUNDLE_INVALID",
			"validated bundle is invalid",
		);
	}
	// JSON escaping can expand a valid text patch to six bytes per source byte.
	if (byteLength(bundleText) > policy.limits.patchBytes * 6 + 96 * 1024) {
		throw new PolicyError(
			"VALIDATED_BUNDLE_TOO_LARGE",
			"validated bundle exceeds policy",
		);
	}
	let bundle;
	try {
		bundle = JSON.parse(bundleText);
	} catch {
		throw new PolicyError(
			"VALIDATED_BUNDLE_INVALID",
			"validated bundle is not JSON",
		);
	}
	if (
		!bundle ||
		typeof bundle !== "object" ||
		Array.isArray(bundle) ||
		JSON.stringify(Object.keys(bundle).sort()) !==
			JSON.stringify(
				["schemaVersion", "validatedPatch", "validationEvidence"].sort(),
			) ||
		bundle.schemaVersion !== "codex-validated-bundle-v1"
	) {
		throw new PolicyError(
			"VALIDATED_BUNDLE_INVALID",
			"validated bundle field set is invalid",
		);
	}
	const evidence = validateValidationEvidence(
		bundle.validationEvidence,
		snapshot,
		policy,
	);
	const patch = bundle.validatedPatch;
	if (
		typeof patch !== "string" ||
		byteLength(patch) > policy.limits.patchBytes
	) {
		throw new PolicyError("PATCH_TOO_LARGE", "validated patch exceeds policy");
	}
	if (sha256(patch) !== evidence.patchSha256) {
		throw new PolicyError(
			"PATCH_HASH_MISMATCH",
			"validated patch hash is invalid",
		);
	}
	return { evidence, patch, snapshot };
}

async function verifyPublisher(policy) {
	await assertLiveFeatureEnabled(policy);
	const { evidence, patch, snapshot } = await parsePublicationInputs(policy);
	if (snapshot.baseSha !== currentHead()) {
		throw new PolicyError(
			"BASE_SHA_MISMATCH",
			"publisher checkout is not task base",
		);
	}
	const issue = await fetchIssue(snapshot.issue.number);
	verifyIssueSnapshot(snapshot, issue, policy);
	const branchName = deterministicBranchName(snapshot.issue.number);
	const collisions = await publicationCollisions(branchName);
	validatePublisherState({
		baseSha: snapshot.baseSha,
		...collisions,
		currentMainSha: await fetchCurrentMainSha(),
	});
	const patchFacts = await applyCandidatePatch({
		authorizedPaths: snapshot.authorizedPaths,
		claimedChangedPaths: evidence.changedPaths,
		patch,
		policy,
		root: implementationRoot,
	});
	if (patchFacts.patchSha256 !== evidence.patchSha256) {
		throw new PolicyError(
			"PATCH_HASH_MISMATCH",
			"publisher patch is not validated bytes",
		);
	}
	const publisherStatePath = assertInsideRunnerTemp(
		requiredEnvironment("PUBLISHER_STATE_PATH"),
	);
	const prBodyPath = assertInsideRunnerTemp(
		requiredEnvironment("PR_BODY_PATH"),
	);
	await writeFile(
		publisherStatePath,
		`${canonicalJson({
			branchName,
			evidence,
			prBodyPath,
			snapshot,
		})}\n`,
		{ encoding: "utf8", mode: 0o600 },
	);
	await appendOutput("branch_name", branchName);
	await appendOutput(
		"pr_title_base64",
		base64(`Bounded Codex implementation for Issue #${snapshot.issue.number}`),
	);
	await appendOutput("pr_body_path", prBodyPath);
}

async function recheckPublicationAuthority(
	policy,
	{ verifyBranchHead = false } = {},
) {
	await assertLiveFeatureEnabled(policy);
	const snapshot = parseSnapshot(policy);
	const issue = await fetchIssue(snapshot.issue.number);
	verifyIssueSnapshot(snapshot, issue, policy);
	if ((await fetchCurrentMainSha()) !== snapshot.baseSha) {
		throw new PolicyError(
			"MAIN_STALE",
			"authoritative main changed before publication",
		);
	}
	if (verifyBranchHead) {
		const branchName = deterministicBranchName(snapshot.issue.number);
		const branch = await githubRequest(
			`/repos/openapi-to/openapi-to/git/ref/heads/${encodeURIComponent(branchName)}`,
		);
		if (branch?.object?.sha !== currentHead()) {
			throw new PolicyError(
				"REMOTE_HEAD_MISMATCH",
				"runtime branch does not match the validated committed head",
			);
		}
	}
}

function boundedEvidence(value, maximum = 96) {
	if (!/^[A-Za-z0-9._:/ -]+$/u.test(value) || value.length > maximum) {
		throw new PolicyError(
			"EVIDENCE_VALUE_INVALID",
			"publisher evidence is malformed",
		);
	}
	return value;
}

async function renderPullRequestBody(policy) {
	const statePath = assertInsideRunnerTemp(
		requiredEnvironment("PUBLISHER_STATE_PATH"),
	);
	let state;
	try {
		state = JSON.parse(await readFile(statePath, "utf8"));
	} catch {
		throw new PolicyError(
			"PUBLISHER_STATE_INVALID",
			"publisher state is invalid",
		);
	}
	const { evidence, snapshot } = await parsePublicationInputs(policy);
	if (
		state.snapshot.taskSnapshotHash !== snapshot.taskSnapshotHash ||
		state.evidence.evidenceHash !== evidence.evidenceHash
	) {
		throw new PolicyError(
			"PUBLISHER_STATE_STALE",
			"publisher state binding is stale",
		);
	}
	const patchFacts = assertCommittedCandidateState(
		implementationRoot,
		snapshot.baseSha,
		evidence.changedPaths,
		policy,
	);
	if (patchFacts.patchSha256 !== evidence.patchSha256) {
		throw new PolicyError(
			"CANDIDATE_DRIFT",
			"published candidate differs from validation",
		);
	}
	const headSha = currentHead();
	const runId = boundedEvidence(requiredEnvironment("GITHUB_RUN_ID"));
	const runAttempt = boundedEvidence(requiredEnvironment("GITHUB_RUN_ATTEMPT"));
	const paths = snapshot.authorizedPaths
		.map((path) => `- \`${path}\``)
		.join("\n");
	const body = `## Bounded implementation evidence

- Closes #${snapshot.issue.number}
- Authorization mode: MANUAL
- Task snapshot SHA-256: \`${snapshot.taskSnapshotHash}\`
- Base SHA: \`${snapshot.baseSha}\`
- Validated patch SHA-256: \`${evidence.patchSha256}\`
- Published head SHA: \`${headSha}\`
- Trigger policy: \`${snapshot.triggerPolicyVersion}\`
- Path policy: \`${snapshot.pathPolicyVersion}\`
- Validation policy: \`${evidence.validationPolicyVersion}\`
- Workflow run: \`${runId}\` (attempt \`${runAttempt}\`)

## Authorized paths

${paths}

## Validation

The fresh validation job applied and sealed the structured patch, recomputed
the actual diff, rejected unexpected tracked or untracked drift, and completed
the fixed repository-owned command set inside an unprivileged, no-network,
credential-free container bound by the validation evidence hash.

Independent autonomous review: **NOT YET PERFORMED**

Autonomous Policy Gate: **NOT IMPLEMENTED**

Enqueue authority: **NOT GRANTED**

Merge authority: **NOT GRANTED**

This pull request remains Draft. Its text and the model's output do not grant
runtime, enqueue, or merge authority.
`;
	await writeFile(assertInsideRunnerTemp(state.prBodyPath), body, {
		encoding: "utf8",
		mode: 0o600,
	});
}

async function main() {
	const command = process.argv[2];
	const policy = await loadImplementerPolicy();
	switch (command) {
		case "preflight":
			await preflight(policy);
			break;
		case "materialize":
			await materialize(policy);
			break;
		case "validate-result":
			await validateResult(policy);
			break;
		case "finalize-validation":
			await finalizeValidation(policy);
			break;
		case "verify-publisher":
			await verifyPublisher(policy);
			break;
		case "recheck-publication-authority":
			await recheckPublicationAuthority(policy);
			break;
		case "verify-publication-head":
			await recheckPublicationAuthority(policy, { verifyBranchHead: true });
			break;
		case "render-pr-body":
			await renderPullRequestBody(policy);
			break;
		default:
			throw new PolicyError(
				"COMMAND_INVALID",
				"unknown implementer policy command",
			);
	}
}

try {
	await main();
} catch (error) {
	const code =
		error instanceof PolicyError ? error.code : "IMPLEMENTER_POLICY_FAILED";
	const message =
		error instanceof PolicyError
			? error.message
			: "trusted policy command failed";
	process.stderr.write(
		`::error title=Codex implementer policy::${code}: ${message}\n`,
	);
	process.exitCode = 1;
}
