import path from "node:path";
import { PluginManager } from "@openapi-to/core";
import { describe, expect, it } from "vitest";
import { definePlugin } from "./plugin.ts";

const fixture = {
	openapi: "3.0.3",
	info: { title: "Zod 4 fixture", version: "1.0.0" },
	paths: {},
	components: {
		schemas: {
			Profile: {
				type: "object",
				required: ["email"],
				additionalProperties: false,
				properties: {
					email: { type: "string", format: "email" },
					"user-id": { type: "string" },
				},
			},
			ProfileMap: {
				type: "object",
				additionalProperties: { $ref: "#/components/schemas/Profile" },
			},
			Choice: {
				oneOf: [{ type: "string" }, { type: "number" }],
			},
			Combined: {
				allOf: [
					{
						type: "object",
						required: ["left"],
						properties: { left: { type: "string" } },
					},
					{
						type: "object",
						required: ["right"],
						properties: { right: { type: "boolean" } },
					},
				],
			},
			Node: {
				type: "object",
				required: ["value"],
				additionalProperties: false,
				properties: {
					value: { type: "string" },
					children: {
						type: "array",
						items: { $ref: "#/components/schemas/Node" },
					},
				},
			},
		},
	},
};

async function generatedSources() {
	const output = path.resolve("packages/plugin-zod/test-output");
	const manager = new PluginManager(
		{
			root: "",
			plugins: [definePlugin()],
			input: { path: "" },
			output: { dir: output },
		},
		fixture as never,
	);
	const result = await manager.execute();
	return {
		diagnostics: result.diagnostics,
		files: Object.fromEntries(
			result.sourceFiles
				.map<[string, string]>((sourceFile) => [
					path
						.relative(output, sourceFile.getFilePath())
						.split(path.sep)
						.join("/"),
					sourceFile.getFullText(),
				])
				.sort(([left], [right]) => left.localeCompare(right)),
		),
	};
}

describe("Zod 4 plugin integration", () => {
	it("generates executable Zod 4 schemas with safe imports and stable bytes", async () => {
		const first = await generatedSources();
		const second = await generatedSources();
		expect(first).toEqual(second);
		expect(first.diagnostics).toEqual([]);
		expect(Object.keys(first.files)).toEqual([
			"zod/models/choice.schema.ts",
			"zod/models/combined.schema.ts",
			"zod/models/node.schema.ts",
			"zod/models/profile-map.schema.ts",
			"zod/models/profile.schema.ts",
		]);

		const all = Object.values(first.files).join("\n");
		expect(all).toContain('import { z } from "zod"');
		expect(all).toContain("z.email()");
		expect(all).toContain("z.union([z.string(), z.number()])");
		expect(all).toContain("z.intersection(");
		expect(all).toContain("z.record(z.string(), profileSchema)");
		expect(all).toContain('"user-id": z.string().optional()');
		expect(all).not.toMatch(/z\.string\(\)\.(?:email|url|uuid|datetime)\(/);
		expect(all).not.toMatch(/\bz\.record\(\s*[^,()]+(?:\([^()]*\))?\s*\)/);
		expect(all).not.toContain("z.string() | z.number()");
		expect(all).not.toContain("z.string() &");

		expect(first.files["zod/models/profile-map.schema.ts"]).toContain(
			'import { profileSchema } from "./profile.schema.ts"',
		);
		expect(first.files["zod/models/profile-map.schema.ts"]).not.toContain(
			"z.lazy",
		);
		expect(first.files["zod/models/node.schema.ts"]).toContain(
			"export const nodeSchema: z.ZodType<unknown>",
		);
		expect(first.files["zod/models/node.schema.ts"]).toContain(
			"z.lazy(() => nodeSchema)",
		);
		expect(first.files["zod/models/node.schema.ts"]).not.toContain(
			'from "./node.schema"',
		);
	});
});
