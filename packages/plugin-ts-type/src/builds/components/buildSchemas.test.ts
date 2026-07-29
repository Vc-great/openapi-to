import type { ComponentsSchema } from "@openapi-to/core";
import { Project, StructureKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { buildSchemas } from "./buildSchemas.ts";

function renderSchema(name: string, schema: ComponentsSchema): string {
	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile("schema.ts");
	sourceFile.addStatements(buildSchemas(name, schema));
	return sourceFile.getFullText();
}

describe("buildSchemas", () => {
	it("keeps the defensive empty result for invalid non-schema values", () => {
		expect(
			buildSchemas("test", null as unknown as ComponentsSchema),
		).toEqual([]);
		expect(
			buildSchemas("test", "string" as unknown as ComponentsSchema),
		).toEqual([]);
	});

	it.each([
		["UserId", { type: "string" }, "export type UserIdModel = string;"],
		["Count", { type: "integer" }, "export type CountModel = number;"],
		[
			"Tags",
			{ type: "array", items: { type: "string" } },
			"export type TagsModel = Array<string>;",
		],
		[
			"Result",
			{ oneOf: [{ type: "string" }, { type: "number" }] },
			"export type ResultModel = string | number;",
		],
	] as const)("renders the %s component as a real export", (name, schema, output) => {
		expect(renderSchema(name, schema as ComponentsSchema)).toContain(output);
	});

	it("renders boolean component schemas instead of empty files", () => {
		expect(
			renderSchema("Anything", true as unknown as ComponentsSchema),
		).toContain("export type AnythingModel = unknown;");
		expect(
			renderSchema("Impossible", false as unknown as ComponentsSchema),
		).toContain("export type ImpossibleModel = never;");
	});

	it("uses an interface only for a plain object schema", () => {
		const result = buildSchemas("user", {
			type: "object",
			properties: {
				id: { type: "string" },
			},
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			kind: StructureKind.Interface,
			name: "UserModel",
			isExported: true,
		});
	});

	it("preserves nullable object and $ref composition siblings in aliases", () => {
		expect(
			renderSchema("NullableUser", {
				type: "object",
				nullable: true,
				properties: { name: { type: "string" } },
			}),
		).toMatch(/export type NullableUserModel = \{[\s\S]*name\?: string;[\s\S]*\} \| null;/);
		expect(
			renderSchema("Extended", {
				$ref: "#/components/schemas/Base",
				allOf: [{ $ref: "#/components/schemas/Extra" }],
			}),
		).toContain("export type ExtendedModel = BaseModel & ExtraModel;");
	});
});
