import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

export class PublicationShaGuardError extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

async function resolveCommit(root, revision, code, message) {
	try {
		const { stdout } = await execFileAsync(
			"git",
			["rev-parse", "--verify", `${revision}^{commit}`],
			{
				cwd: root,
				encoding: "utf8",
			},
		);
		return stdout.trim();
	} catch {
		throw new PublicationShaGuardError(code, message);
	}
}

export async function verifyPublicationSha({
	root = repositoryRoot,
	expectedSha,
	githubSha,
	githubRef,
	resolveCheckoutSha = () =>
		resolveCommit(
			root,
			"HEAD",
			"CHECKOUT_HEAD_UNAVAILABLE",
			"Unable to resolve the current checkout HEAD.",
		),
	resolveRemoteSha = () =>
		resolveCommit(
			root,
			"refs/remotes/origin/main",
			"REMOTE_MAIN_UNAVAILABLE",
			"Unable to resolve the fetched origin/main commit.",
		),
} = {}) {
	if (!/^[0-9a-f]{40}$/.test(expectedSha ?? "")) {
		throw new PublicationShaGuardError(
			"INVALID_EXPECTED_SHA",
			"expected_sha must be a full lowercase 40-character commit SHA.",
		);
	}
	if (githubRef !== "refs/heads/main") {
		throw new PublicationShaGuardError(
			"INVALID_PUBLICATION_REF",
			"Publication must be dispatched from refs/heads/main.",
		);
	}
	if (githubSha !== expectedSha) {
		throw new PublicationShaGuardError(
			"DISPATCH_SHA_MISMATCH",
			"expected_sha does not match the GitHub Actions dispatch commit.",
		);
	}

	const checkoutHead = await resolveCheckoutSha();
	if (checkoutHead !== expectedSha) {
		throw new PublicationShaGuardError(
			"CHECKOUT_HEAD_SHA_MISMATCH",
			"Current checkout HEAD does not match expected_sha.",
		);
	}

	const remoteMain = await resolveRemoteSha();
	if (remoteMain !== expectedSha) {
		throw new PublicationShaGuardError(
			"REMOTE_MAIN_SHA_MISMATCH",
			"Fetched origin/main does not match expected_sha.",
		);
	}

	return {
		success: true,
		expectedSha,
		githubSha,
		githubRef,
		checkoutHead,
		remoteMain,
	};
}

function parseArguments(argv) {
	const options = { root: repositoryRoot };
	const allowedArguments = new Set([
		"--expected-sha",
		"--github-sha",
		"--github-ref",
		"--root",
	]);
	for (let index = 0; index < argv.length; index += 2) {
		const argument = argv[index];
		if (!allowedArguments.has(argument) || index + 1 >= argv.length) {
			throw new PublicationShaGuardError(
				"INVALID_ARGUMENT",
				`Unknown or incomplete argument: ${argument ?? "<missing>"}`,
			);
		}
		const value = argv[index + 1];
		if (argument === "--expected-sha") options.expectedSha = value;
		else if (argument === "--github-sha") options.githubSha = value;
		else if (argument === "--github-ref") options.githubRef = value;
		else options.root = resolve(value);
	}
	return options;
}

function writeJson(result) {
	process.stdout.write(`${JSON.stringify(result)}\n`);
}

export async function main(argv = process.argv.slice(2)) {
	try {
		writeJson(await verifyPublicationSha(parseArguments(argv)));
	} catch (error) {
		const code =
			error instanceof PublicationShaGuardError
				? error.code
				: "PUBLICATION_SHA_GUARD_FAILED";
		const message =
			error instanceof Error ? error.message : "Publication SHA guard failed.";
		writeJson({ success: false, code });
		process.stderr.write(`${code}: ${message}\n`);
		process.exitCode = 1;
	}
}

if (
	process.argv[1] &&
	(await realpath(resolve(process.argv[1]))) ===
		(await realpath(fileURLToPath(import.meta.url)))
) {
	await main();
}
