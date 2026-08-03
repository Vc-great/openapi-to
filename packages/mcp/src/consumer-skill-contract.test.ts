import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import {
	applyGenerationInputSchema,
	generateDryRunInputSchema,
	prepareGenerationInputSchema,
} from "./tools/index.ts";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
);
const skillFiles = [
	".agents/skills/openapi-to-generate/SKILL.md",
	".agents/skills/openapi-to-generate/references/mcp-workflow.md",
	".agents/skills/openapi-to-generate/references/controlled-write.md",
] as const;
const inputSchemas = {
	openapi_generate_dry_run: generateDryRunInputSchema,
	openapi_prepare_generation: prepareGenerationInputSchema,
	openapi_apply_generation: applyGenerationInputSchema,
} as const;
type ToolName = keyof typeof inputSchemas;
type ToolInputExample = {
	file: string;
	name: string;
	tool: ToolName;
	input: Record<string, unknown>;
};

function exampleLocation(
	example: Pick<ToolInputExample, "file" | "name" | "tool">,
): string {
	return `${example.file}: Tool input ${example.tool} — ${example.name}`;
}

async function readToolInputExamples(): Promise<ToolInputExample[]> {
	const examples: ToolInputExample[] = [];
	const pattern =
		/Tool input: `(openapi_[a-z_]+)` — ([^\n]+)\n\n```json\n([\s\S]*?)\n```/g;

	for (const file of skillFiles) {
		const contents = await readFile(join(repositoryRoot, file), "utf8");
		const markerCount = [...contents.matchAll(/Tool input:/g)].length;
		let parsedCount = 0;
		for (const match of contents.matchAll(pattern)) {
			parsedCount += 1;
			const [, tool, name, json] = match;
			if (!tool || !name || json === undefined) {
				throw new Error(
					`${file}: marked MCP Tool input is missing its Tool name, example name, or JSON body`,
				);
			}
			if (!(tool in inputSchemas))
				throw new Error(`${file}: unsupported marked MCP Tool ${tool}`);
			let input: unknown;
			try {
				input = JSON.parse(json);
			} catch (error) {
				throw new Error(
					`${file}: Tool input ${tool} — ${name} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
			if (input === null || typeof input !== "object" || Array.isArray(input)) {
				throw new Error(
					`${file}: Tool input ${tool} — ${name} must be one JSON object`,
				);
			}
			examples.push({
				file,
				name,
				tool: tool as ToolName,
				input: input as Record<string, unknown>,
			});
		}
		if (parsedCount !== markerCount) {
			throw new Error(
				`${file}: found ${markerCount} Tool input marker(s), but only ${parsedCount} matched the documented marker and JSON block format`,
			);
		}
	}

	return examples;
}

function validateToolInputExample(example: ToolInputExample): void {
	const location = exampleLocation(example);
	const parsed = inputSchemas[example.tool].safeParse(example.input);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
			.join("; ");
		throw new Error(
			`${location} does not match the current MCP inputSchema: ${issues}`,
		);
	}
	if (!isDeepStrictEqual(parsed.data, example.input)) {
		throw new Error(
			`${location} contains unknown fields that the current MCP inputSchema would discard`,
		);
	}

	if (example.tool === "openapi_generate_dry_run") {
		const { targets, scope } = example.input;
		if (!Array.isArray(targets) || targets.length !== 1) {
			throw new Error(`${location} must pass exactly one Target`);
		}
		if (
			scope === null ||
			typeof scope !== "object" ||
			Array.isArray(scope) ||
			(scope as Record<string, unknown>).type !== "operations" ||
			!Array.isArray((scope as Record<string, unknown>).operationKeys) ||
			((scope as Record<string, unknown>).operationKeys as unknown[]).length ===
				0
		) {
			throw new Error(
				`${location} must use operations scope with non-empty operationKeys`,
			);
		}
	}

	if (example.tool === "openapi_prepare_generation") {
		const { targets, selection } = example.input;
		if (!Array.isArray(targets) || targets.length !== 1) {
			throw new Error(`${location} must pass exactly one Target`);
		}
		if (
			selection === null ||
			typeof selection !== "object" ||
			Array.isArray(selection) ||
			!["add", "replace"].includes(
				String((selection as Record<string, unknown>).type),
			) ||
			!Array.isArray((selection as Record<string, unknown>).operationKeys) ||
			((selection as Record<string, unknown>).operationKeys as unknown[])
				.length === 0
		) {
			throw new Error(
				`${location} must use a supported selection with non-empty operationKeys`,
			);
		}
	}
}

describe("openapi-to-generate Tool input examples", () => {
	let examples: ToolInputExample[];

	beforeAll(async () => {
		examples = await readToolInputExamples();
	});

	it("parses every marked JSON example with the actual exported MCP Zod inputSchema", () => {
		expect(new Set(examples.map(({ tool }) => tool))).toEqual(
			new Set(Object.keys(inputSchemas)),
		);
		for (const example of examples) validateToolInputExample(example);
	});

	it("rejects an operation-scoped Dry Run example when its exact Target is removed", () => {
		const original = examples.find(
			({ tool }) => tool === "openapi_generate_dry_run",
		);
		expect(original).toBeDefined();
		const input = structuredClone(original?.input ?? {});
		delete input.targets;
		expect(() =>
			validateToolInputExample({ ...(original as ToolInputExample), input }),
		).toThrow(/must pass exactly one Target/);
	});

	it("rejects fields that a non-strict production inputSchema would otherwise discard", () => {
		const original = examples.find(
			({ tool }) => tool === "openapi_generate_dry_run",
		);
		expect(original).toBeDefined();
		const input = {
			...structuredClone(original?.input ?? {}),
			unrecognizedExampleField: true,
		};
		expect(() =>
			validateToolInputExample({ ...(original as ToolInputExample), input }),
		).toThrow(/contains unknown fields/);
	});

	it("rejects an invalid replace example through the actual Prepare inputSchema", () => {
		const original = examples.find(
			({ tool, input }) =>
				tool === "openapi_prepare_generation" &&
				(input.selection as Record<string, unknown> | undefined)?.type ===
					"replace",
		);
		expect(original).toBeDefined();
		const input = structuredClone(original?.input ?? {});
		(input.selection as Record<string, unknown>).operationKeys = [];
		expect(() =>
			validateToolInputExample({ ...(original as ToolInputExample), input }),
		).toThrow(/does not match the current MCP inputSchema/);
	});
});
