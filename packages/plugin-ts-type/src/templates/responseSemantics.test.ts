import type { Schema } from "@openapi-to/core";
import { StructureKind, type TypeAliasDeclarationStructure } from "ts-morph";
import { describe, expect, it } from "vitest";
import { componentResponseTemplate } from "./componentResponseTemplate.ts";
import { operationResponseTemplate } from "./operationResponseTemplate.ts";

function aliasType(statement: unknown): string {
	expect(statement).toMatchObject({ kind: StructureKind.TypeAlias });
	return String((statement as TypeAliasDeclarationStructure).type);
}

const nullableObject: Schema = {
	type: "object",
	nullable: true,
	properties: { id: { type: "string" } },
};

describe("response schema semantics", () => {
	it("keeps nullable on operation object responses", () => {
		expect(
			aliasType(
				operationResponseTemplate(
					{
						code: "200",
						jsonSchema: {
							label: "application/json",
							schema: nullableObject,
							type: "object",
						},
					},
					"GetItemResponse",
				),
			),
		).toMatch(/\}\s*\| null$/);
	});

	it("keeps nullable and composition on component responses", () => {
		expect(
			aliasType(
				componentResponseTemplate(
					{ schema: nullableObject },
					"ResponseNullable",
				),
			),
		).toMatch(/\}\s*\| null$/);
		expect(
			aliasType(
				componentResponseTemplate(
					{
						schema: {
							$ref: "#/components/schemas/Base",
							allOf: [{ $ref: "#/components/schemas/Extra" }],
						},
					},
					"ResponseComposed",
				),
			),
		).toBe("BaseModel & ExtraModel");
	});
});
