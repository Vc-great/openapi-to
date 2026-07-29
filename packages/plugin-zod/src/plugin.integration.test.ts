import path from "node:path";
import { PluginManager } from "@openapi-to/core";
import { describe, expect, it } from "vitest";
import { definePlugin } from "./plugin.ts";

const fixture = {
	openapi: "3.1.0",
	info: { title: "Zod 4 fixture", version: "1.0.0" },
	paths: {
		"/users/{id}": {
			get: {
				operationId: "getUser",
				tags: ["Users"],
				parameters: [{ $ref: "#/components/parameters/TraceId" }],
				responses: {
					"200": {
						description: "Found",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/UserInput" },
							},
						},
					},
					"404": { $ref: "#/components/responses/NotFound" },
				},
			},
		},
		"/search": {
			get: {
				operationId: "searchUsers",
				tags: ["Users"],
				parameters: [{ $ref: "#/components/parameters/Search" }],
				responses: {
					"200": {
						description: "Text",
						content: {
							"application/json": { schema: { type: "string" } },
						},
					},
					"201": {
						description: "Number",
						content: {
							"application/json": { schema: { type: "number" } },
						},
					},
					"400": {
						description: "Inline error",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorBody" },
							},
						},
					},
					"404": { $ref: "#/components/responses/NotFound" },
				},
			},
		},
		"/no-content": {
			get: {
				operationId: "noContent",
				tags: ["Users"],
				responses: {
					"204": { description: "No content" },
					"400": {
						description: "Bad",
						content: {
							"application/json": { schema: { type: "string" } },
						},
					},
				},
			},
		},
		"/errors-only": {
			get: {
				operationId: "errorsOnly",
				tags: ["Users"],
				responses: {
					"400": {
						description: "Inline error",
						content: {
							"application/json": { schema: { type: "string" } },
						},
					},
					"404": { $ref: "#/components/responses/NotFound" },
				},
			},
		},
		"/only-no-content": {
			get: {
				operationId: "onlyNoContent",
				tags: ["Users"],
				responses: { "204": { description: "No content" } },
			},
		},
		"/default": {
			get: {
				operationId: "defaultResponse",
				tags: ["Users"],
				responses: {
					default: {
						description: "Default",
						content: {
							"application/json": { schema: { type: "boolean" } },
						},
					},
				},
			},
		},
		"/body": {
			post: {
				operationId: "createUser",
				tags: ["Users"],
				requestBody: { $ref: "#/components/requestBodies/CreateUser" },
				responses: { "204": { description: "Created without body" } },
			},
		},
		"/boolean": {
			post: {
				operationId: "booleanSchemas",
				tags: ["Users"],
				requestBody: {
					content: { "application/json": { schema: true } },
				},
				responses: {
					"200": {
						description: "Any",
						content: { "application/json": { schema: {} } },
					},
					"400": {
						description: "Never",
						content: { "application/json": { schema: false } },
					},
				},
			},
		},
	},
	components: {
		schemas: {
			AnyValue: true,
			NoValue: false,
			EmptySchema: {},
			UserInput: {
				type: "object",
				required: ["name"],
				properties: { name: { type: "string" } },
			},
			ErrorBody: {
				type: "object",
				required: ["message"],
				properties: { message: { type: "string" } },
			},
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
		parameters: {
			TraceId: {
				name: "X-Trace-Id",
				in: "header",
				schema: { type: "string" },
			},
			Search: {
				name: "search",
				in: "query",
				schema: { type: "string" },
			},
		},
		requestBodies: {
			CreateUser: {
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/UserInput" },
					},
				},
			},
		},
		responses: {
			NotFound: {
				description: "Not found",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/ErrorBody" },
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
		expect(Object.keys(first.files)).toContain(
			"zod/parameters/trace-id.schema.ts",
		);
		expect(Object.keys(first.files)).toContain(
			"zod/requestBodies/create-user.schema.ts",
		);
		expect(Object.keys(first.files)).toContain(
			"zod/responses/not-found.schema.ts",
		);
		expect(Object.keys(first.files)).toContain("users/search-users.schema.ts");

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
		expect(first.files["zod/models/any-value.schema.ts"]).toContain(
			"export const anyValueSchema = z.unknown()",
		);
		expect(first.files["zod/models/no-value.schema.ts"]).toContain(
			"export const noValueSchema = z.never()",
		);
		expect(first.files["zod/models/empty-schema.schema.ts"]).toContain(
			"export const emptySchemaSchema = z.unknown()",
		);
		expect(first.files["zod/parameters/trace-id.schema.ts"]).toContain(
			"export const ParameterTraceIdModel = z.string()",
		);
		expect(first.files["zod/requestBodies/create-user.schema.ts"]).toContain(
			'import { userInputSchema } from "../models/user-input.schema.ts"',
		);
		expect(first.files["zod/responses/not-found.schema.ts"]).toContain(
			"export const ResponseNotFound = errorBodySchema",
		);

		const search = first.files["users/search-users.schema.ts"] ?? "";
		expect(search).toContain(
			'import { ParameterSearchModel } from "../zod/parameters/search.schema.ts"',
		);
		expect(search).toContain(
			'import { ResponseNotFound } from "../zod/responses/not-found.schema.ts"',
		);
		expect(search).toContain(
			"export const searchUsersResponseSchema200 = z.string()",
		);
		expect(search).toContain(
			"export const searchUsersResponseSchema201 = z.number()",
		);
		expect(search).toContain(
			"export const searchUsersResponseSchema = z.union([searchUsersResponseSchema200, searchUsersResponseSchema201])",
		);
		expect(search).toContain(
			"export const searchUsersResponseErrorSchema = z.union([searchUsersResponseSchema400, searchUsersResponseSchema404])",
		);
		const noContent = first.files["users/no-content.schema.ts"] ?? "";
		expect(noContent).toContain(
			"export const noContentResponseSchema204 = z.undefined()",
		);
		expect(noContent).toContain(
			"export const noContentResponseSchema = noContentResponseSchema204",
		);
		const errorsOnly = first.files["users/errors-only.schema.ts"] ?? "";
		expect(errorsOnly).toContain(
			"export const errorsOnlyResponseSchema = z.unknown()",
		);
		expect(errorsOnly).toContain(
			"export const errorsOnlyResponseErrorSchema = z.union([errorsOnlyResponseSchema400, errorsOnlyResponseSchema404])",
		);
		const booleanSchemas = first.files["users/boolean-schemas.schema.ts"] ?? "";
		expect(booleanSchemas).toContain(
			"export const booleanSchemasMutationRequestSchema = z.unknown()",
		);
		expect(booleanSchemas).toContain(
			"export const booleanSchemasMutationSchemaResponseSchema200 = z.unknown()",
		);
		expect(booleanSchemas).toContain(
			"export const booleanSchemasMutationSchemaResponseSchema400 = z.never()",
		);

		for (const [fileName, source] of Object.entries(first.files)) {
			const declarations = [
				...source.matchAll(/export const ([A-Za-z_$][\w$]*)/g),
			].map((match) => match[1]);
			expect(new Set(declarations).size, fileName).toBe(declarations.length);
			for (const match of source.matchAll(
				/import \{ ([^}]+) \} from "([^"]+)"/g,
			)) {
				const moduleSpecifier = match[2];
				if (!moduleSpecifier || moduleSpecifier === "zod") continue;
				const target = path.posix.normalize(
					path.posix.join(path.posix.dirname(fileName), moduleSpecifier),
				);
				const targetFile = target.endsWith(".ts") ? target : `${target}.ts`;
				const targetSource = first.files[targetFile];
				expect(targetSource, `${fileName} -> ${targetFile}`).toBeDefined();
				for (const imported of match[1]
					?.split(",")
					.map((name) => name.trim()) ?? []) {
					expect(
						targetSource,
						`${fileName} imports ${imported} from ${targetFile}`,
					).toMatch(new RegExp(`export const ${imported}\\b`));
				}
			}
			expect(source, fileName).not.toMatch(
				new RegExp(
					`from ["'][^"']*${path.posix.basename(fileName, ".ts")}["']`,
				),
			);
		}
	});
});
